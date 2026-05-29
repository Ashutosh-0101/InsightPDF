'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

interface MessageBubbleProps {
  message: Message
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso)
  )
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex items-end gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground border border-border'
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      <div className={cn('flex max-w-[75%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted text-foreground rounded-bl-sm'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose-sm break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p({ children }) {
                    return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                  },
                  pre({ children }) {
                    return (
                      <pre className="my-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 dark:bg-zinc-950">
                        {children}
                      </pre>
                    )
                  },
                  code({ children, className }) {
                    if (!className) {
                      return (
                        <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10">
                          {children}
                        </code>
                      )
                    }
                    return (
                      <code className="font-mono text-xs text-zinc-100">{children}</code>
                    )
                  },
                  ul({ children }) {
                    return <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>
                  },
                  ol({ children }) {
                    return <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>
                  },
                  li({ children }) {
                    return <li className="leading-relaxed">{children}</li>
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="my-2 border-l-2 border-muted-foreground/40 pl-3 italic text-muted-foreground">
                        {children}
                      </blockquote>
                    )
                  },
                  strong({ children }) {
                    return <strong className="font-semibold">{children}</strong>
                  },
                  a({ href, children }) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:opacity-80"
                      >
                        {children}
                      </a>
                    )
                  },
                  h1({ children }) { return <h1 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h1> },
                  h2({ children }) { return <h2 className="mb-2 mt-3 text-sm font-bold first:mt-0">{children}</h2> },
                  h3({ children }) { return <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3> },
                  hr() { return <hr className="my-3 border-muted-foreground/20" /> },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="px-1 text-[10px] text-muted-foreground/60">
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  )
}
