"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const createrooms_1 = require("./commands/createrooms");
const summary_1 = require("./commands/summary");
const channelMonitor_1 = require("./services/channelMonitor");
const openai_1 = require("./services/openai");
console.log('🔍 ENV CHECK:');
console.log('  DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? '✅ set' : '❌ missing');
console.log('  DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? '✅ set' : '❌ missing');
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ set' : '❌ missing');
console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ set' : '❌ missing');
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ set' : '❌ missing');
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
    console.error('❌ DISCORD_BOT_TOKEN is not set');
    process.exit(1);
}
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMembers,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
});
client.once(discord_js_1.Events.ClientReady, (c) => {
    console.log(`✅ Logged in as ${c.user.tag}`);
});
// 메시지 수신 → 글자 수 누적 + 트리거 체크
client.on(discord_js_1.Events.MessageCreate, async (message) => {
    // 봇 메시지 무시
    if (message.author.bot)
        return;
    // team_channel_summaries에 등록된 채널만 처리
    const channel = message.channel;
    const charCount = message.content.length;
    if (charCount === 0)
        return;
    await (0, channelMonitor_1.onMessage)(channel.id, charCount);
    // 자동 요약 체크 (AND 조건) — 요약이 트리거되면 리마인더는 건너뜀
    if (await (0, channelMonitor_1.checkSummaryTrigger)(channel.id)) {
        const state = await (0, channelMonitor_1.getState)(channel.id);
        const messages = await (0, channelMonitor_1.fetchMessagesSince)(channel, state.lastSummaryMessageId);
        if (messages.length > 0) {
            const summary = await (0, openai_1.summarizeMessages)(messages);
            const latestFetched = await channel.messages.fetch({ limit: 1 });
            const latestId = latestFetched.first()?.id;
            if (latestId) {
                await (0, channelMonitor_1.saveSummaryCheckpoint)(channel.id, latestId);
            }
            await channel.send(`📋 **Conversation Summary**\n\n${summary}`);
        }
        // 리마인더 체크 (OR 조건) — 요약이 없을 때만
    }
    else if (await (0, channelMonitor_1.checkReminderTrigger)(channel.id)) {
        await (0, channelMonitor_1.saveReminderCheckpoint)(channel.id);
        await channel.send('* Type /summary anytime to see a summary of previous conversations.');
    }
});
// 슬래시 커맨드 처리
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    if (interaction.commandName === 'createrooms') {
        await (0, createrooms_1.execute)(interaction);
    }
    if (interaction.commandName === 'summary' || interaction.commandName === '요약') {
        await (0, summary_1.executeSummary)(interaction);
    }
});
client.login(token);
