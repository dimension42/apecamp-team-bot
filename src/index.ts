import { Client, GatewayIntentBits, Events, Interaction, TextChannel } from 'discord.js'
import { execute as executeCreateRooms } from './commands/createrooms'
import { executeSummary } from './commands/summary'
import { execute as executeMission, handleMissionModal } from './commands/mission'
import { restoreTimer } from './services/timer'
import {
  onMessage,
  checkSummaryTrigger,
  checkReminderTrigger,
  fetchMessagesSince,
  saveSummaryCheckpoint,
  saveReminderCheckpoint,
  getState,
} from './services/channelMonitor'
import { summarizeMessages } from './services/openai'

console.log('🔍 ENV CHECK:')
console.log('  DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? '✅ set' : '❌ missing')
console.log('  DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? '✅ set' : '❌ missing')
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ set' : '❌ missing')
console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ set' : '❌ missing')
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ set' : '❌ missing')

const token = process.env.DISCORD_BOT_TOKEN
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN is not set')
  process.exit(1)
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`)
  // 재시작 시 진행 중인 타이머 복구
  await restoreTimer(client)
})

// 메시지 수신 → 글자 수 누적 + 트리거 체크
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return

  const channel = message.channel as TextChannel
  const charCount = message.content.length
  if (charCount === 0) return

  await onMessage(channel.id, charCount)

  // 자동 요약 체크 (AND 조건) — 요약이 트리거되면 리마인더는 건너뜀
  if (await checkSummaryTrigger(channel.id)) {
    const state = await getState(channel.id)
    const messages = await fetchMessagesSince(channel, state.lastSummaryMessageId)

    if (messages.length > 0) {
      const summary = await summarizeMessages(messages)
      const latestFetched = await channel.messages.fetch({ limit: 1 })
      const latestId = latestFetched.first()?.id
      if (latestId) await saveSummaryCheckpoint(channel.id, latestId)
      await channel.send(`📋 **Conversation Summary**\n\n${summary}`)
    }
  // 리마인더 체크 (OR 조건) — 요약이 없을 때만
  } else if (await checkReminderTrigger(channel.id)) {
    await saveReminderCheckpoint(channel.id)
    await channel.send('* Type /summary (or /요약) anytime to see a summary of previous conversations.')
  }
})

// 슬래시 커맨드 + 모달 처리
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  // 슬래시 커맨드
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'createrooms') await executeCreateRooms(interaction)
    if (interaction.commandName === 'summary' || interaction.commandName === '요약') await executeSummary(interaction)
    if (interaction.commandName === 'mission') await executeMission(interaction)
  }

  // 모달 제출
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'missionTimerModal') await handleMissionModal(interaction, client)
  }
})

client.login(token)
