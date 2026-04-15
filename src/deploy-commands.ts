import { REST, Routes } from 'discord.js'
import { data as createRoomsData } from './commands/createrooms'
import { data as syncMembersData } from './commands/syncmembers'

const token = process.env.DISCORD_BOT_TOKEN!
const clientId = process.env.DISCORD_CLIENT_ID!

const rest = new REST().setToken(token)

;(async () => {
  console.log('슬래시 커맨드 등록 중...')
  await rest.put(Routes.applicationCommands(clientId), {
    body: [createRoomsData.toJSON(), syncMembersData.toJSON()],
  })
  console.log('✅ /createrooms, /syncmembers 커맨드 등록 완료!')
})()
