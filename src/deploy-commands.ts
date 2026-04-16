import { REST, Routes } from 'discord.js'
import { data as createRoomsData } from './commands/createrooms'
import { summaryData, yoyakData } from './commands/summary'

const token = process.env.DISCORD_BOT_TOKEN!
const clientId = process.env.DISCORD_CLIENT_ID!

const rest = new REST().setToken(token)

;(async () => {
  console.log('슬래시 커맨드 등록 중...')
  await rest.put(Routes.applicationCommands(clientId), {
    body: [
      createRoomsData.toJSON(),
      summaryData.toJSON(),
      yoyakData.toJSON(),
    ],
  })
  console.log('✅ /createrooms, /summary, /요약 커맨드 등록 완료!')
})()
