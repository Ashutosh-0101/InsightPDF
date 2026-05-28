import Link from 'next/link'
import { FileText, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
    // gray
    badgeClass:
      'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    spin: true,
    // amber / yellow
    badgeClass:
      'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  },
  ready: {
    label: 'Ready',
    icon: CheckCircle2,
    spin: false,
    // green
    badgeClass:
      'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    spin: false,
    // red
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

  return (
    <Card className="group flex flex-col transition-shadow hover:shadow-md hover:ring-foreground/15">
      <CardContent className="flex-1 pt-1">
        {/* Icon + name row */}
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

            {/* Metadata row */}
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

        {/* Status badge */}
        <div className="mt-3">
          <Badge
            className={cn(
              'gap-1 border text-xs font-medium',
              badgeClass
            )}
          >
            <Icon className={cn('h-3 w-3', spin && 'animate-spin')} />
            {label}
          </Badge>
        </div>
      </CardContent>

      <CardFooter>
        {isReady ? (
          <Button
            className="w-full"
            size="sm"
            render={<Link href={`/chat/${document.id}`} />} nativeButton={false}
          >
            Chat
          </Button>
        ) : (
          <Button
            className="w-full"
            size="sm"
            variant="outline"
            disabled
          >
            {document.status === 'error' ? 'Processing failed' : 'Preparing…'}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
