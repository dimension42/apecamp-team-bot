import { REST, Routes } from 'discord.js'
import { data } from './commands/createrooms'

const token = process.env.DISCORD_BOT_TOKEN!
const clientId = process.env.DISCORD_CLIENT_ID!

const rest = new REST().setToken(token)

;(async () => {
  console.log('슬래시 커맨드 등록 중...')
  await rest.put(Routes.applicationCommands(clientId), {
    body: [data.toJSON()],
  })
  console.log('✅ /createrooms 커맨드 등록 완료!')
})()
