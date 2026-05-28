-- ============================================================
-- Migration: add usage table for free-tier limits
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS).
-- ============================================================

-- ── Usage table ──────────────────────────────────────────────────────────────
create table if not exists public.usage (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users (id) on delete cascade,
  pdfs_uploaded         int         not null default 0,
  messages_sent_today   int         not null default 0,
  last_message_date     date,                          -- 'YYYY-MM-DD'; null = no messages yet
  bytes_stored          bigint      not null default 0,
  constraint usage_user_id_unique unique (user_id)     -- one row per user
);

-- ── updated_at trigger ───────────────────────────────────────────────────────
-- Reuse the set_updated_at() function created for the documents table.
alter table public.usage add column if not exists
  updated_at timestamptz not null default now();

create trigger trg_usage_updated_at
  before update on public.usage
  for each row execute function public.set_updated_at();

-- ── Row-Level Security ───────────────────────────────────────────────────────
alter table public.usage enable row level security;

create policy "owner_all_usage"
  on public.usage for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
