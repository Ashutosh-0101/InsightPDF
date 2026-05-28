'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { Zap, FileText, MessageCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FREE_LIMITS } from '@/lib/limits'
import type { UserUsage } from '@/types'

interface UsageStatsProps {
  usage: UserUsage
}

interface ProgressBarProps {
  label: string
  icon: React.ReactNode
  current: number
  max: number
}

function ProgressBar({ label, icon, current, max }: ProgressBarProps) {
  const pct = Math.min(100, Math.round((current / max) * 100))
  const isAtLimit = current >= max
  const isWarning = pct >= 80 && !isAtLimit

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          {icon}
          {label}
        </span>
        <span
          className={cn(
            'tabular-nums font-medium',
            isAtLimit
              ? 'text-destructive'
              : isWarning
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground'
          )}
        >
          {current}/{max}
        </span>
      </div>

      {/* Track */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isAtLimit
              ? 'bg-destructive'
              : isWarning
                ? 'bg-amber-500'
                : 'bg-primary'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function UsageStats({ usage }: UsageStatsProps) {
  const pdfPct = (usage.pdfs_uploaded / FREE_LIMITS.maxPdfs) * 100
  const msgPct = (usage.messages_sent_today / FREE_LIMITS.maxMessagesPerDay) * 100

  const isAtPdfLimit = usage.pdfs_uploaded >= FREE_LIMITS.maxPdfs
  const isAtMsgLimit = usage.messages_sent_today >= FREE_LIMITS.maxMessagesPerDay

  // Fire a single warning toast when approaching (80–99%) or hitting a limit
  useEffect(() => {
    if (pdfPct >= 80 && pdfPct < 100) {
      toast.warning(
        `PDF storage: ${usage.pdfs_uploaded}/${FREE_LIMITS.maxPdfs} used`,
        { description: 'You\'re close to the free tier PDF limit.' }
      )
    }
    if (msgPct >= 80 && msgPct < 100) {
      toast.warning(
        `Daily messages: ${usage.messages_sent_today}/${FREE_LIMITS.maxMessagesPerDay} used`,
        { description: 'Your message count resets at midnight.' }
      )
    }
    if (isAtPdfLimit) {
      toast.error('PDF limit reached', {
        description: `Free tier allows ${FREE_LIMITS.maxPdfs} PDFs. Upgrade coming soon!`,
      })
    }
    if (isAtMsgLimit) {
      toast.error('Daily message limit reached', {
        description: 'Your count resets at midnight. Upgrade coming soon!',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount — avoids re-firing on every re-render

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <Zap className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold">Free tier usage</span>
      </div>

      {/* Progress bars */}
      <div className="space-y-3">
        <ProgressBar
          label="PDFs"
          icon={<FileText className="h-3 w-3" />}
          current={usage.pdfs_uploaded}
          max={FREE_LIMITS.maxPdfs}
        />
        <ProgressBar
          label="Messages today"
          icon={<MessageCircle className="h-3 w-3" />}
          current={usage.messages_sent_today}
          max={FREE_LIMITS.maxMessagesPerDay}
        />
      </div>

      {/* Upgrade prompt — shown when any limit is hit */}
      {(isAtPdfLimit || isAtMsgLimit) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-950/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                {isAtPdfLimit ? 'PDF limit reached' : 'Daily message limit reached'}
              </p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                {isAtPdfLimit
                  ? `Free tier allows ${FREE_LIMITS.maxPdfs} PDFs.`
                  : `${FREE_LIMITS.maxMessagesPerDay} messages per day. Resets at midnight.`}
              </p>
              <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                ✦ Upgrade coming soon
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
