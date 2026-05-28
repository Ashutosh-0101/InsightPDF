# InsightPDF AI — Implementation Log

AI PDF Chat SaaS. Users upload PDFs, which are chunked and embedded using Google Gemini. They then chat with their documents via semantic search + Gemini 1.5 Flash.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router, React 19) |
| Language | TypeScript 5 — strict mode |
| Styling | Tailwind CSS v4 (`@import "tailwindcss"` — no config file) |
| UI Components | shadcn/ui v4 (`base-nova` style, `@base-ui/react`) |
| Database | Supabase (Postgres + pgvector) |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (private bucket `pdfs`) |
| Embeddings | Google Gemini `text-embedding-004` — 768 dimensions |
| Chat AI | Google Gemini `gemini-1.5-flash` |
| PDF parsing | `pdf-parse` |

> **Next.js 16 breaking changes vs 14:**
> `cookies()`, `params`, and `searchParams` are all async Promises — every usage must be awaited.
> Route handler `context.params` is also `Promise<{...}>`.

---

## Environment Variables

File: `.env.local`

```env
GEMINI_API_KEY=                    # Google AI Studio → free tier
NEXT_PUBLIC_SUPABASE_URL=          # Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Project Settings → API
SUPABASE_SERVICE_ROLE_KEY=         # Project Settings → API (never expose client-side)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Project Structure

```
paper-ai/
├── app/
│   ├── layout.tsx                  # Root layout — Geist fonts, metadata
│   ├── page.tsx                    # Landing page — hero + feature grid
│   ├── auth/
│   │   ├── login/page.tsx          # Sign-in form (client component)
│   │   ├── signup/page.tsx         # Registration form (client component)
│   │   └── callback/route.ts       # OAuth PKCE code exchange → redirect
│   ├── dashboard/
│   │   ├── layout.tsx              # Auth guard (server) + Sidebar
│   │   └── page.tsx                # Document grid + FileUploader
│   ├── chat/
│   │   └── [docId]/page.tsx        # Chat page — loads doc + session + history
│   └── api/
│       ├── upload/route.ts         # POST — PDF → Supabase Storage → documents row
│       ├── embed/route.ts          # POST — download → parse → chunk → embed → store
│       └── chat/route.ts           # POST — embed query → match_chunks → Gemini chat
├── components/
│   ├── Sidebar.tsx                 # Nav + user info + logout (client)
│   ├── FileUploader.tsx            # Drag-and-drop PDF upload flow (client)
│   ├── DocumentCard.tsx            # Card with status badge + open-chat button
│   ├── ChatWindow.tsx              # Full chat UI — messages + input (client)
│   ├── MessageBubble.tsx           # Single message bubble (user / assistant)
│   └── ui/                         # shadcn/ui installed components
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── avatar.tsx
│       ├── separator.tsx
│       ├── scroll-area.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       └── sonner.tsx
├── lib/
│   ├── supabase.ts                 # Browser client (createBrowserClient)
│   ├── supabase-server.ts          # Server client (async cookies) + admin client
│   ├── embeddings.ts               # embedText() / embedBatch() via text-embedding-004
│   ├── chunker.ts                  # chunkText() — 1000-char chunks, 200-char overlap
│   └── utils.ts                    # cn() helper for Tailwind class merging
├── types/
│   └── index.ts                    # Document, DocumentChunk, ChatSession, Message, ChunkMatch
├── supabase/
│   └── schema.sql                  # Complete DB schema — run once in SQL Editor
├── middleware.ts                   # Supabase session refresh on every request
├── components.json                 # shadcn config (base-nova style, Tailwind v4)
├── package.json
├── tsconfig.json
└── .env.local
```

---

## Step 1 — Project Bootstrap

Next.js 16 was already scaffolded via `create-next-app` with:
- App Router
- TypeScript strict mode
- Tailwind CSS v4
- Geist font

**Key config files created/confirmed:**

`tsconfig.json` — strict mode on, path alias `@/*` → `./`

`postcss.config.mjs`:
```js
const config = { plugins: { "@tailwindcss/postcss": {} } }
export default config
```

---

## Step 2 — Dependencies

`package.json` updated with:

```json
"dependencies": {
  "@base-ui/react": "^1.5.0",
  "@google/generative-ai": "^0.24.0",
  "@supabase/ssr": "^0.6.1",
  "@supabase/supabase-js": "^2.49.8",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.475.0",
  "next-themes": "^0.4.6",
  "pdf-parse": "^1.1.1",
  "shadcn": "^4.8.2",
  "sonner": "^2.0.7",
  "tailwind-merge": "^2.6.1",
  "tw-animate-css": "^1.4.0"
},
"devDependencies": {
  "@types/pdf-parse": "^1.1.4"
}
```

Install command:
```bash
npm install
```

---

## Step 3 — shadcn/ui Setup

shadcn v4 uses `@base-ui/react` instead of Radix UI. The `asChild` prop does not exist — the equivalent is the `render` prop:

```tsx
// Old (Radix-based shadcn):
<Button asChild><Link href="/dashboard">Go</Link></Button>

// New (@base-ui shadcn v4):
<Button render={<Link href="/dashboard" />}>Go</Button>
```

**Init command** (non-interactive, detects Tailwind v4 automatically):
```bash
npx shadcn@latest init -d
```

**Components added:**
```bash
npx shadcn@latest add input card dialog sonner badge separator scroll-area avatar dropdown-menu
```

`components.json`:
```json
{
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "", "css": "app/globals.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" }
}
```

> `toast` is deprecated in shadcn v4 — replaced by `sonner`.

---

## Step 4 — TypeScript Types

File: `types/index.ts`

```typescript
export interface Document {
  id: string
  user_id: string
  name: string
  storage_path: string      // path in 'pdfs' bucket: {user_id}/{uuid}/{filename}
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
  embedding: number[] | null  // 768 floats — Gemini text-embedding-004
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
  similarity: number  // 0–1 cosine similarity from match_chunks()
}
```

---

## Step 5 — Supabase Clients

### Browser client — `lib/supabase.ts`
Used in Client Components. `createBrowserClient` manages cookies automatically.

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Server client — `lib/supabase-server.ts`
Two exports:

**`createClient()`** — for Server Components and Route Handlers. Uses `await cookies()` (Next.js 16 async API). Respects RLS via the user's session.

**`createAdminClient()`** — service-role client that bypasses RLS. Used only in API routes where the bearer token has already been verified.

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()   // async in Next.js 16
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
        catch { /* Server Component — ignored. Middleware handles refresh. */ }
      },
    },
  })
}

