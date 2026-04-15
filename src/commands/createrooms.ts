import {
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js'
import { supabase } from '../supabase'

export const data = new SlashCommandBuilder()
  .setName('createrooms')
  .setDescription('팀별 프라이빗 채널을 생성합니다 (방장 전용)')
  .addStringOption((option) =>
    option.setName('run_id').setDescription('팀 매칭 Run ID').setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('day').setDescription('Day 구분 (예: Day1, Day2)').setRequired(true)
  )

export async function execute(interaction: ChatInputCommandInteraction) {
  // 방장(서버 소유자)만 실행 가능
  if (interaction.user.id !== interaction.guild?.ownerId) {
    await interaction.reply({ content: '❌ 방장만 사용할 수 있는 명령어입니다.', ephemeral: true })
    return
  }

  const runId = interaction.options.getString('run_id', true)
  const day = interaction.options.getString('day', true)

  await interaction.deferReply({ ephemeral: true })

  const guild = interaction.guild!

  // Team-chat 카테고리 찾기
  const category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === 'Team-chat'
  )

  if (!category) {
    await interaction.editReply('❌ `Team-chat` 카테고리를 찾을 수 없습니다.')
    return
  }

  // DB에서 팀 배정 + 프로필 + 디스코드 UID 조회
  const { data: assignments, error } = await supabase
    .from('team_assignments')
    .select(`
      team_number,
      profiles!inner(activity_name, real_name, user_id),
      discord_members!left(discord_uid)
    `)
    .eq('run_id', runId)
    .order('team_number')

  if (error || !assignments || assignments.length === 0) {
    await interaction.editReply(`❌ 팀 데이터를 불러오지 못했습니다. run_id를 확인해주세요.\n\`${error?.message ?? '결과 없음'}\``)
    return
  }

  // 팀별로 그룹핑
  const teams = new Map<number, { activityName: string; discordUid: string | null }[]>()
  for (const row of assignments as any[]) {
    const teamNum = row.team_number
    if (!teams.has(teamNum)) teams.set(teamNum, [])
    teams.get(teamNum)!.push({
      activityName: row.profiles?.activity_name ?? row.profiles?.real_name ?? '알수없음',
      discordUid: row.discord_members?.discord_uid ?? null,
    })
  }

  let created = 0
  let skipped = 0

  for (const [teamNum, members] of teams) {
    const channelName = `team${teamNum}-${day.toLowerCase()}`

    // 이미 존재하는 채널 스킵
    const exists = guild.channels.cache.find((c) => c.name === channelName)
    if (exists) {
      skipped++
      continue
    }

    // 채널에 접근 허용할 멤버 권한 설정
    const permissionOverwrites: any[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
    ]

    for (const member of members) {
      if (member.discordUid) {
        permissionOverwrites.push({
          id: member.discordUid,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        })
      }
    }

    await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites,
    })

    created++
  }

  const unmatched = [...teams.values()]
    .flat()
    .filter((m) => !m.discordUid)
    .map((m) => m.activityName)

  let reply = `✅ 채널 생성 완료!\n- 생성됨: ${created}개\n- 스킵(이미 존재): ${skipped}개`
  if (unmatched.length > 0) {
    reply += `\n\n⚠️ 디스코드 미연동 참가자 (채널에 추가 안 됨):\n${unmatched.join(', ')}`
  }

  await interaction.editReply(reply)
}
