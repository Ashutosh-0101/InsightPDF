import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserUsage } from '@/types'

export const FREE_LIMITS = {
  maxPdfs: 3,
  maxMessagesPerDay: 30,
  maxStorageBytes: 50_000_000, // 50 MB
} as const

export class LimitError extends Error {
  constructor(
    message: string,
    public readonly code: 'PDF_LIMIT' | 'MESSAGE_LIMIT' | 'STORAGE_LIMIT'
  ) {
    super(message)
    this.name = 'LimitError'
  }
}

const EMPTY_USAGE: UserUsage = {
  id: '',
  user_id: '',
  pdfs_uploaded: 0,
  messages_sent_today: 0,
  last_message_date: null,
  bytes_stored: 0,
}

/**
 * Returns the usage row for `userId`, creating it on first access.
 * Throws a descriptive Error if the row cannot be read or created
 * (e.g. the `usage` table does not exist in this Supabase project).
 */
async function getOrCreateUsage(
  userId: string,
  supabase: SupabaseClient
): Promise<UserUsage> {
  const { data: existing, error: getError } = await supabase
    .from('usage')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return existing as UserUsage

  if (getError) {
    throw new Error(`[limits] usage select failed: ${getError.message}`)
  }

  const { data: created, error: insertError } = await supabase
    .from('usage')
    .insert({
      user_id: userId,
      pdfs_uploaded: 0,
      messages_sent_today: 0,
      bytes_stored: 0,
    })
    .select('*')
    .single()

  if (insertError || !created) {
    throw new Error(
      `[limits] usage insert failed: ${insertError?.message ?? 'no data returned'}`
    )
  }

  return created as UserUsage
}

// ─── 1. checkUploadLimit ─────────────────────────────────────────────────────

export async function checkUploadLimit(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  let usage: UserUsage
  try {
    usage = await getOrCreateUsage(userId, supabase)
  } catch (err) {
    console.error('[limits] checkUploadLimit skipped:', (err as Error).message)
    return
  }

  if (usage.pdfs_uploaded >= FREE_LIMITS.maxPdfs) {
    throw new LimitError(
      `Free tier limit: you can upload up to ${FREE_LIMITS.maxPdfs} PDFs. Upgrade coming soon!`,
      'PDF_LIMIT'
    )
  }
}

// ─── 2. checkMessageLimit ────────────────────────────────────────────────────

export async function checkMessageLimit(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  let usage: UserUsage
  try {
    usage = await getOrCreateUsage(userId, supabase)
  } catch (err) {
    console.error('[limits] checkMessageLimit skipped:', (err as Error).message)
    return
  }

  const today = new Date().toISOString().slice(0, 10)

  if (usage.last_message_date !== today) {
    await supabase
      .from('usage')
      .update({ messages_sent_today: 0, last_message_date: today })
      .eq('user_id', userId)
    return
  }

  if (usage.messages_sent_today >= FREE_LIMITS.maxMessagesPerDay) {
    throw new LimitError(
      `Free tier limit: ${FREE_LIMITS.maxMessagesPerDay} messages per day. Resets at midnight. Upgrade coming soon!`,
      'MESSAGE_LIMIT'
    )
  }
}

// ─── 3. incrementPdfCount ────────────────────────────────────────────────────

export async function incrementPdfCount(
  userId: string,
  supabase: SupabaseClient,
  bytes: number
): Promise<void> {
  let usage: UserUsage
  try {
    usage = await getOrCreateUsage(userId, supabase)
  } catch (err) {
    console.error('[limits] incrementPdfCount skipped:', (err as Error).message)
    return
  }

  await supabase
    .from('usage')
    .update({
      pdfs_uploaded: usage.pdfs_uploaded + 1,
      bytes_stored: usage.bytes_stored + bytes,
    })
    .eq('user_id', userId)
}

// ─── 4. incrementMessageCount ────────────────────────────────────────────────

export async function incrementMessageCount(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  let usage: UserUsage
  try {
    usage = await getOrCreateUsage(userId, supabase)
  } catch (err) {
    console.error('[limits] incrementMessageCount skipped:', (err as Error).message)
    return
  }

  const today = new Date().toISOString().slice(0, 10)
  const isNewDay = usage.last_message_date !== today

  await supabase
    .from('usage')
    .update({
      messages_sent_today: isNewDay ? 1 : usage.messages_sent_today + 1,
      last_message_date: today,
    })
    .eq('user_id', userId)
}

// ─── 5. getUserUsage ─────────────────────────────────────────────────────────

export async function getUserUsage(
  userId: string,
  supabase: SupabaseClient
): Promise<UserUsage> {
  try {
    return await getOrCreateUsage(userId, supabase)
  } catch (err) {
    console.error('[limits] getUserUsage skipped:', (err as Error).message)
    return { ...EMPTY_USAGE, user_id: userId }
  }
}