export function createAdminClient() {
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

### Middleware — `middleware.ts`
Refreshes the session cookie on every request so it never expires mid-visit.

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

---

## Step 6 — Core Libraries

### Text Chunker — `lib/chunker.ts`

```typescript
export interface TextChunk { content: string; index: number }

const CHUNK_SIZE = 1000    // characters
const CHUNK_OVERLAP = 200  // characters overlap between consecutive chunks

export function chunkText(text: string): TextChunk[] {
  // Normalises whitespace, slides a window with overlap,
  // skips chunks shorter than 50 chars (noise).
}
```

### Embeddings — `lib/embeddings.ts`

Uses `text-embedding-004` which outputs **768-dimensional** vectors. Free tier: ~1500 RPM.

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })

export async function embedText(text: string): Promise<number[]>
export async function embedBatch(texts: string[]): Promise<number[][]>
```

---

## Step 7 — Supabase Database Schema

File: `supabase/schema.sql` — run once in **Dashboard → SQL Editor → New Query**.

### Tables

#### `documents`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK | `auth.users` cascade delete |
| `name` | text | Original filename |
| `storage_path` | text | Path in `pdfs` bucket: `{user_id}/{uuid}/{name}` |
| `size_bytes` | bigint | |
| `page_count` | int | Filled after PDF parse |
| `status` | text | `uploading` → `processing` → `ready` \| `error` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated by trigger `trg_documents_updated_at` |

#### `document_chunks`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `document_id` | uuid FK | `documents` cascade delete |
| `user_id` | uuid FK | `auth.users` — enables single-table RLS without joins |
| `content` | text | Raw text of the chunk |
| `chunk_index` | int | 0-based order within document |
| `embedding` | vector(768) | Gemini `text-embedding-004` output |
| `created_at` | timestamptz | |

**Index:**
```sql
create index document_chunks_embedding_idx
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
-- Tune `lists` to sqrt(row_count) as data grows.
-- ivfflat falls back to sequential scan until lists × 3 rows exist.
```

#### `chat_sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `document_id` | uuid FK | `documents` cascade delete |
| `user_id` | uuid FK | `auth.users` |
| `title` | text nullable | Defaults to document name |
| `created_at` | timestamptz | |

