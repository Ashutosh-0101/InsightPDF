import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const token = authHeader.slice(7)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, user_id, storage_path, size_bytes')
    .eq('id', docId)
    .eq('user_id', user.id)
    .single()

  if (docError || !doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  // Remove from storage — log but don't abort if this fails
  const { error: storageError } = await supabase.storage
    .from('pdfs')
    .remove([doc.storage_path])

  if (storageError) {
    console.error('[delete] storage remove failed:', storageError.message)
  }

  // Delete the DB row — FK cascades to document_chunks, chat_sessions, messages
  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', docId)
    .eq('user_id', user.id)

  if (deleteError) {
    return Response.json({ error: `Delete failed: ${deleteError.message}` }, { status: 500 })
  }

  return Response.json({ success: true })
}

