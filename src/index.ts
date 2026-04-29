import { Client, GatewayIntentBits, Events, Interaction, TextChannel } from 'discord.js'
import { execute as executeCreateRooms } from './commands/createrooms'
import { executeSummary } from './commands/summary'
import { execute as executeMission, handleMissionModal } from './commands/mission'
import { restoreTimer } from './services/timer'
import {
  checkSummaryTrigger,
  fetchMessagesSince,
  saveSummaryCheckpoint,
  getState,
  isRegisteredTeamChannel,
} from './services/channelMonitor'
import { summarizeMessages } from './services/openai'

console.log('🔍 ENV CHECK:')
console.log('  DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? '✅ set' : '❌ missing')
console.log('  DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? '✅ set' : '❌ missing')
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ set' : '❌ missing')
console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ set' : '❌ missing')
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ set' : '❌ missing')
console.log('  TRANSLATION_BOT_ID:', process.env.TRANSLATION_BOT_ID ? '✅ set' : '⚠️ not set (skipped)')

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

// 메시지 수신 → 15분 경과 시 자동 요약
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return
  if (!(message.channel instanceof TextChannel)) return

  const channel = message.channel
  // 1차 가드: Team-chat 카테고리만 허용 (DB 오염 대비)
  if (channel.parent?.name !== 'Team-chat') return
  // 2차 가드: /createrooms로 DB에 등록된 팀 채널만 허용
  if (!(await isRegisteredTeamChannel(channel.id))) return
  if (message.content.length === 0) return

  // 마지막 요약 후 15분 이상 지났으면 자동 요약
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
