import { REST, Routes } from 'discord.js'
import { data as createRoomsData } from './commands/createrooms'
import { summaryData, yoyakData } from './commands/summary'
import { data as missionData } from './commands/mission'

const token = process.env.DISCORD_BOT_TOKEN
const clientId = process.env.DISCORD_CLIENT_ID
// 길드 ID를 지정하면 해당 길드에만 즉시 등록(전파 지연 없음). 미지정 시 글로벌 등록(최대 1시간 전파).
const guildId = process.env.DISCORD_GUILD_ID

if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN is not set')
  process.exit(1)
}
if (!clientId) {
  console.error('❌ DISCORD_CLIENT_ID is not set')
  process.exit(1)
}

const rest = new REST().setToken(token)

;(async () => {
  const body = [
    createRoomsData.toJSON(),
    summaryData.toJSON(),
    yoyakData.toJSON(),
    missionData.toJSON(),
  ]

  if (guildId) {
    console.log(`슬래시 커맨드 등록 중... (길드 ${guildId} — 즉시 반영)`)
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body })
    console.log('✅ /createrooms, /summary, /요약, /mission 길드 커맨드 등록 완료! (즉시 사용 가능)')
  } else {
    console.log('슬래시 커맨드 등록 중... (글로벌 — 전파에 최대 1시간 소요)')
    await rest.put(Routes.applicationCommands(clientId), { body })
    console.log('✅ /createrooms, /summary, /요약, /mission 글로벌 커맨드 등록 완료! (전파 최대 1시간)')
    console.log('   ⏱️ 즉시 반영하려면 DISCORD_GUILD_ID 환경변수를 설정하고 다시 실행하세요.')
  }
})().catch((e) => {
  console.error('❌ 커맨드 등록 실패:', e)
  process.exit(1)
})
