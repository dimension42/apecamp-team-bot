import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  Client,
} from 'discord.js'
import { parseEndTime, startTimer, formatKST } from '../services/timer'

export const data = new SlashCommandBuilder()
  .setName('mission')
  .setDescription('미션 종료 타이머를 설정합니다 (관리자 전용)')
  // 길드 권한 게이트: ManageGuild 권한이 없는 멤버에게는 명령어 자체가 보이지 않음
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

export async function execute(interaction: ChatInputCommandInteraction) {
  // 방장(서버 소유자)만 실행 가능 — createrooms와 동일한 가드
  if (interaction.user.id !== interaction.guild?.ownerId) {
    await interaction.reply({ content: '❌ 방장만 사용할 수 있는 명령어입니다.', ephemeral: true })
    return
  }

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
