import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { ChatWindow } from '@/components/ChatWindow'
import { ProcessingErrorCard } from '@/components/ProcessingErrorCard'
import type { Document, ChatSession, Message } from '@/types'

export default async function ChatPage({
  params,
}: {
  params: Promise<{ docId: string }>
}) {
  const { docId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: document } = await supabase
    .from('documents')
    .select('*')
    .eq('id', docId)
    .eq('user_id', user.id)
    .single()

  if (!document) redirect('/dashboard')

  const doc = document as Document

  if (doc.status === 'error') {
    return <ProcessingErrorCard documentId={docId} documentName={doc.name} />
  }

  if (doc.status !== 'ready') {
    redirect(`/dashboard?processing=${docId}`)
  }

  // Get the most recent session or create a new one
  let { data: session } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('document_id', docId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!session) {
    const { data: newSession } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, document_id: docId, title: doc.name })
      .select()
      .single()
    session = newSession
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', session!.id)
    .order('created_at', { ascending: true })

  return (
    <ChatWindow
      document={document as Document}
      session={session as ChatSession}
      initialMessages={(messages ?? []) as Message[]}
      userId={user.id}
    />
  )
}
