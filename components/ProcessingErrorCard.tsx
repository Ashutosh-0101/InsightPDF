'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

interface ProcessingErrorCardProps {
  documentId: string
  documentName: string
}

export function ProcessingErrorCard({ documentId, documentName }: ProcessingErrorCardProps) {
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const router = useRouter()

  async function handleRetry() {
    setRetrying(true)
    setRetryError(null)

    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setRetryError('Session expired — please sign in again.')
      setRetrying(false)
      return
    }

    try {
      const res = await fetch('/api/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ documentId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Retry failed (HTTP ${res.status})`)
      }

      // Embed started — go to dashboard so the user can watch the status
      router.push('/dashboard')
    } catch (err) {
      setRetryError((err as Error).message)
      setRetrying(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertCircle className="h-8 w-8" />
      </div>

      <div>
        <h2 className="text-xl font-semibold">Processing failed</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          We couldn&apos;t index <span className="font-medium text-foreground">{documentName}</span>.
          This can happen with image-only or encrypted PDFs.
        </p>
      </div>

      {retryError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
          {retryError}
        </p>
      )}

      <Button onClick={handleRetry} disabled={retrying} className="gap-2">
        <RefreshCw className={retrying ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        {retrying ? 'Retrying…' : 'Retry processing'}
      </Button>
    </div>
  )
}
