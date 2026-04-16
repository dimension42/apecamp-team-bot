import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  ModalSubmitInteraction,
  Client,
} from 'discord.js'
import { parseEndTime, startTimer, formatKST } from '../services/timer'

export const data = new SlashCommandBuilder()
  .setName('mission')
  .setDescription('미션 종료 타이머를 설정합니다 (관리자 전용)')

export async function execute(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('missionTimerModal')
    .setTitle('🎯 미션 종료 타이머 설정')

  const timeInput = new TextInputBuilder()
    .setCustomId('endTime')
    .setLabel('종료 시간')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 18:00')
    .setRequired(true)

  const formatInput = new TextInputBuilder()
    .setCustomId('submissionFormat')
    .setLabel('제출 포맷')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: PDF, PPT, ZIP')
    .setRequired(true)

  const methodInput = new TextInputBuilder()
    .setCustomId('submissionMethod')
    .setLabel('제출 방법')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('예: #제출 채널에 파일을 업로드해주세요.')
    .setRequired(true)

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(timeInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(formatInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(methodInput)
  )

  await interaction.showModal(modal)
}

export async function handleMissionModal(interaction: ModalSubmitInteraction, client: Client) {
  const timeStr = interaction.fields.getTextInputValue('endTime')
  const submissionFormat = interaction.fields.getTextInputValue('submissionFormat')
  const submissionMethod = interaction.fields.getTextInputValue('submissionMethod')

  await interaction.deferReply({ ephemeral: true })

  try {
    const endTime = parseEndTime(timeStr)
    await startTimer({ endTime, submissionFormat, submissionMethod, client })
    await interaction.editReply(
      `✅ 미션 종료 타이머가 **${formatKST(endTime)}**으로 설정됐습니다. 모든 팀 채널에 알림을 보내기 시작합니다.`
    )
  } catch (error: any) {
    await interaction.editReply(`❌ ${error.message}`)
  }
}
