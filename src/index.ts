import { Client, GatewayIntentBits, Events, Interaction } from 'discord.js'
import { handleGuildMemberAdd } from './events/guildMemberAdd'
import { execute as executeCreateRooms } from './commands/createrooms'

console.log('🔍 ENV CHECK:')
console.log('  DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? '✅ set' : '❌ missing')
console.log('  DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? '✅ set' : '❌ missing')
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ set' : '❌ missing')
console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ set' : '❌ missing')

const token = process.env.DISCORD_BOT_TOKEN
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN is not set')
  process.exit(1)
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
})

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`)
})

// 서버 입장 시 UID 자동 수집
client.on(Events.GuildMemberAdd, handleGuildMemberAdd)

// 슬래시 커맨드 처리
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return

  if (interaction.commandName === 'createrooms') {
    await executeCreateRooms(interaction)
  }
})

client.login(token)
