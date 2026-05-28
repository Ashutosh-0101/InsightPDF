import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { extractTextFromPDF, cleanText, chunkText, ChunkerError } from '@/lib/chunker'
import { embedChunks } from '@/lib/embeddings'

/** Allow up to 60 seconds — large PDFs can take a while to embed. */
export const maxDuration = 60

/** Supabase PostgREST rows per INSERT call. Keep ≤ 500 to stay well under
 *  the 2 MB default body limit; 20 is conservative and safe for wide rows. */
const DB_INSERT_BATCH_SIZE = 20

export async function POST(request: NextRequest) {
  // ── Auth — verify the caller is a real user ───────────────────────────────
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // createAdminClient uses SUPABASE_SERVICE_ROLE_KEY — bypasses RLS throughout
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
  let body: { documentId?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { documentId } = body
  if (!documentId) {
    return Response.json({ error: 'Missing required field: documentId' }, { status: 400 })
  }

  // ── Fetch document record ─────────────────────────────────────────────────
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, user_id, storage_path, status')
    .eq('id', documentId)
    .eq('user_id', user.id)   // caller may only process their own documents
    .single()

  if (docError || !doc) {
    console.error('[embed] document not found:', documentId, docError?.message)
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  // Guard against concurrent calls (fire-and-forget + manual retry race)
  if (doc.status === 'processing' || doc.status === 'ready') {
    return Response.json(
      { error: `Document already ${doc.status} — no action taken` },
      { status: 409 }
    )
  }

  // ── Step 3: mark as processing ────────────────────────────────────────────
  await supabase
    .from('documents')
    .update({ status: 'processing' })
    .eq('id', documentId)

  /**
   * Stamps the row with status='error', logs the reason server-side,
   * and returns a structured 5xx response.
   */
  async function fail(reason: string, httpStatus = 500): Promise<Response> {
    console.error(`[embed] documentId=${documentId} failed: ${reason}`)
    await supabase
      .from('documents')
      .update({ status: 'error' })
      .eq('id', documentId)
    return Response.json({ error: reason }, { status: httpStatus })
  }

  // ── Step 4: download PDF from Supabase Storage ────────────────────────────
  const { data: fileBlob, error: dlError } = await supabase.storage
    .from('pdfs')
    .download(doc.storage_path)

  if (dlError || !fileBlob) {
    return fail(`Storage download failed: ${dlError?.message ?? 'no data returned'}`)
  }

  const pdfBuffer = Buffer.from(await fileBlob.arrayBuffer())

  // ── Step 5: extract text from PDF buffer ──────────────────────────────────
  let rawText: string
  let pageCount: number

  try {
    ;({ text: rawText, pageCount } = await extractTextFromPDF(pdfBuffer))
  } catch (err) {
    if (err instanceof ChunkerError) {
      // Encrypted / corrupt PDFs → 422 so the client can show a specific message
      const httpStatus = err.code === 'PDF_ENCRYPTED' || err.code === 'PDF_CORRUPT' ? 422 : 500
      return fail(err.message, httpStatus)
    }
    return fail(`PDF extraction failed: ${(err as Error).message}`)
  }

  // ── Step 6: persist page count immediately ────────────────────────────────
  await supabase
    .from('documents')
    .update({ page_count: pageCount })
    .eq('id', documentId)

  // ── Step 7: clean → chunk (500 words, 50 overlap) ─────────────────────────
  const cleanedText = cleanText(rawText)
  const chunks = chunkText(cleanedText, { chunkSize: 500, overlap: 50 })

  if (chunks.length === 0) {
    return fail(
      'No usable text chunks produced. The PDF may be image-only (no OCR text).'
    )
  }

  // ── Step 8: embed all chunks with Gemini ──────────────────────────────────
  let vectors: number[][]

  try {
    vectors = await embedChunks(chunks)
  } catch (err) {
    return fail(`Gemini embedding failed: ${(err as Error).message}`)
  }

  if (vectors.length !== chunks.length) {
    return fail(
      `Embedding count mismatch: expected ${chunks.length}, got ${vectors.length}`
    )
  }

  // ── Step 9: insert chunks in batches of 20 ────────────────────────────────
  type ChunkRow = {
    document_id: string
    user_id: string
    content: string
    chunk_index: number
    embedding: string
  }

  const rows: ChunkRow[] = chunks.map((content, i) => ({
    document_id: documentId,
    user_id: doc.user_id,         // use the stored user_id, not the token's
    content,
    chunk_index: i,
    embedding: JSON.stringify(vectors[i]),
  }))

  for (let i = 0; i < rows.length; i += DB_INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + DB_INSERT_BATCH_SIZE)
    const { error: insertError } = await supabase
      .from('document_chunks')
      .insert(batch)

    if (insertError) {
      return fail(
        `Chunk insert failed (batch ${Math.floor(i / DB_INSERT_BATCH_SIZE) + 1}` +
        ` rows ${i}–${i + batch.length - 1}): ${insertError.message}`
      )
    }
  }

  // ── Step 10: mark document ready ─────────────────────────────────────────
  await supabase
    .from('documents')
    .update({ status: 'ready' })
    .eq('id', documentId)

  // ── Step 11: return success ───────────────────────────────────────────────
  return Response.json({
    success: true,
    chunksCreated: chunks.length,
  })
}
