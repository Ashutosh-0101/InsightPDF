-- ============================================================
-- Migration: vector(768) → vector(3072)
--
-- Background: Google renamed text-embedding-004 → gemini-embedding-001
-- and changed the output dimension from 768 to 3072.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to run multiple times (idempotent where possible).
-- ============================================================

-- 1. Drop the ivfflat index — required before altering the column type
drop index if exists public.document_chunks_embedding_idx;

-- 2. Drop the old match_chunks function — its parameter type is dimension-bound
drop function if exists public.match_chunks(vector(768), uuid, int);

-- 3. Clear any existing (incorrectly-dimensioned) chunk rows so the
--    ALTER doesn't trip on data that can't be cast.
--    This is safe: re-uploading any document will re-generate all chunks.
delete from public.document_chunks;

-- 4. Reset any documents that are stuck in 'error' or 'processing' so they
--    can be re-uploaded by the user.
update public.documents
set status = 'uploading'
where status in ('error', 'processing');

-- 5. Alter the embedding column to 3072 dimensions
alter table public.document_chunks
  alter column embedding type vector(3072);

-- 6. Recreate the ivfflat index for the new dimension
create index document_chunks_embedding_idx
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 7. Recreate match_chunks with the correct 3072-dim signature
create or replace function public.match_chunks(
  query_embedding  vector(3072),
  doc_id           uuid,
  match_count      int default 5
)
returns table (
  id            uuid,
  content       text,
  chunk_index   int,
  similarity    float
)
language sql stable
as $$
  select
    dc.id,
    dc.content,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.document_id = doc_id
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
