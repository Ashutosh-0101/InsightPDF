'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { MessageBubble } from '@/components/MessageBubble'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { Document, ChatSession, Message } from '@/types'

interface ChatWindowProps {
  document: Document
  session: ChatSession
  initialMessages: Message[]
  userId: string
}

/** Sentinel ID used for the in-progress streaming bubble. */
const STREAMING_ID = '__streaming__'

export function ChatWindow({ document, session, initialMessages, userId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  // sessionId can be updated if the route creates a new session (null sessionId case)
  const [currentSessionId, setCurrentSessionId] = useState(session.id)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return

    setInput('')
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const {
      data: { session: authSession },
    } = await supabase.auth.getSession()

    if (!authSession) {
      setError('Session expired — please refresh the page.')
      setLoading(false)
      return
    }

    // ── Optimistic user message ───────────────────────────────────────────────
    // The route saves the real DB row; we show it immediately with a temp ID.
    // On page refresh the page server component reloads messages from Supabase.
    const optimisticUser: Message = {
      id: crypto.randomUUID(),
      session_id: currentSessionId,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])

    // ── Start streaming assistant placeholder ─────────────────────────────────
    const streamingMsg: Message = {
      id: STREAMING_ID,
      session_id: currentSessionId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, streamingMsg])

    // ── Call /api/chat — streaming response ───────────────────────────────────
    // The route handles: session creation (if needed), saving both messages,
    // embedding, vector search, and Gemini inference.
    let res: Response
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          documentId: document.id,
          sessionId: currentSessionId,
        }),
      })
    } catch {
      removeStreamingPlaceholder()
      setError('Network error — please check your connection.')
      setLoading(false)
      return
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string; detail?: string }
      removeStreamingPlaceholder()
      // 429 = free-tier limit — show the specific limit message
      if (res.status === 429) {
        setError(body.detail ?? body.error ?? 'Daily message limit reached. Upgrade coming soon!')
      } else {
        setError(body.error ?? 'AI response failed — please try again.')
      }
      setLoading(false)
      return
    }

    // Sync session ID if the route created a new session
    const returnedSessionId = res.headers.get('X-Session-Id')
    if (returnedSessionId && returnedSessionId !== currentSessionId) {
      setCurrentSessionId(returnedSessionId)
    }

    // ── Read the stream, appending tokens to the streaming bubble ─────────────
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const token = decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) =>
            m.id === STREAMING_ID ? { ...m, content: m.content + token } : m
          )
        )
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    } catch {
      setError('Stream interrupted — the response may be incomplete.')
    } finally {
      reader.releaseLock()
    }

    // ── Finalise the streaming bubble with a stable ID ────────────────────────
    // The route has already saved the DB row; we just need a non-sentinel ID
    // so subsequent renders don't collide.
    setMessages((prev) =>
      prev.map((m) =>
        m.id === STREAMING_ID ? { ...m, id: crypto.randomUUID() } : m
      )
    )

    setLoading(false)
  }

  function removeStreamingPlaceholder() {
    setMessages((prev) => prev.filter((m) => m.id !== STREAMING_ID))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
        <Button
          variant="ghost"
          size="icon"
          render={<Link href="/dashboard" />}
          nativeButton={false}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate" title={document.name}>
            {document.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {document.page_count ? `${document.page_count} pages · ` : ''}AI chat
          </p>
        </div>
      </header>

      <Separator />

      {/* Messages */}
      <ScrollArea className="flex-1 px-5 py-4">
        <div className="space-y-4 max-w-2xl mx-auto">
          {messages.length === 0 && !loading && (
            <p className="text-center text-sm text-muted-foreground py-16">
              Ask anything about this document.
            </p>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Show spinner only before first token arrives */}
          {loading && messages.at(-1)?.id !== STREAMING_ID && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {error && (
            <p className="text-center text-xs text-destructive">{error}</p>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <Separator />

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-5 py-3 shrink-0"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this document…"
          disabled={loading}
          className="flex-1"
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={!input.trim() || loading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
