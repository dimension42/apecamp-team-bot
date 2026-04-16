import { Client, TextChannel } from 'discord.js'
import { supabase } from '../supabase'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

// 활성 타이머 ID 목록 (덮어쓰기 시 취소용)
const activeTimeouts: NodeJS.Timeout[] = []

export function parseEndTime(timeStr: string): Date {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) throw new Error('올바른 시간 형식이 아닙니다. (예: 18:00)')

  const hours = parseInt(match[1])
  const minutes = parseInt(match[2])

  if (hours > 23 || minutes > 59) throw new Error('올바른 시간을 입력해주세요.')

  // 현재 UTC 기준으로 오늘 KST 날짜 계산
  const now = new Date()
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS)

  // KST 종료 시각 생성
  const endKST = new Date(kstNow)
  endKST.setUTCHours(hours, minutes, 0, 0)

  // UTC로 변환
  const endUTC = new Date(endKST.getTime() - KST_OFFSET_MS)

  if (endUTC <= now) throw new Error('이미 지난 시간입니다. 올바른 종료 시간을 입력해주세요.')

  return endUTC
}

export function formatKST(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS)
  const hh = kst.getUTCHours().toString().padStart(2, '0')
  const mm = kst.getUTCMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

async function getTeamChannels(client: Client): Promise<TextChannel[]> {
  const { data } = await supabase.from('team_channel_summaries').select('channel_id')
  if (!data || data.length === 0) return []

  const channels: TextChannel[] = []
  for (const row of data) {
    try {
      const ch = await client.channels.fetch(row.channel_id)
      if (ch instanceof TextChannel) channels.push(ch)
    } catch {
      // 채널이 삭제됐을 경우 무시
    }
  }
  return channels
}

async function sendToAllTeams(client: Client, message: string) {
  const channels = await getTeamChannels(client)
  await Promise.all(channels.map((ch) => ch.send(message)))
}

function cancelAllTimers() {
  for (const t of activeTimeouts) clearTimeout(t)
  activeTimeouts.length = 0
}

function schedule(delay: number, fn: () => Promise<void>) {
  if (delay <= 0) return
  const t = setTimeout(() => { fn().catch(console.error) }, delay)
  activeTimeouts.push(t)
}

export interface TimerConfig {
  endTime: Date
  submissionFormat: string
  submissionMethod: string
  client: Client
}

export async function startTimer(config: TimerConfig) {
  const { endTime, submissionFormat, submissionMethod, client } = config

  cancelAllTimers()

  // Supabase에 저장 (재시작 시 복구용)
  await supabase.from('mission_timer').upsert(
    {
      id: 1,
      end_time: endTime.toISOString(),
      submission_format: submissionFormat,
      submission_method: submissionMethod,
    },
    { onConflict: 'id' }
  )

  const now = Date.now()
  const endMs = endTime.getTime()
  const remainingMs = endMs - now

  const submissionInfo = `\n\n📎 제출 포맷: ${submissionFormat}\n📋 제출 방법: ${submissionMethod}`

  // 즉시 알림
  const totalHours = Math.floor(remainingMs / (60 * 60 * 1000))
  const remainingMins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000))

  const immediateMsg =
    totalHours > 0
      ? `⏰ 미션 종료까지 ${totalHours}시간${remainingMins > 0 ? ` ${remainingMins}분` : ''} 남았습니다.`
      : `⏰ 미션 종료까지 ${remainingMins}분 남았습니다.`

  await sendToAllTeams(client, immediateMsg)

  // 시간 단위 알림 (totalHours-1 → 1시간 정각)
  for (let h = totalHours - 1; h >= 1; h--) {
    const delay = endMs - h * 60 * 60 * 1000 - now
    const hours = h
    schedule(delay, async () => {
      const msg = `⏰ 미션 종료까지 ${hours}시간 남았습니다.` + (hours === 1 ? submissionInfo : '')
      await sendToAllTeams(client, msg)
    })
  }

  // 1시간 이내 알림
  for (const mins of [30, 10, 5, 1]) {
    const delay = endMs - mins * 60 * 1000 - now
    const m = mins
    schedule(delay, async () => {
      await sendToAllTeams(client, `⏰ 미션 종료까지 ${m}분 남았습니다.${submissionInfo}`)
    })
  }

  // 종료 알림
  schedule(endMs - now, async () => {
    await sendToAllTeams(
      client,
      '🚨 미션 타이머 종료! 제출 시간이 만료되었습니다. 제한 시간 내에 결과물 제출을 못 한 팀은 현장에서 직접 말씀해주시길 바랍니다.'
    )
    await supabase.from('mission_timer').delete().eq('id', 1)
  })

  console.log(`✅ 미션 타이머 설정: ${formatKST(endTime)} KST`)
}

// 봇 재시작 시 타이머 복구
export async function restoreTimer(client: Client) {
  const { data } = await supabase.from('mission_timer').select('*').eq('id', 1).single()
  if (!data) return

  const endTime = new Date(data.end_time)
  if (endTime <= new Date()) {
    await supabase.from('mission_timer').delete().eq('id', 1)
    return
  }

  await startTimer({
    endTime,
    submissionFormat: data.submission_format,
    submissionMethod: data.submission_method,
    client,
  })

  console.log(`🔄 타이머 복구됨: ${formatKST(endTime)} KST`)
}
