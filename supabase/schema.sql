-- ============================================================
-- InsightPDF AI — Supabase schema
-- Run once in: Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. Extensions
-- ────────────────────────────────────────────────────────────
create extension if not exists vector;          -- pgvector (768-dim Gemini embeddings)
create extension if not exists "uuid-ossp";     -- gen_random_uuid() fallback


-- ────────────────────────────────────────────────────────────
-- 1. documents
-- ────────────────────────────────────────────────────────────
create table public.documents (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  name          text        not null,                        -- original filename
  storage_path  text        not null,                        -- path inside 'pdfs' bucket
  size_bytes    bigint,
  page_count    int,
  status        text        not null default 'uploading'
                            check (status in ('uploading', 'processing', 'ready', 'error')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- keep updated_at current automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();


-- ────────────────────────────────────────────────────────────
-- 2. document_chunks  (text + 768-dim embeddings)
-- ────────────────────────────────────────────────────────────
create table public.document_chunks (
  id            uuid        primary key default gen_random_uuid(),
  document_id   uuid        not null references public.documents (id) on delete cascade,
  user_id       uuid        not null references auth.users (id) on delete cascade,
  content       text        not null,
  chunk_index   int         not null,
  embedding     vector(768),                               -- Gemini gemini-embedding-001, truncated to 768 via outputDimensionality
  created_at    timestamptz not null default now()
);

-- ivfflat index for fast approximate cosine-similarity search.
-- lists = 100 is a good default; tune to sqrt(row_count) once you have data.
create index document_chunks_embedding_idx
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);


-- ────────────────────────────────────────────────────────────
-- 3. chat_sessions
-- ────────────────────────────────────────────────────────────
create table public.chat_sessions (
  id            uuid        primary key default gen_random_uuid(),
  document_id   uuid        not null references public.documents (id) on delete cascade,
  user_id       uuid        not null references auth.users (id) on delete cascade,
  title         text,
  created_at    timestamptz not null default now()
);


-- ────────────────────────────────────────────────────────────
-- 4. messages
-- ────────────────────────────────────────────────────────────
create table public.messages (
  id            uuid        primary key default gen_random_uuid(),
  session_id    uuid        not null references public.chat_sessions (id) on delete cascade,
  role          text        not null check (role in ('user', 'assistant')),
  content       text        not null,
  created_at    timestamptz not null default now()
);


-- ────────────────────────────────────────────────────────────
-- 5. Similarity-search function
--    Returns up to `match_count` chunks from one document,
--    ordered by cosine similarity to `query_embedding`.
-- ────────────────────────────────────────────────────────────
create or replace function public.match_chunks(
  query_embedding  vector(768),
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
  order by dc.embedding <=> query_embedding   -- ascending distance = descending similarity
  limit match_count;
$$;


-- ────────────────────────────────────────────────────────────
-- 6. Row-Level Security
-- ────────────────────────────────────────────────────────────
alter table public.documents       enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_sessions   enable row level security;
alter table public.messages        enable row level security;

-- documents: owner full access
create policy "owner_all_documents"
  on public.documents for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- document_chunks: owner full access
create policy "owner_all_document_chunks"
  on public.document_chunks for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- chat_sessions: owner full access
create policy "owner_all_chat_sessions"
  on public.chat_sessions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- messages: access through owning session
create policy "owner_all_messages"
  on public.messages for all
  using (
    exists (
      select 1
      from public.chat_sessions s
      where s.id = messages.session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.chat_sessions s
      where s.id = messages.session_id
        and s.user_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- 7. Storage bucket 'pdfs'  (private, 10 MB limit, PDF only)
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pdfs',
  'pdfs',
  false,
  10485760,                        -- 10 MB
  array['application/pdf']
)
on conflict (id) do nothing;

-- Files are stored at:  {user_id}/{uuid}/{filename}.pdf
-- The first path segment is always the owner's UUID.

create policy "pdfs_insert_owner"
  on storage.objects for insert
  with check (
    bucket_id = 'pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "pdfs_select_owner"
  on storage.objects for select
  using (
    bucket_id = 'pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "pdfs_update_owner"
  on storage.objects for update
  using (
    bucket_id = 'pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "pdfs_delete_owner"
  on storage.objects for delete
  using (
    bucket_id = 'pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ────────────────────────────────────────────────────────────
-- 8. Usage tracking  (free-tier limits)
-- ────────────────────────────────────────────────────────────
-- FREE_LIMITS: maxPdfs=3, maxMessagesPerDay=30, maxStorageBytes=50MB
create table public.usage (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users (id) on delete cascade,
  pdfs_uploaded         int         not null default 0,
  messages_sent_today   int         not null default 0,
  last_message_date     date,
  bytes_stored          bigint      not null default 0,
  updated_at            timestamptz not null default now(),
  constraint usage_user_id_unique unique (user_id)
);

create trigger trg_usage_updated_at
  before update on public.usage
  for each row execute function public.set_updated_at();

alter table public.usage enable row level security;

create policy "owner_all_usage"
  on public.usage for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
