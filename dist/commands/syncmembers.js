"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const supabase_1 = require("../supabase");
// 현재 서버 멤버 UID를 일괄로 discord_members에 등록(방장 전용).
// 주의: 현재 deploy-commands.ts / index.ts에 등록되어 있지 않음(미배선).
// 활성화하려면 deploy-commands에 data를 추가하고 index.ts InteractionCreate에서 라우팅할 것.
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('syncmembers')
    .setDescription('현재 서버 멤버 UID를 전부 DB에 등록합니다 (방장 전용)');
async function execute(interaction) {
    if (interaction.user.id !== interaction.guild?.ownerId) {
        await interaction.reply({ content: '❌ 방장만 사용할 수 있는 명령어입니다.', ephemeral: true });
        return;
    }
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const members = await guild.members.fetch();
    const nonBotMembers = members.filter((m) => !m.user.bot);
    const records = nonBotMembers.map((m) => ({
        discord_uid: m.id,
        username: m.user.username,
    }));
    const { error } = await supabase_1.supabase
        .from('discord_members')
        .upsert(records, { onConflict: 'discord_uid' });
    if (error) {
        await interaction.editReply(`❌ 동기화 실패: ${error.message}`);
        return;
    }
    await interaction.editReply(`✅ ${records.length}명 동기화 완료! (이미 등록된 멤버는 스킵됨)`);
}
