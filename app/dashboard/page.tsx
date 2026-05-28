import { FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { getUserUsage } from '@/lib/limits'
import { DocumentCard } from '@/components/DocumentCard'
import { FileUploader } from '@/components/FileUploader'
import { UsageStats } from '@/components/UsageStats'
import type { Document, UserUsage } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch documents and usage in parallel
  const [{ data }, usage] = await Promise.all([
    supabase
      .from('documents')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    getUserUsage(user!.id, supabase),
  ])

  const documents = (data ?? []) as Document[]

  return (
    <div className="flex min-h-full flex-col">
      {/* ── Page header ── */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm sm:px-8">
        {/* Mobile: show logo (sidebar is hidden on small screens) */}
        <div className="flex items-center gap-2 md:hidden">
          <FileText className="h-5 w-5" />
          <span className="font-semibold">InsightPDF AI</span>
        </div>

        {/* Desktop: page title */}
        <div className="hidden md:block">
          <h1 className="text-base font-semibold">My Documents</h1>
          <p className="text-xs text-muted-foreground">
            {documents.length === 0
              ? 'No documents yet'
              : `${documents.length} document${documents.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {/* Upload button — disabled at limit */}
        <FileUploader atLimit={usage?.pdfs_uploaded >= 3} />
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Document grid — takes remaining width */}
          <div className="flex-1">
            {documents.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {documents.map((doc) => (
                  <DocumentCard key={doc.id} document={doc} />
                ))}
              </div>
            ) : (
              <EmptyState atLimit={usage?.pdfs_uploaded >= 3} />
            )}
          </div>

          {/* Usage sidebar — fixed width on desktop, full width on mobile */}
          <div className="w-full lg:w-64 lg:shrink-0">
            <UsageStats usage={usage ?? { pdfs_uploaded: 0, messages_sent_today: 0 } as UserUsage} />
          </div>
        </div>
      </main>
    </div>
  )
}

function EmptyState({ atLimit }: { atLimit: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted">
        <FileText className="h-9 w-9 text-muted-foreground" />
      </div>

      <h2 className="text-lg font-semibold">Upload your first PDF to get started</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Upload any research paper, contract, manual, or document. Ask questions and get
        instant answers powered by Google Gemini.
      </p>

      {!atLimit && (
        <div className="mt-8">
          <FileUploader atLimit={false} />
        </div>
      )}
    </div>
  )
}
