import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { supabase } from '../supabase'

export const data = new SlashCommandBuilder()
  .setName('syncmembers')
  .setDescription('현재 서버 멤버 UID를 전부 DB에 등록합니다 (방장 전용)')

export async function execute(interaction: ChatInputCommandInteraction) {
  if (interaction.user.id !== interaction.guild?.ownerId) {
    await interaction.reply({ content: '❌ 방장만 사용할 수 있는 명령어입니다.', ephemeral: true })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  const guild = interaction.guild!
  const members = await guild.members.fetch()
  const nonBotMembers = members.filter((m) => !m.user.bot)

  const records = nonBotMembers.map((m) => ({
    discord_uid: m.id,
    username: m.user.username,
  }))

  const { error } = await supabase
    .from('discord_members')
    .upsert(records, { onConflict: 'discord_uid' })

  if (error) {
    await interaction.editReply(`❌ 동기화 실패: ${error.message}`)
    return
  }

  await interaction.editReply(`✅ ${records.length}명 동기화 완료! (이미 등록된 멤버는 스킵됨)`)
}