#### `messages`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK | `chat_sessions` cascade delete |
| `role` | text | `'user'` or `'assistant'` |
| `content` | text | |
| `created_at` | timestamptz | |

### Similarity Search Function

```sql
create or replace function public.match_chunks(
  query_embedding  vector(768),
  doc_id           uuid,
  match_count      int default 5
)
returns table (id uuid, content text, chunk_index int, similarity float)
language sql stable as $$
  select dc.id, dc.content, dc.chunk_index,
         1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.document_id = doc_id
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
```

`<=>` is the pgvector cosine distance operator. `1 - distance = similarity`.

### Row-Level Security

| Table | Policy | Rule |
|---|---|---|
| `documents` | `owner_all_documents` | `auth.uid() = user_id` |
| `document_chunks` | `owner_all_document_chunks` | `auth.uid() = user_id` |
| `chat_sessions` | `owner_all_chat_sessions` | `auth.uid() = user_id` |
| `messages` | `owner_all_messages` | Join through `chat_sessions.user_id = auth.uid()` |

### Storage Bucket `pdfs`

- Private (no public URLs)
- 10 MB file size limit
- MIME type restricted to `application/pdf`
- RLS: `(storage.foldername(name))[1] = auth.uid()::text` — first path segment must be owner's UUID

---

## Step 8 — API Routes

### `POST /api/upload`

**Flow:** Verify bearer token → validate PDF (type + 10 MB limit) → upload to `pdfs` bucket at `{user_id}/{uuid}/{filename}` → insert `documents` row with `status = 'processing'` → return `{ document }`.

**Auth:** `Authorization: Bearer <access_token>` header, verified via `supabase.auth.getUser(token)` using the admin client.

### `POST /api/embed`

**Flow:** Verify token → fetch document row → download PDF from `pdfs` bucket via `storage_path` → parse text with `pdf-parse` → update `page_count` → `chunkText()` → `embedText()` each chunk (50 ms throttle for free-tier rate limits) → bulk insert into `document_chunks` → update `status = 'ready'`.

**Throttle:** 50 ms between embedding requests ≈ max 1200 RPM, safely under the 1500 RPM free-tier limit.

### `POST /api/chat`

**Flow:** Verify token → `embedText(message)` → `supabase.rpc('match_chunks', { query_embedding, doc_id, match_count: 5 })` → fetch last 10 messages for history → build system prompt with context chunks → `gemini-1.5-flash` multi-turn chat → persist both turns to `messages` → return `{ answer }`.

**Request body:**
```json
{ "documentId": "uuid", "sessionId": "uuid", "message": "What is..." }
```

---

## Step 9 — Auth Flow

### `app/auth/login/page.tsx`
Client Component. `supabase.auth.signInWithPassword({ email, password })` → `router.push('/dashboard')`.

### `app/auth/signup/page.tsx`
Client Component. `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })` → confirmation screen prompting email verification.

### `app/auth/callback/route.ts`
GET handler. Exchanges PKCE `code` query param for a session: `supabase.auth.exchangeCodeForSession(code)` → redirects to `/dashboard`.

