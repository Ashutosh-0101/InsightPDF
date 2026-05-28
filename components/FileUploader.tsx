'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, X, CheckCircle2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Document } from '@/types'

type Phase = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  uploading: 'Uploading file…',
  processing: 'Processing & generating embeddings…',
  done: 'Ready!',
  error: 'Failed',
}

// How often to poll Supabase for status changes (ms)
const POLL_INTERVAL_MS = 3_000
// Max number of polls before giving up (~3 minutes)
const MAX_POLL_ATTEMPTS = 60

interface FileUploaderProps {
  /** When true, disables the trigger button and shows the limit tooltip. */
  atLimit?: boolean
}

export function FileUploader({ atLimit = false }: FileUploaderProps) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  // Interval refs kept in refs so they survive re-renders without stale closures
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollAttemptsRef = useRef(0)

  const router = useRouter()

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      clearAllTimers()
    }
  }, [])

  function clearAllTimers() {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    pollAttemptsRef.current = 0
  }

  function reset() {
    clearAllTimers()
    setPhase('idle')
    setProgress(0)
    setFile(null)
    setError(null)
    setDragging(false)
  }

  function handleOpenChange(val: boolean) {
    if (!val && (phase === 'uploading' || phase === 'processing')) return
    if (!val) reset()
    setOpen(val)
  }

  function validateAndSet(f: File) {
    if (f.type !== 'application/pdf') {
      setError('Only PDF files are supported')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File exceeds the 10 MB limit')
      return
    }
    setFile(f)
    setError(null)
  }

  async function handleUpload() {
    if (!file) return
    setPhase('uploading')
    setProgress(0)
    setError(null)

    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setError('Session expired — please reload and sign in again')
      setPhase('error')
      return
    }

    // ── Phase 1: upload file (0 → 40%) via XHR for real progress events ──
    // fetch() has no upload progress API; XHR does.
    let documentId: string
    try {
      documentId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const formData = new FormData()
        formData.append('file', file)

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 40))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const body = JSON.parse(xhr.responseText) as {
                success: boolean
                documentId: string
              }
              resolve(body.documentId)
            } catch {
              reject(new Error('Unexpected response from server'))
            }
          } else if (xhr.status === 429) {
            try {
              const body = JSON.parse(xhr.responseText) as { detail?: string; error: string }
              reject(new Error(body.detail ?? body.error ?? 'Free tier limit reached'))
            } catch {
              reject(new Error('Free tier limit reached — upgrade coming soon.'))
            }
          } else {
            try {
              const body = JSON.parse(xhr.responseText) as { error: string }
              reject(new Error(body.error ?? 'Upload failed'))
            } catch {
              reject(new Error(`Upload failed (HTTP ${xhr.status})`))
            }
          }
        })

        xhr.addEventListener('error', () =>
          reject(new Error('Network error — check your connection'))
        )
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

        xhr.open('POST', '/api/upload')
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
        xhr.send(formData)
      })
    } catch (err) {
      setError((err as Error).message)
      setPhase('error')
      return
    }

    // ── Phase 2: poll document status until 'ready' or 'error' (40 → 95%) ──
    // The server fires /api/embed automatically via after(); we just watch
    // the `status` column until it resolves.
    setPhase('processing')
    setProgress(40)

    // Animate the bar from 40 → 92 while we wait
    progressIntervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) {
          clearInterval(progressIntervalRef.current!)
          progressIntervalRef.current = null
          return p
        }
        return p + 0.5
      })
    }, 400)

    pollAttemptsRef.current = 0

    pollIntervalRef.current = setInterval(async () => {
      pollAttemptsRef.current += 1

      if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
        clearAllTimers()
        setError('Processing timed out — the document may still be indexing in the background')
        setPhase('error')
        return
      }

      const { data } = await supabase
        .from('documents')
        .select('status')
        .eq('id', documentId)
        .single<Pick<Document, 'status'>>()

      if (data?.status === 'ready') {
        clearAllTimers()
        setProgress(100)
        setPhase('done')
        setTimeout(() => {
          setOpen(false)
          router.push(`/chat/${documentId}`)
        }, 700)
      } else if (data?.status === 'error') {
        clearAllTimers()
        setError('Document processing failed — please try uploading again')
        setPhase('error')
      }
      // status is 'uploading' or 'processing' → keep polling
    }, POLL_INTERVAL_MS)
  }

  const isBusy = phase === 'uploading' || phase === 'processing'
  const isDone = phase === 'done'

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2"
        disabled={atLimit}
        title={atLimit ? 'Free tier PDF limit reached (3/3). Upgrade coming soon.' : undefined}
      >
        <Plus className="h-4 w-4" />
        {atLimit ? 'Limit reached' : 'Upload PDF'}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={!isBusy} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload a PDF</DialogTitle>
            <DialogDescription>
              Drop your file below or click to browse. Max 10 MB, PDF only.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* ── Drop zone (hidden while busy or done) ── */}
            {!isBusy && !isDone && (
              <div
                role="button"
                tabIndex={0}
                aria-label="Click or drop a PDF here"
                className={cn(
                  'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  dragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/60 hover:bg-muted/40',
                  file && 'border-primary/60 bg-primary/5'
                )}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  const dropped = e.dataTransfer.files[0]
                  if (dropped) validateAndSet(dropped)
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) validateAndSet(f)
                    e.target.value = ''
                  }}
                />

                {file ? (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="max-w-full">
                      <p className="truncate text-sm font-medium" title={file.name}>
                        {file.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                        setError(null)
                      }}
                      className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {dragging ? 'Drop it here' : 'Click to browse or drag & drop'}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">PDF up to 10 MB</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Progress section ── */}
            {(isBusy || isDone) && (
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-3">
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  ) : (
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={file?.name}>
                      {file?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{PHASE_LABEL[phase]}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {Math.round(progress)}%
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300 ease-out',
                      isDone ? 'bg-emerald-500' : 'bg-primary'
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {phase === 'processing' && (
                  <p className="text-xs text-muted-foreground">
                    Chunking text and generating vector embeddings — this takes 20–60 s for most PDFs.
                  </p>
                )}
              </div>
            )}

            {/* ── Error message ── */}
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {/* ── Footer actions ── */}
            {!isBusy && !isDone && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={!file}>
                  {phase === 'error' ? 'Retry' : 'Upload & process'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
