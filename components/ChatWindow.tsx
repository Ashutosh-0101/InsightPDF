'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { MessageBubble } from '@/components/MessageBubble'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { Document, ChatSession, Message } from '@/types'

interface ChatWindowProps {
  document: Document
  session: ChatSession
  initialMessages: Message[]
  userId: string
}

const STREAMING_ID = '__streaming__'
const MAX_CHARS = 1000

const STARTER_PROMPTS = [
  'Summarize this document',
  'What are the key points?',
  'What is the main conclusion?',
  'List the most important facts',
]

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
        <svg className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
        </svg>
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <div className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <div
              key={delay}
              className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ChatWindow({ document, session, initialMessages, userId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [currentSessionId, setCurrentSessionId] = useState(session.id)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      setInput('')
      setLoading(true)
      setError(null)

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }

      const supabase = createClient()
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession()

      if (!authSession) {
        setError('Session expired — please refresh the page.')
        setLoading(false)
        return
      }

      // Optimistic user message
      const optimisticUser: Message = {
        id: crypto.randomUUID(),
        session_id: currentSessionId,
        role: 'user',
        content: trimmed,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimisticUser])

      // Streaming placeholder (empty content = show typing indicator)
      const streamingMsg: Message = {
        id: STREAMING_ID,
        session_id: currentSessionId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, streamingMsg])

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
        const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string }
        removeStreamingPlaceholder()
        setError(
          res.status === 429
            ? (body.detail ?? body.error ?? 'Daily message limit reached.')
            : (body.error ?? 'AI response failed — please try again.')
        )
        setLoading(false)
        return
      }

      const returnedSessionId = res.headers.get('X-Session-Id')
      if (returnedSessionId && returnedSessionId !== currentSessionId) {
        setCurrentSessionId(returnedSessionId)
      }

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

      // Assign a stable ID to the completed streaming bubble
      setMessages((prev) =>
        prev.map((m) =>
          m.id === STREAMING_ID ? { ...m, id: crypto.randomUUID() } : m
        )
      )

      setLoading(false)
    },
    [loading, currentSessionId, document.id]
  )

  function removeStreamingPlaceholder() {
    setMessages((prev) => prev.filter((m) => m.id !== STREAMING_ID))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }


  return (
    <div className="flex h-full flex-col bg-background">
      {/* ── Header ── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/dashboard" />}
          nativeButton={false}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight" title={document.name}>
            {document.name}
          </p>
          {document.page_count && (
            <p className="text-xs text-muted-foreground">{document.page_count} pages</p>
          )}
        </div>
      </header>

      <Separator />

      {/* ── Messages area ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">

        {/* Empty state — vertically centred */}
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-4 py-8">
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">
                Ask anything about this document
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Or pick a prompt below to get started
              </p>
            </div>
            <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted hover:border-foreground/20 active:scale-[0.98]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.length > 0 && (
          <div className="mx-auto max-w-2xl px-4 py-6">
            <div className="space-y-4">
              {messages.map((msg) => {
                if (msg.id === STREAMING_ID && msg.content === '') {
                  return <TypingIndicator key={msg.id} />
                }
                return <MessageBubble key={msg.id} message={msg} />
              })}

              {error && (
                <p className="text-center text-xs text-destructive">{error}</p>
              )}

              <div ref={bottomRef} />
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* ── Input area ── */}
      <div className="shrink-0 bg-background px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <div
            className={cn(
              'flex items-end gap-2 rounded-2xl border bg-background px-3 py-2 transition-colors',
              loading ? 'border-border' : 'border-border focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/30'
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CHARS) setInput(e.target.value)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this document…"
              disabled={loading}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
              style={{ minHeight: '24px', maxHeight: '120px' }}
            />
            <Button
              type="button"
              size="icon-sm"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="mb-0.5 shrink-0"
              aria-label="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Character counter — only shown when typing */}
          {input.length > 0 && (
            <p
              className={cn(
                'mt-1 text-right text-[10px]',
                input.length > 900 ? 'text-destructive' : 'text-muted-foreground/60'
              )}
            >
              {input.length}/{MAX_CHARS}
            </p>
          )}

          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
