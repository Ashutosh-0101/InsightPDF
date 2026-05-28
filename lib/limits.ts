/**
 * Free-tier usage limits for InsightPDF AI.
 *
 * All limit checks and counters operate through the `usage` table which has
 * one row per user, created on first access.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserUsage } from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

export const FREE_LIMITS = {
  maxPdfs: 3,
  maxMessagesPerDay: 30,
  maxStorageBytes: 50_000_000, // 50 MB
} as const

// ─── Typed error ─────────────────────────────────────────────────────────────

export class LimitError extends Error {
  constructor(
    message: string,
    public readonly code: 'PDF_LIMIT' | 'MESSAGE_LIMIT' | 'STORAGE_LIMIT'
  ) {
    super(message)
    this.name = 'LimitError'
  }
}

// ─── Internal helper ─────────────────────────────────────────────────────────

/**
 * Returns the usage row for `userId`, creating it with zero counters if it
 * does not exist.  Safe against concurrent first-access via upsert.
 */
async function getOrCreateUsage(
  userId: string,
  supabase: SupabaseClient
): Promise<UserUsage> {
  // Ensure the row exists (INSERT … ON CONFLICT DO NOTHING)
  await supabase
    .from('usage')
    .upsert(
      {
        user_id: userId,
        pdfs_uploaded: 0,
        messages_sent_today: 0,
        bytes_stored: 0,
      },
      { onConflict: 'user_id', ignoreDuplicates: true }
    )

  const { data } = await supabase
    .from('usage')
    .select('*')
    .eq('user_id', userId)
    .single()

  return data as UserUsage
}

// ─── 1. checkUploadLimit ─────────────────────────────────────────────────────

/**
 * Throws {@link LimitError} with code `'PDF_LIMIT'` if the user has already
 * uploaded {@link FREE_LIMITS.maxPdfs} PDFs.
 */
export async function checkUploadLimit(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  const usage = await getOrCreateUsage(userId, supabase)

  if (usage.pdfs_uploaded >= FREE_LIMITS.maxPdfs) {
    throw new LimitError(
      `Free tier limit: you can upload up to ${FREE_LIMITS.maxPdfs} PDFs. ` +
        `Upgrade coming soon!`,
      'PDF_LIMIT'
    )
  }
}

// ─── 2. checkMessageLimit ────────────────────────────────────────────────────

/**
 * Resets the daily message counter if `last_message_date` is not today, then
 * throws {@link LimitError} with code `'MESSAGE_LIMIT'` if the user has sent
 * {@link FREE_LIMITS.maxMessagesPerDay} messages today.
 */
export async function checkMessageLimit(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
  const usage = await getOrCreateUsage(userId, supabase)

  // New day → reset counter before checking
  if (usage.last_message_date !== today) {
    await supabase
      .from('usage')
      .update({ messages_sent_today: 0, last_message_date: today })
      .eq('user_id', userId)
    return // Fresh slate; no limit hit
  }

  if (usage.messages_sent_today >= FREE_LIMITS.maxMessagesPerDay) {
    throw new LimitError(
      `Free tier limit: ${FREE_LIMITS.maxMessagesPerDay} messages per day. ` +
        `Your count resets at midnight. Upgrade coming soon!`,
      'MESSAGE_LIMIT'
    )
  }
}

// ─── 3. incrementPdfCount ────────────────────────────────────────────────────

/**
 * Increments `pdfs_uploaded` by 1 and adds `bytes` to `bytes_stored`.
 * Call this after a successful document insert.
 */
export async function incrementPdfCount(
  userId: string,
  supabase: SupabaseClient,
  bytes: number
): Promise<void> {
  const usage = await getOrCreateUsage(userId, supabase)

  await supabase
    .from('usage')
    .update({
      pdfs_uploaded: usage.pdfs_uploaded + 1,
      bytes_stored: usage.bytes_stored + bytes,
    })
    .eq('user_id', userId)
}

// ─── 4. incrementMessageCount ────────────────────────────────────────────────

/**
 * Increments `messages_sent_today` by 1 and ensures `last_message_date` is
 * set to today (handles the day-rollover case atomically with the increment).
 * Call this after a user message is successfully saved.
 */
export async function incrementMessageCount(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const usage = await getOrCreateUsage(userId, supabase)

  const isNewDay = usage.last_message_date !== today
  const newCount = isNewDay ? 1 : usage.messages_sent_today + 1

  await supabase
    .from('usage')
    .update({ messages_sent_today: newCount, last_message_date: today })
    .eq('user_id', userId)
}

// ─── 5. getUserUsage ─────────────────────────────────────────────────────────

/**
 * Returns the current usage row for the user, creating it if it doesn't exist.
 * Safe to call from Server Components (pass the server-side supabase client).
 */
export async function getUserUsage(
  userId: string,
  supabase: SupabaseClient
): Promise<UserUsage> {
  return getOrCreateUsage(userId, supabase)
}
