"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const guildMemberAdd_1 = require("./events/guildMemberAdd");
const createrooms_1 = require("./commands/createrooms");
console.log('🔍 ENV CHECK:');
console.log('  DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? '✅ set' : '❌ missing');
console.log('  DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? '✅ set' : '❌ missing');
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ set' : '❌ missing');
console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ set' : '❌ missing');
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
    console.error('❌ DISCORD_BOT_TOKEN is not set');
    process.exit(1);
}
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMembers,
    ],
});
client.once(discord_js_1.Events.ClientReady, (c) => {
    console.log(`✅ Logged in as ${c.user.tag}`);
});
// 서버 입장 시 UID 자동 수집
client.on(discord_js_1.Events.GuildMemberAdd, guildMemberAdd_1.handleGuildMemberAdd);
// 슬래시 커맨드 처리
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    if (interaction.commandName === 'createrooms') {
        await (0, createrooms_1.execute)(interaction);
    }
});
client.login(token);
