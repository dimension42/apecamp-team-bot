import { TextChannel } from 'discord.js'

const DISCORD_LIMIT = 2000

// Discord 메시지 2000자 제한에 맞춰 줄 단위로 분할 전송한다. 내용 손실 없음.
// 한 줄이 한도를 넘으면 그 줄만 강제로 잘라 보낸다.
export async function sendLongMessage(channel: TextChannel, content: string): Promise<void> {
  if (content.length <= DISCORD_LIMIT) {
    await channel.send(content)
    return
  }

  const chunks: string[] = []
  let buf = ''
  for (const line of content.split('\n')) {
    if (line.length > DISCORD_LIMIT) {
      if (buf) { chunks.push(buf); buf = '' }
      for (let i = 0; i < line.length; i += DISCORD_LIMIT) {
        chunks.push(line.slice(i, i + DISCORD_LIMIT))
      }
      continue
    }
    if (buf.length + line.length + 1 > DISCORD_LIMIT) {
      chunks.push(buf)
      buf = line
    } else {
      buf = buf ? buf + '\n' + line : line
    }
  }
  if (buf) chunks.push(buf)

  for (const chunk of chunks) {
    await channel.send(chunk)
  }
}