```typescript
// Next.js 16 — no async params needed here (no dynamic segments)
export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

### `app/dashboard/layout.tsx`
Server Component. Calls `supabase.auth.getUser()` — redirects to `/auth/login` if no session. Renders `<Sidebar>` with serialised user props.

---

## Step 10 — UI Components

### `components/Sidebar.tsx`
Client Component. Receives `{ id, email }` from server layout. Handles logout via browser Supabase client. Uses `usePathname` for active nav highlighting. `render` prop on Button renders logout icon as a `<button>`.

### `components/FileUploader.tsx`
Client Component. State machine: `idle → uploading → embedding → done | error`.
1. User drops/selects PDF → client-side validation (type + size)
2. `POST /api/upload` with bearer token in Authorization header
3. `POST /api/embed` with `documentId` from upload response
4. `router.refresh()` to reload the dashboard grid

### `components/DocumentCard.tsx`
Displays document name, `size_bytes` (formatted), `page_count`, and a status badge. Status icons: `Loader2` (spinning) for `uploading`/`processing`, `CheckCircle2` for `ready`, `AlertCircle` for `error`. "Open chat" button uses `render={<Link href={...} />}` pattern.

### `components/ChatWindow.tsx`
Client Component. Manages `messages` state with optimistic user message insertion before the API call resolves. Auto-scrolls to bottom via `useRef` + `useEffect`. Sends `Authorization: Bearer` header with every `/api/chat` request.

### `components/MessageBubble.tsx`
Stateless. User messages: right-aligned, dark background. Assistant messages: left-aligned, muted background. `whitespace-pre-wrap` preserves newlines in AI responses.

---

## Step 11 — Build Fixes Applied

### shadcn v4 `asChild` → `render` prop
`@base-ui/react` (used by shadcn v4) removed `asChild`. Every `<Button asChild><Link>` was replaced with:
```tsx
<Button render={<Link href="..." />}>Label</Button>
```
Affected files: `app/page.tsx`, `components/ChatWindow.tsx`, `components/DocumentCard.tsx`.

### Supabase SSR cookie types
`setAll` callback in `lib/supabase-server.ts` and `middleware.ts` had implicit `any` parameters. Fixed by importing `CookieOptions` from `@supabase/ssr`:
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[])
```

### Schema rename propagation
Initial schema used `file_path` / `file_size` / `embeddings` table / `match_embeddings` function. Final schema renamed these. All references updated:

| Old | New | Files updated |
|---|---|---|
| `file_path` | `storage_path` | `upload/route.ts`, `embed/route.ts`, `types/index.ts`, `DocumentCard.tsx` |
| `file_size` | `size_bytes` | same |
| table `embeddings` | `document_chunks` | `embed/route.ts`, `types/index.ts` |
| fn `match_embeddings` | `match_chunks` | `chat/route.ts`, `types/index.ts` |
| bucket `documents` | `pdfs` | `upload/route.ts`, `embed/route.ts` |
| `EmbeddingMatch` | `ChunkMatch` | `chat/route.ts`, `types/index.ts` |

---

## Step 12 — Dashboard Page

File: `app/dashboard/page.tsx` — Server Component.

**Structure:**
- Fetches all documents for the logged-in user ordered by `created_at desc`
- Sticky top header (blurred, `bg-background/90 backdrop-blur-sm`) containing:
  - Mobile: InsightPDF AI logo (sidebar is hidden on `< md`)
  - Desktop: page title + document count
  - `<FileUploader />` trigger button (always visible)
- Responsive document grid: 1 col → 2 col (sm) → 3 col (lg)
- `<EmptyState />` when no documents — includes a second `<FileUploader />` for discoverability

**Layout update (`app/dashboard/layout.tsx`):**
- Sidebar wrapped in `hidden md:flex` — hidden on mobile, shown from `md` upward
- Mobile users get navigation via the sticky header in the page

---

## Step 13 — FileUploader Component (with Dialog + Progress)

File: `components/FileUploader.tsx` — Client Component.

Renders both the trigger button **and** the Dialog modal. Parent just renders `<FileUploader />`.

### State machine

```
idle  →  uploading (0–40%)  →  embedding (40–95%)  →  done (100%)  →  redirect
                                                  ↘  error
```

### Upload progress
- **Phase 1 (upload, 0–40%):** `XMLHttpRequest` with `xhr.upload.addEventListener('progress', ...)` — real byte-level progress. `fetch()` cannot expose upload progress, hence XHR.
- **Phase 2 (embed, 40–95%):** Server-side operation — progress is simulated with `setInterval` ticking +1% every 350 ms. Clears on success or error.
- **Done:** 100%, then 700 ms delay → `router.push('/chat/[docId]')`.

### Key UX decisions
- Dialog close blocked while upload is in progress (`onOpenChange` guard)
- Drop zone hidden once upload starts (irrelevant during transfer)
- File preview shows name + size inside the drop zone after selection
- `X` button on the preview removes the selection (only when idle)
- Progress bar color: `bg-primary` during transfer → `bg-emerald-500` when done
- Error shows a styled `destructive`-tinted banner with "Retry" button
- `embedIntervalRef` stored in `useRef` to avoid stale-closure bugs; cleared in `useEffect` cleanup

