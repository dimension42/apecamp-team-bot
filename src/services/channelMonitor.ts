import { TextChannel, Message as DiscordMessage, Collection } from 'discord.js'
import { supabase } from '../supabase'

// Trigger thresholds
const SUMMARY_CHAR_THRESHOLD = 5000
const SUMMARY_TIME_MS = 15 * 60 * 1000       // 15 min
const BACKUP_TIME_MS = 60 * 60 * 1000         // 60 min
const BACKUP_MIN_CHARS = 1000
const REMINDER_CHAR_THRESHOLD = 5000
const REMINDER_TIME_MS = 15 * 60 * 1000       // 15 min

interface ChannelState {
  charsSinceSummary: number
  charsSinceReminder: number
  lastSummaryAt: number       // ms timestamp, 0 if never
  lastReminderAt: number      // ms timestamp, 0 if never
  lastSummaryMessageId: string | null
  initialized: boolean
}

const states = new Map<string, ChannelState>()

// Load state from Supabase on first message in a channel
async function initState(channelId: string): Promise<ChannelState> {
  const { data } = await supabase
    .from('team_channel_summaries')
    .select('*')
    .eq('channel_id', channelId)
    .single()

  const state: ChannelState = {
    charsSinceSummary: 0,
    charsSinceReminder: 0,
    lastSummaryAt: data?.last_summary_at ? new Date(data.last_summary_at).getTime() : 0,
    lastReminderAt: data?.last_reminder_at ? new Date(data.last_reminder_at).getTime() : 0,
    lastSummaryMessageId: data?.last_summary_message_id ?? null,
    initialized: true,
  }

  states.set(channelId, state)
  return state
}

export async function getState(channelId: string): Promise<ChannelState> {
  const existing = states.get(channelId)
  if (existing?.initialized) return existing
  return initState(channelId)
}

// Called on every new message
export async function onMessage(channelId: string, charCount: number) {
  const state = await getState(channelId)
  state.charsSinceSummary += charCount
  state.charsSinceReminder += charCount
}

export async function checkSummaryTrigger(channelId: string): Promise<boolean> {
  const state = await getState(channelId)
  const now = Date.now()

  const charsMet = state.charsSinceSummary >= SUMMARY_CHAR_THRESHOLD
  const timeMet = (now - state.lastSummaryAt) >= SUMMARY_TIME_MS

  if (charsMet && timeMet) return true

  // Backup: 60 min + at least 1000 chars
  const backupTimeMet = (now - state.lastSummaryAt) >= BACKUP_TIME_MS
  if (backupTimeMet && state.charsSinceSummary >= BACKUP_MIN_CHARS) return true

  return false
}

export async function checkReminderTrigger(channelId: string): Promise<boolean> {
  const state = await getState(channelId)
  const now = Date.now()

  const charsMet = state.charsSinceReminder >= REMINDER_CHAR_THRESHOLD
  const timeMet = (now - state.lastReminderAt) >= REMINDER_TIME_MS

  return charsMet || timeMet
}

export async function saveSummaryCheckpoint(channelId: string, lastMessageId: string) {
  const state = await getState(channelId)
  const now = Date.now()

  await supabase.from('team_channel_summaries').upsert(
    {
      channel_id: channelId,
      last_summary_at: new Date(now).toISOString(),
      last_summary_message_id: lastMessageId,
      last_reminder_at: new Date(now).toISOString(),
    },
    { onConflict: 'channel_id' }
  )

  state.charsSinceSummary = 0
  state.charsSinceReminder = 0
  state.lastSummaryAt = now
  state.lastReminderAt = now
  state.lastSummaryMessageId = lastMessageId
}

export async function saveReminderCheckpoint(channelId: string) {
  const state = await getState(channelId)
  const now = Date.now()

  await supabase.from('team_channel_summaries').upsert(
    {
      channel_id: channelId,
      last_reminder_at: new Date(now).toISOString(),
    },
    { onConflict: 'channel_id' }
  )

  state.charsSinceReminder = 0
  state.lastReminderAt = now
}

// Fetch all messages after a given message ID (or all if null)
export async function fetchMessagesSince(
  channel: TextChannel,
  afterMessageId: string | null
): Promise<{ author: string; content: string }[]> {
  const collected: DiscordMessage[] = []

  if (afterMessageId) {
    // Paginate forward using `after`
    let after: string = afterMessageId
    while (true) {
      const fetched = await channel.messages.fetch({ limit: 100, after })
      if (fetched.size === 0) break

      const sorted = [...fetched.values()].sort((a, b) => (a.id < b.id ? -1 : 1))
      collected.push(...sorted)
      after = sorted[sorted.length - 1].id

      if (fetched.size < 100) break
    }
  } else {
    // Paginate backward from latest, then reverse
    let before: string | undefined = undefined
    while (true) {
      const fetched: Collection<string, DiscordMessage> = await channel.messages.fetch({ limit: 100, before })
      if (fetched.size === 0) break

      collected.push(...fetched.values())
      before = fetched.last()?.id

      if (fetched.size < 100) break
    }
    collected.reverse()
  }

  return collected
    .filter((m) => !m.author.bot && m.content.trim().length > 0)
    .map((m) => ({
      author: m.author.globalName ?? m.author.username,
      content: m.content,
    }))
}
