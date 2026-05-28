import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { checkUploadLimit, incrementPdfCount, LimitError } from '@/lib/limits'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  // ── 1. Authenticate ──────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const supabase = createAdminClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Check free-tier PDF limit ─────────────────────────────────────────
  try {
    await checkUploadLimit(user.id, supabase)
  } catch (err) {
    if (err instanceof LimitError) {
      return Response.json(
        { error: 'Free tier limit reached', detail: err.message, code: err.code },
        { status: 429 }
      )
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }

  // ── 3. Parse & validate form data ────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const file = formData.get('file')

  if (!(file instanceof File)) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return Response.json(
      { error: 'Only PDF files are allowed (received: ' + file.type + ')' },
      { status: 400 }
    )
  }
  if (file.size === 0) {
    return Response.json({ error: 'File is empty' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: `File exceeds the 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)` },
      { status: 400 }
    )
  }

  // ── 4. Build a safe, unique storage path ─────────────────────────────────
  const fileId = crypto.randomUUID()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
  const storagePath = `${user.id}/${fileId}-${safeName}`

  // ── 5. Upload to Supabase Storage ─────────────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer())
  const fileSize = file.size

  const { error: storageError } = await supabase.storage
    .from('pdfs')
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false })

  if (storageError) {
    return Response.json(
      { error: `Storage upload failed: ${storageError.message}` },
      { status: 500 }
    )
  }

  // ── 6. Insert document row with status = 'uploading' ─────────────────────
  const { data: document, error: dbError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      name: file.name,
      storage_path: storagePath,
      size_bytes: fileSize,
      status: 'uploading',
    })
    .select('id')
    .single()

  if (dbError || !document) {
    await supabase.storage.from('pdfs').remove([storagePath])
    return Response.json(
      { error: `Database error: ${dbError?.message ?? 'unknown'}` },
      { status: 500 }
    )
  }

  const documentId = document.id

  // ── 7. Increment usage counter ────────────────────────────────────────────
  // Fire-and-forget — don't block the response on a counter update
  after(async () => {
    try {
      await incrementPdfCount(user.id, supabase, fileSize)
    } catch (err) {
      console.error('[upload] usage increment failed:', err)
    }
  })

  // ── 8. Fire-and-forget: trigger embedding ────────────────────────────────
  const embedUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    `https://${request.headers.get('host') ?? 'localhost:3000'}`

  after(async () => {
    try {
      await fetch(`${embedUrl}/api/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentId }),
      })
    } catch (err) {
      console.error('[upload] fire-and-forget embed failed:', err)
    }
  })

  // ── 9. Return immediately ─────────────────────────────────────────────────
  return Response.json({ success: true, documentId }, { status: 200 })
}
