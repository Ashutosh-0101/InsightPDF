/**
 * Google Gemini embedding utilities.
 *
 * Model:      gemini-embedding-001  (Google renamed text-embedding-004)
 * Dimensions: 768  (truncated via outputDimensionality — Matryoshka embeddings)
 *
 * Why 768 and not 3072?
 *   pgvector's ivfflat index has a hard cap of 2000 dimensions.
 *   gemini-embedding-001 natively outputs 3072 dims, but supports Matryoshka
 *   truncation via outputDimensionality.  768 preserves strong retrieval quality
 *   and matches the vector(768) column already in the schema.
 *
 * Two task types are used for better retrieval quality (asymmetric embeddings):
 *   RETRIEVAL_DOCUMENT — for indexing document chunks
 *   RETRIEVAL_QUERY    — for embedding user search queries
 *
 * Free-tier rate limit: ~1 500 RPM
 */

import { GoogleGenerativeAI, TaskType, type EmbedContentRequest } from '@google/generative-ai'

// outputDimensionality is accepted by the API but missing from the SDK's type
// definitions (added after the types were published). Cast via this helper.
type EmbedRequestWithDim = EmbedContentRequest & { outputDimensionality?: number }

// ─── SDK setup ───────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Output dimension for all vectors.
 * Must match the `vector(N)` type in the `document_chunks.embedding` column
 * and the `match_chunks` function signature.
 */
const EMBEDDING_DIMENSIONS = 768

/** Chunks per batchEmbedContents call — one HTTP round-trip per batch. */
const BATCH_SIZE = 5

/**
 * Delay between batch calls.
 * 200 ms → max ~300 batches/min × 5 = 1 500 individual embeds/min,
 * which is exactly the free-tier ceiling.
 */
const INTER_BATCH_DELAY_MS = 200

// ─── Types ───────────────────────────────────────────────────────────────────

/** A 768-dimensional embedding vector. */
export type EmbeddingVector = number[]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── 1. embedChunks ──────────────────────────────────────────────────────────

/**
 * Embeds an array of document text chunks using `RETRIEVAL_DOCUMENT` task type.
 *
 * Uses `batchEmbedContents` so each batch of {@link BATCH_SIZE} chunks is one
 * HTTP round-trip.  A {@link INTER_BATCH_DELAY_MS} delay between batches keeps
 * throughput within free-tier rate limits.
 *
 * @param chunks  Plain-text strings to embed (output of `chunkText`).
 * @returns       Parallel array of {@link EMBEDDING_DIMENSIONS}-dim vectors.
 */
export async function embedChunks(chunks: string[]): Promise<EmbeddingVector[]> {
  if (chunks.length === 0) return []

  const results: EmbeddingVector[] = []

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)

    const { embeddings } = await embeddingModel.batchEmbedContents({
      requests: batch.map((text): EmbedRequestWithDim => ({
        content: { role: 'user', parts: [{ text }] },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    })

    for (const embedding of embeddings) {
      results.push(embedding.values)
    }

    if (i + BATCH_SIZE < chunks.length) {
      await delay(INTER_BATCH_DELAY_MS)
    }
  }

  return results
}

// ─── 2. embedQuery ───────────────────────────────────────────────────────────

/**
 * Embeds a single user query using `RETRIEVAL_QUERY` task type.
 *
 * The query-specific task type produces vectors optimised for similarity search
 * against document vectors embedded with `RETRIEVAL_DOCUMENT`.
 *
 * @param query  The user's chat or search query.
 * @returns      A {@link EMBEDDING_DIMENSIONS}-dimensional vector.
 */
export async function embedQuery(query: string): Promise<EmbeddingVector> {
  const req: EmbedRequestWithDim = {
    content: { role: 'user', parts: [{ text: query }] },
    taskType: TaskType.RETRIEVAL_QUERY,
    outputDimensionality: EMBEDDING_DIMENSIONS,
  }
  const { embedding } = await embeddingModel.embedContent(req)

  return embedding.values
}