### Validation
- MIME type: `application/pdf` only — checked before setting state
- Size: `> 10 MB` rejected with specific error message

---

## Step 14 — DocumentCard Component (Updated)

File: `components/DocumentCard.tsx`

### Badge colors

| Status | Color | Tailwind classes |
|---|---|---|
| `uploading` | Gray | `bg-zinc-100 text-zinc-600 border-zinc-200` |
| `processing` | Amber / yellow | `bg-amber-100 text-amber-700 border-amber-200` |
| `ready` | Emerald / green | `bg-emerald-100 text-emerald-700 border-emerald-200` |
| `error` | Red | `bg-red-100 text-red-700 border-red-200` |

All have dark-mode counterparts via `dark:` variants.
Badge uses `cn()` to merge custom classes onto the base shadcn `Badge`.

### Metadata row
Shows: upload date (formatted via `Intl.DateTimeFormat` with `en-US` locale) · file size · page count (once processed).

### "Chat" button
- Status `ready`: active, renders as `<Link href="/chat/[id]">` via `render` prop
- Any other status: `disabled`, label changes to "Preparing…" or "Processing failed"

---

## How to Run

### 1. Supabase setup
- Create a project at supabase.com
- Run `supabase/schema.sql` in **Dashboard → SQL Editor**
- Copy URL, anon key, and service role key into `.env.local`

### 2. Gemini API key
- Get a free key at aistudio.google.com
- Add to `.env.local` as `GEMINI_API_KEY`

### 3. Start dev server
```bash
npm run dev
# → http://localhost:3000
```

### 4. User flow
1. `/auth/signup` → verify email → sign in
2. `/dashboard` → click "Upload PDF" → drag-and-drop or browse → watch progress bar
3. After embed completes → auto-redirect to `/chat/[docId]`
4. Ask questions; come back to `/dashboard` to manage documents

---

---

## Step 15 — Streaming RAG Chat Pipeline

Files: `app/api/chat/route.ts`, `components/ChatWindow.tsx`

### Route — full pipeline

```
POST /api/chat  { message, documentId, sessionId: string | null }
```

1. **Auth** — Bearer token via `createAdminClient().auth.getUser(token)`
2. **Session** — if `sessionId` is `null`, creates a new `chat_sessions` row; returns the resolved ID in `X-Session-Id` response header
3. **Persist user message** — inserted into `messages` before AI call so it's saved even if Gemini fails
4. **Embed query** — `embedQuery(message)` → 768-dim vector via `gemini-embedding-001`
5. **Similarity search** — `supabase.rpc('match_chunks', { query_embedding, doc_id, match_count: 5 })`
6. **Numbered context** — chunks formatted as `[1] text\n\n---\n\n[2] text...`
7. **Gemini streaming** — `model.generateContentStream(userPrompt)` where:
   - model: `gemini-2.5-flash` (`gemini-1.5-flash` was renamed/removed for this API key)
   - systemInstruction: rules that restrict answers to document content
   - user prompt: `Context from document:\n{chunksText}\n\nQuestion: {message}`
8. **Stream to client** — `ReadableStream` encodes each text token as it arrives; `Content-Type: text/plain; charset=utf-8`
9. **Persist assistant message** — after stream ends, full accumulated text inserted to `messages` (fire-and-forget, does not block response)

### ChatWindow — streaming UI

- **Optimistic user bubble** added immediately with temp `crypto.randomUUID()` ID
- **Streaming assistant bubble** uses sentinel ID `__streaming__`; each token appends to its `content`
- Spinner shows only between submit and first token; disappears when stream starts
- `X-Session-Id` header read after response starts; `currentSessionId` state updated for the next message
- On stream completion, sentinel ID replaced with a stable random UUID
- Route owns all message persistence — client no longer calls Supabase for messages

### Model name history

| Old name | Status | Replacement |
|---|---|---|
| `gemini-1.5-flash` | Removed from this API key | `gemini-2.5-flash` |
| `text-embedding-004` | Removed | `gemini-embedding-001` (768 dims via `outputDimensionality`) |

### Supabase fix history

