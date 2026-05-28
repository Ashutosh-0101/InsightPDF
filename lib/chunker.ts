/**
 * PDF text extraction, cleaning, and word-boundary chunking utilities.
 *
 * Depends on: pdf-parse (runtime import to avoid edge-runtime bundling issues)
 */

// ─── Custom error ────────────────────────────────────────────────────────────

/** Typed error thrown by this module. `code` is stable; `message` is human-readable. */
export class ChunkerError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'PDF_ENCRYPTED'
      | 'PDF_CORRUPT'
      | 'PDF_EMPTY'
      | 'PDF_PARSE_ERROR'
  ) {
    super(message)
    this.name = 'ChunkerError'
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExtractedPDF {
  /** Full text content of the PDF, with page breaks normalised to double newlines. */
  text: string
  /** Number of pages reported by pdf-parse. */
  pageCount: number
}

export interface ChunkOptions {
  /**
   * Target chunk size in **words**.
   * @default 500
   */
  chunkSize?: number
  /**
   * Word overlap between consecutive chunks. Keeps context across boundaries.
   * @default 50
   */
  overlap?: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_CHUNK_SIZE = 500
const DEFAULT_OVERLAP = 50
/** Chunks with fewer words than this are discarded (headers, footers, noise). */
const MIN_CHUNK_WORDS = 20
/**
 * When looking for a sentence boundary to end a chunk, how far back from the
 * hard cut-off (as a fraction of chunkSize) we scan.
 */
const SENTENCE_LOOKBACK_RATIO = 0.12

// ─── 1. extractTextFromPDF ───────────────────────────────────────────────────

/**
 * Extracts plain text and page count from a PDF buffer.
 *
 * Uses a dynamic import of `pdf-parse` so this file is safe to import in
 * Next.js App Router server components (avoids Edge runtime bundling issues).
 *
 * @throws {ChunkerError} PDF_ENCRYPTED  – password-protected PDF
 * @throws {ChunkerError} PDF_CORRUPT    – invalid / corrupt PDF structure
 * @throws {ChunkerError} PDF_EMPTY      – successfully parsed but no text found
 * @throws {ChunkerError} PDF_PARSE_ERROR – all other pdf-parse failures
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractedPDF> {
  // Dynamic import keeps pdf-parse out of edge-runtime bundles
  const pdfParse = (await import('pdf-parse')).default as (
    buf: Buffer
  ) => Promise<{ text: string; numpages: number }>

  let result: { text: string; numpages: number }

  try {
    result = await pdfParse(buffer)
  } catch (err) {
    const error = err as Error

    // pdf.js throws typed errors with a `.name` property set in its source
    if (error.name === 'PasswordException') {
      throw new ChunkerError(
        'PDF is password-protected. Please remove the password before uploading.',
        'PDF_ENCRYPTED'
      )
    }

    if (
      error.name === 'InvalidPDFException' ||
      error.message.includes('Invalid PDF') ||
      error.message.includes('bad XRef') ||
      error.message.includes('Invalid PDF structure')
    ) {
      throw new ChunkerError(
        'PDF appears to be corrupt or is not a valid PDF file.',
        'PDF_CORRUPT'
      )
    }

    throw new ChunkerError(`PDF extraction failed: ${error.message}`, 'PDF_PARSE_ERROR')
  }

  const text = cleanText(result.text)

  if (text.trim().length === 0) {
    throw new ChunkerError(
      'No extractable text found. The PDF may be a scanned image without OCR.',
      'PDF_EMPTY'
    )
  }

  return { text, pageCount: result.numpages }
}

// ─── 2. cleanText ────────────────────────────────────────────────────────────

/**
 * Normalises raw PDF text for embedding:
 * - Unicode NFKC normalisation (resolves ligatures, half-width chars, etc.)
 * - Strips control characters (NULL, BEL, BS, VT, FF, SO–US, DEL)
 * - Collapses runs of spaces/tabs to a single space
 * - Collapses 3+ consecutive newlines to 2 (preserves paragraph breaks)
 * - Trims leading/trailing whitespace per line
 */
export function cleanText(text: string): string {
  return (
    text
      // Normalise unicode (ligatures → individual chars, full-width → ASCII, etc.)
      .normalize('NFKC')
      // Drop control characters except LF (\x0A) and CR (\x0D)
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Collapse runs of horizontal whitespace
      .replace(/[ \t]+/g, ' ')
      // Trim each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Collapse 3+ blank lines to 2
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

// ─── 3. chunkText ────────────────────────────────────────────────────────────

/**
 * Splits `text` into overlapping word-boundary chunks suitable for embedding.
 *
 * Algorithm:
 * 1. Tokenise on whitespace.
 * 2. Slide a window of `chunkSize` words, advancing by `chunkSize - overlap`.
 * 3. Before cutting, scan backward up to `SENTENCE_LOOKBACK_RATIO × chunkSize`
 *    words for a sentence-ending token (`.`, `!`, `?`) to avoid splitting
 *    mid-sentence where possible.
 * 4. Discard chunks with fewer than `MIN_CHUNK_WORDS` words (headers, footers).
 *
 * @param text     Pre-cleaned plain text (pass through {@link cleanText} first).
 * @param options  Optional `chunkSize` (words, default 500) and `overlap` (words, default 50).
 * @returns        Array of text strings ready to be embedded.
 */
export function chunkText(text: string, options?: ChunkOptions): string[] {
  const chunkSize = Math.max(1, options?.chunkSize ?? DEFAULT_CHUNK_SIZE)
  const overlap = Math.min(options?.overlap ?? DEFAULT_OVERLAP, chunkSize - 1)

  // Tokenise on any whitespace sequence, drop empty tokens
  const words = text.split(/\s+/).filter((w) => w.length > 0)

  if (words.length === 0) return []

  const chunks: string[] = []
  let start = 0

  while (start < words.length) {
    const hardEnd = Math.min(start + chunkSize, words.length)

    // Try to end on a sentence boundary within the lookback window
    let splitPoint = hardEnd
    if (hardEnd < words.length) {
      const lookback = Math.max(start, hardEnd - Math.ceil(chunkSize * SENTENCE_LOOKBACK_RATIO))
      for (let i = hardEnd - 1; i >= lookback; i--) {
        if (/[.!?]['"]?\s*$/.test(words[i])) {
          splitPoint = i + 1
          break
        }
      }
    }

    const slice = words.slice(start, splitPoint)

    if (slice.length >= MIN_CHUNK_WORDS) {
      chunks.push(slice.join(' '))
    }

    // Advance the window; guard against infinite loop if slice was 0
    const advance = Math.max(1, chunkSize - overlap)
    start += advance
  }

  return chunks
}
