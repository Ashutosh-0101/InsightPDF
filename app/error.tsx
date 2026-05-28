'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertCircle className="h-8 w-8" />
      </div>

      <div>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          An unexpected error occurred. You can try again or head back to your dashboard.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-muted-foreground/60">{error.digest}</p>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button render={<Link href="/dashboard" />} nativeButton={false}>
          Back to dashboard
        </Button>
      </div>
    </div>
  )
}