| Issue | Cause | Fix |
|---|---|---|
| All uploads → 500 | Schema SQL never run; bucket `pdfs` and all tables missing | Run `supabase/schema.sql` in SQL Editor |
| Embed → 500 "expected 768 dims, not 3072" | `gemini-embedding-001` outputs 3072 natively; column is `vector(768)` | `outputDimensionality: 768` in `embedChunks` and `embedQuery` |
| ivfflat migration → "column cannot have > 2000 dims" | ivfflat hard cap; 3072 would have required HNSW | Moot after using `outputDimensionality: 768` |

---

## Step 16 — Free-Tier Usage Limits

### Database

New table `usage` — one row per user (enforced by `UNIQUE` constraint on `user_id`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid UNIQUE FK → `auth.users` | |
| `pdfs_uploaded` | int | Total PDFs ever uploaded |
| `messages_sent_today` | int | Resets daily |
| `last_message_date` | date | Used to detect day rollover |
| `bytes_stored` | bigint | Cumulative bytes in `pdfs` bucket |
| `updated_at` | timestamptz | Auto-updated by trigger |

Migration file: `supabase/add_usage_table.sql` (run in SQL Editor for existing projects).
New-project schema: appended as section 8 in `supabase/schema.sql`.

### `lib/limits.ts`

```typescript
FREE_LIMITS = { maxPdfs: 3, maxMessagesPerDay: 30, maxStorageBytes: 50_000_000 }
```

| Function | Behaviour |
|---|---|
| `checkUploadLimit(userId, supabase)` | Throws `LimitError('PDF_LIMIT')` if `pdfs_uploaded >= 3` |
| `checkMessageLimit(userId, supabase)` | Resets counter if `last_message_date ≠ today`, then throws `LimitError('MESSAGE_LIMIT')` if `messages_sent_today >= 30` |
| `incrementPdfCount(userId, supabase, bytes)` | `pdfs_uploaded += 1`, `bytes_stored += bytes` |
| `incrementMessageCount(userId, supabase)` | Handles day rollover, `messages_sent_today += 1` |
| `getUserUsage(userId, supabase)` | Returns current row, creates default row if absent |

`getOrCreateUsage` (internal) uses `upsert({ …, ignoreDuplicates: true })` to safely handle concurrent first-access without resetting existing counters.

**`LimitError`** — typed error with `code: 'PDF_LIMIT' | 'MESSAGE_LIMIT' | 'STORAGE_LIMIT'`. Routes catch it and return HTTP **429** with `{ error: 'Free tier limit reached', detail: string, code: string }`.

### API route changes

**`/api/upload`:** `checkUploadLimit` called before any file processing. If limit hit → 429. `incrementPdfCount` called in `after()` (fire-and-forget, non-blocking).

**`/api/chat`:** `checkMessageLimit` called after auth, before session resolution. If limit hit → 429. `incrementMessageCount` called after user message is saved (fire-and-forget).

### `components/UsageStats.tsx`

Client Component that receives `UserUsage` props from the server dashboard.

- Two `ProgressBar` sub-components: PDF count and daily messages
- Bar colours: `bg-primary` (< 80%), `bg-amber-500` (80–99%), `bg-destructive` (100%)
- `useEffect` on mount fires `toast.warning` at 80–99% and `toast.error` at 100%
- Upgrade prompt card (amber border) shown when any limit is 100%

### `app/providers.tsx`

New `Providers` Client Component wrapping `ThemeProvider` (from `next-themes`) + `<Toaster richColors position="top-right" />`. Added to `app/layout.tsx` body so toasts work across all pages.

### `components/FileUploader.tsx` changes

- Accepts `atLimit?: boolean` prop
- Trigger button shows "Limit reached" and is `disabled` when `atLimit`
- XHR `load` handler checks for HTTP 429 and surfaces `detail` message specifically

### `components/ChatWindow.tsx` changes

- `res.status === 429` branch extracts `detail` field for the limit-specific error message

---

## What's Not Built Yet

- [ ] Delete document (UI + storage cleanup)
- [ ] Multiple chat sessions per document (session switcher UI)
- [ ] PDF viewer alongside chat
- [ ] Mobile sidebar / hamburger menu (sidebar hidden on mobile; logo shown in sticky header)
- [ ] Auto-refresh cards stuck in `processing` state (polling or Supabase Realtime)
- [ ] Paid upgrade tier (Stripe integration)
- [ ] OAuth providers (Google, GitHub)
