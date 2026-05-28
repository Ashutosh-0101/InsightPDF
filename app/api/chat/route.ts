import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createAdminClient } from '@/lib/supabase-server'
import { embedQuery } from '@/lib/embeddings'
import { checkMessageLimit, incrementMessageCount, LimitError } from '@/lib/limits'
import type { ChunkMatch } from '@/types'

// Note: gemini-1.5-flash was renamed by Google for this API key.
// gemini-2.5-flash is the direct equivalent and works on the free tier.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SYSTEM_INSTRUCTION = `You are a helpful assistant that answers questions based ONLY on the provided document content.
Rules:
- Answer ONLY from the document context provided. Do not use outside knowledge.
- If the answer is not in the context, say: "I couldn't find information about that in this document."
- Quote relevant parts of the document when helpful.
- Be concise and clear.
- Do not answer questions unrelated to the document.`

/**
 * POST /api/chat
 *
 * Full RAG pipeline with streaming:
 *   auth → session → save user msg → embed → match_chunks → Gemini stream
 *   → pipe to client → save assistant msg after stream ends
 *
 * Body:   { message: string, documentId: string, sessionId: string | null }
 * Returns: text/plain stream — chunks arrive as Gemini produces them.
 * Headers: X-Session-Id (the resolved or newly created session UUID)
 */
export async function POST(request: NextRequest) {
  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const token = authHeader.slice(7)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = (await request.json()) as {
    message: string
    documentId: string
    sessionId: string | null
  }

  const { message, documentId, sessionId } = body

  if (!message?.trim() || !documentId) {
    return Response.json({ error: 'Missing required fields: message, documentId' }, { status: 400 })
  }

  // ── 2. Check free-tier message limit ──────────────────────────────────────
  try {
    await checkMessageLimit(user.id, supabase)
  } catch (err) {
    if (err instanceof LimitError) {
      return Response.json(
        { error: 'Free tier limit reached', detail: err.message, code: err.code },
        { status: 429 }
      )
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }

  // ── 3. Resolve or create chat session ─────────────────────────────────────
  let resolvedSessionId: string

  if (sessionId) {
    resolvedSessionId = sessionId
  } else {
    // Fetch the document name so we can title the session
    const { data: doc } = await supabase
      .from('documents')
      .select('name')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    const { data: newSession, error: sessionErr } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        document_id: documentId,
        title: doc?.name ?? 'Chat',
      })
      .select('id')
      .single()

    if (sessionErr || !newSession) {
      console.error('[chat] session create failed:', sessionErr?.message)
      return Response.json({ error: 'Could not create chat session' }, { status: 500 })
    }

    resolvedSessionId = newSession.id
  }

  // ── 3. Save user message ──────────────────────────────────────────────────
  const { error: userMsgErr } = await supabase
    .from('messages')
    .insert({ session_id: resolvedSessionId, role: 'user', content: message.trim() })

  if (userMsgErr) {
    console.error('[chat] user message insert failed:', userMsgErr.message)
    return Response.json({ error: 'Failed to save message' }, { status: 500 })
  }

  // Increment daily message counter (fire-and-forget — don't block the stream)
  incrementMessageCount(user.id, supabase).catch((err) =>
    console.error('[chat] usage increment failed:', err)
  )

  // ── 4. Embed question ─────────────────────────────────────────────────────
  let queryEmbedding: number[]
  try {
    queryEmbedding = await embedQuery(message)
  } catch (err) {
    console.error('[chat] embed failed:', err)
    return Response.json({ error: 'Embedding failed' }, { status: 500 })
  }

  // ── 5. Similarity search — top 5 relevant chunks ──────────────────────────
  const { data: matches, error: searchErr } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    doc_id: documentId,
    match_count: 5,
  })

  if (searchErr) {
    console.error('[chat] match_chunks failed:', searchErr.message)
    return Response.json({ error: 'Similarity search failed' }, { status: 500 })
  }

  // ── 6. Build numbered context string ──────────────────────────────────────
  const chunks = (matches as ChunkMatch[]) ?? []
  const chunksText = chunks.length
    ? chunks.map((m, i) => `[${i + 1}] ${m.content}`).join('\n\n---\n\n')
    : '(No relevant content found in the document.)'

  const userPrompt = `Context from document:\n${chunksText}\n\nQuestion: ${message.trim()}`

  // ── 7 & 8. Stream Gemini response ─────────────────────────────────────────
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',          // gemini-1.5-flash renamed; this is the free-tier equivalent
    systemInstruction: SYSTEM_INSTRUCTION,
  })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        const result = await model.generateContentStream(userPrompt)

        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            controller.enqueue(encoder.encode(text))
            fullText += text
          }
        }
      } catch (err) {
        console.error('[chat] Gemini stream error:', err)
        // Send a visible error token so the client can surface it
        controller.enqueue(
          encoder.encode('\n\n[Error: AI response failed. Please try again.]')
        )
      } finally {
        controller.close()

        // Save assistant message after stream ends — fire-and-forget
        // (client already has the content; DB is for persistence / history)
        if (fullText.trim()) {
          supabase
            .from('messages')
            .insert({ session_id: resolvedSessionId, role: 'assistant', content: fullText })
            .then(({ error }) => {
              if (error) console.error('[chat] assistant message insert failed:', error.message)
            })
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Session-Id': resolvedSessionId,
    },
  })
}
