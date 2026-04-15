import { GuildMember } from 'discord.js'
import { supabase } from '../supabase'

export async function handleGuildMemberAdd(member: GuildMember) {
  const discordUid = member.id
  const username = member.user.username

  const { error } = await supabase
    .from('discord_members')
    .upsert(
      { discord_uid: discordUid, username },
      { onConflict: 'discord_uid' }
    )

  if (error) {
    console.error(`❌ UID 저장 실패 (${username}):`, error.message)
  } else {
    console.log(`✅ UID 저장: ${username} (${discordUid})`)
  }
}
