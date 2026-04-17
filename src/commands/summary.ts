import { ChatInputCommandInteraction, TextChannel, SlashCommandBuilder } from 'discord.js'
import { summarizeMessages } from '../services/openai'
import {
  fetchMessagesSince,
  saveSummaryCheckpoint,
  getState,
} from '../services/channelMonitor'

export const summaryData = new SlashCommandBuilder()
  .setName('summary')
  .setDescription('Get a summary of the conversation since the last summary')

export const yoyakData = new SlashCommandBuilder()
  .setName('요약')
  .setDescription('마지막 요약 이후 대화 내용을 요약합니다')

// Shared logic for both /summary and /요약
export async function executeSummary(interaction: ChatInputCommandInteraction) {
  const channel = interaction.channel as TextChannel

  // /createrooms로 생성된 팀 채널(team{N}-day{M})에서만 허용
  if (!/^team\d+-day\d+$/i.test(channel.name)) {
    await interaction.reply({ content: '❌ 이 명령어는 팀 채널에서만 사용할 수 있습니다.', ephemeral: true })
    return
  }

  await interaction.deferReply()

  const state = await getState(channel.id)
  const messages = await fetchMessagesSince(channel, state.lastSummaryMessageId)

  if (messages.length === 0) {
    await interaction.editReply('No new messages to summarize since the last summary.')
    return
  }

  const summary = await summarizeMessages(messages)

  // Use the last fetched message as new checkpoint
  const latestFetched = await channel.messages.fetch({ limit: 1 })
  const latestId = latestFetched.first()?.id
  if (latestId) {
    await saveSummaryCheckpoint(channel.id, latestId)
  }

  // channel.send()으로 보내야 번역봇이 MessageCreate 이벤트를 잡을 수 있음
  await interaction.deleteReply()
  await channel.send(`📋 **Conversation Summary**\n\n${summary}`)
}
