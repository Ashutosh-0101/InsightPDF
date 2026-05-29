'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2 } from 'lucide-react'

interface ProcessingStateProps {
  documentName: string
  status: 'uploading' | 'processing'
}

export function ProcessingState({ documentName, status }: ProcessingStateProps) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(id)
  }, [router])

  const label = status === 'uploading' ? 'Uploading…' : 'Generating embeddings…'
  const sub =
    status === 'uploading'
      ? 'Saving your file securely.'
      : 'Chunking and indexing your PDF — usually 20–60 s.'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-muted">
        <FileText className="h-9 w-9 text-muted-foreground" />
        <span className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-background ring-2 ring-border">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        </span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{label}</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">{documentName}</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">{sub}</p>
      </div>

      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
