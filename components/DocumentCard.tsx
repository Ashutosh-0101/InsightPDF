'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, AlertCircle, CheckCircle2, Clock, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Document } from '@/types'

interface DocumentCardProps {
  document: Document
}

interface StatusConfig {
  label: string
  icon: React.ElementType
  spin: boolean
  badgeClass: string
}

const STATUS_CONFIG: Record<Document['status'], StatusConfig> = {
  uploading: {
    label: 'Uploading',
    icon: Loader2,
    spin: true,
    badgeClass:
      'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    spin: true,
    badgeClass:
      'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  },
  ready: {
    label: 'Ready',
    icon: CheckCircle2,
    spin: false,
    badgeClass:
      'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    spin: false,
    badgeClass:
      'border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400',
  },
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

export function DocumentCard({ document }: DocumentCardProps) {
  const { label, icon: Icon, spin, badgeClass } = STATUS_CONFIG[document.status]
  const isReady = document.status === 'ready'
  const sizeStr = formatBytes(document.size_bytes)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)

    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setDeleteError('Session expired — please sign in again.')
      setDeleting(false)
      return
    }

    try {
      const res = await fetch(`/api/documents/${document.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Delete failed (HTTP ${res.status})`)
      }

      setConfirmOpen(false)
      router.refresh()
    } catch (err) {
      setDeleteError((err as Error).message)
      setDeleting(false)
    }
  }

  return (
    <>
      <Card className="group flex flex-col transition-shadow hover:shadow-md hover:ring-foreground/15">
        <CardContent className="flex-1 pt-1">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className="truncate text-sm font-medium leading-snug text-foreground"
                title={document.name}
              >
                {document.name}
              </p>

              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span>{formatDate(document.created_at)}</span>
                {sizeStr && (
                  <>
                    <span className="opacity-40">·</span>
                    <span>{sizeStr}</span>
                  </>
                )}
                {document.page_count != null && (
                  <>
                    <span className="opacity-40">·</span>
                    <span>{document.page_count}p</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <Badge className={cn('gap-1 border text-xs font-medium', badgeClass)}>
              <Icon className={cn('h-3 w-3', spin && 'animate-spin')} />
              {label}
            </Badge>
          </div>
        </CardContent>

        <CardFooter className="gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              setDeleteError(null)
              setConfirmOpen(true)
            }}
            aria-label="Delete document"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          {isReady ? (
            <Button
              className="flex-1"
              size="sm"
              render={<Link href={`/chat/${document.id}`} />}
              nativeButton={false}
            >
              Chat
            </Button>
          ) : (
            <Button className="flex-1" size="sm" variant="outline" disabled>
              {document.status === 'error' ? 'Processing failed' : 'Preparing…'}
            </Button>
          )}
        </CardFooter>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!deleting) setConfirmOpen(o) }}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{document.name}</span> and all its chat
              history will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={deleting} />}
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
