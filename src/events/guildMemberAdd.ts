import { GuildMember } from 'discord.js'
import { supabase } from '../supabase'

// 신규 멤버 입장 시 Discord UID를 discord_members에 기록.
// 주의: 현재 index.ts에 이벤트로 등록되어 있지 않음(미배선). 실제 UID 수집은
// 홈페이지 Discord OAuth 콜백(profiles.discord_uid + discord_members upsert)이 전담.
// 봇 측 자동 수집을 활성화하려면 index.ts에서 Events.GuildMemberAdd에 이 핸들러를 연결할 것.
export async function handleGuildMemberAdd(member: GuildMember) {
  const discordUid = member.id
  const username = member.user.username

  const { error } = await supabase
    .from('discord_members')
    .upsert({ discord_uid: discordUid, username }, { onConflict: 'discord_uid' })

  if (error) {
    console.error(`❌ UID 저장 실패 (${username}):`, error.message)
  } else {
    console.log(`✅ UID 저장: ${username} (${discordUid})`)
  }
}
