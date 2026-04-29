import { TextChannel, Message as DiscordMessage, Collection } from 'discord.js'
import { supabase } from '../supabase'

const SUMMARY_INTERVAL_MS = 15 * 60 * 1000  // 15분마다 자동 요약

interface ChannelState {
  lastSummaryAt: number
  lastSummaryMessageId: string | null
  initialized: boolean
}

const states = new Map<string, ChannelState>()

// /createrooms로 등록된 팀 채널인지 DB로 검증
export async function isRegisteredTeamChannel(channelId: string): Promise<boolean> {
  const { data } = await supabase
    .from('team_channel_summaries')
    .select('channel_id')
    .eq('channel_id', channelId)
    .single()
  return !!data
}

async function initState(channelId: string): Promise<ChannelState> {
  const { data } = await supabase
    .from('team_channel_summaries')
    .select('*')
    .eq('channel_id', channelId)
    .single()

  // last_summary_at이 NULL이면 지금 시각 기준 (첫 메시지에 즉시 요약 방지)
  const state: ChannelState = {
    lastSummaryAt: data?.last_summary_at ? new Date(data.last_summary_at).getTime() : Date.now(),
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

export async function checkSummaryTrigger(channelId: string): Promise<boolean> {
  const state = await getState(channelId)
  return (Date.now() - state.lastSummaryAt) >= SUMMARY_INTERVAL_MS
}

export async function saveSummaryCheckpoint(channelId: string, lastMessageId: string) {
  const state = await getState(channelId)
  const now = Date.now()

  await supabase.from('team_channel_summaries').upsert(
    {
      channel_id: channelId,
      last_summary_at: new Date(now).toISOString(),
      last_summary_message_id: lastMessageId,
    },
    { onConflict: 'channel_id' }
  )

  state.lastSummaryAt = now
  state.lastSummaryMessageId = lastMessageId
}

// Fetch all messages after a given message ID (or all if null)
export async function fetchMessagesSince(
  channel: TextChannel,
  afterMessageId: string | null
): Promise<{ author: string; content: string }[]> {
  const collected: DiscordMessage[] = []

  if (afterMessageId) {
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
