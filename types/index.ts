export interface Document {
  id: string
  user_id: string
  name: string
  storage_path: string
  size_bytes: number | null
  page_count: number | null
  status: 'uploading' | 'processing' | 'ready' | 'error'
  created_at: string
  updated_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  user_id: string
  content: string
  chunk_index: number
  embedding: number[] | null
  created_at: string
}

export interface ChatSession {
  id: string
  document_id: string
  user_id: string
  title: string | null
  created_at: string
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ChunkMatch {
  id: string
  content: string
  chunk_index: number
  similarity: number
}

export interface UserUsage {
  id: string
  user_id: string
  pdfs_uploaded: number
  messages_sent_today: number
  last_message_date: string | null // 'YYYY-MM-DD'
  bytes_stored: number
}
