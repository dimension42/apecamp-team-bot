"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yoyakOnData = exports.summaryOnData = exports.yoyakOffData = exports.summaryOffData = void 0;
exports.executeSummaryToggle = executeSummaryToggle;
const discord_js_1 = require("discord.js");
const channelMonitor_1 = require("../services/channelMonitor");
// 자동 요약 끄기 (영문/국문)
exports.summaryOffData = new discord_js_1.SlashCommandBuilder()
    .setName('summary-off')
    .setDescription('Disable automatic summaries in this channel');
exports.yoyakOffData = new discord_js_1.SlashCommandBuilder()
    .setName('요약끄기')
    .setDescription('이 채널에서 자동 요약을 끕니다');
// 자동 요약 켜기 (영문/국문)
exports.summaryOnData = new discord_js_1.SlashCommandBuilder()
    .setName('summary-on')
    .setDescription('Re-enable automatic summaries in this channel');
exports.yoyakOnData = new discord_js_1.SlashCommandBuilder()
    .setName('요약켜기')
    .setDescription('이 채널에서 자동 요약을 다시 켭니다');
// /요약끄기·/요약켜기·/summary-off·/summary-on 공통 처리
async function executeSummaryToggle(interaction, enabled) {
    const channel = interaction.channel;
    // 채널이 없거나 TextChannel이 아닌 경우 차단
    if (!channel || !(channel instanceof discord_js_1.TextChannel)) {
        await interaction.reply({ content: '❌ 이 명령어는 팀 채널에서만 사용할 수 있습니다.', ephemeral: true });
        return;
    }
    // /summary와 동일한 가드: Team-chat 카테고리 + DB 등록된 팀 채널만
    if (channel.parent?.name !== 'Team-chat' || !(await (0, channelMonitor_1.isRegisteredTeamChannel)(channel.id))) {
        await interaction.reply({ content: '❌ 이 명령어는 팀 채널에서만 사용할 수 있습니다.', ephemeral: true });
        return;
    }
    try {
        await (0, channelMonitor_1.setSummaryEnabled)(channel.id, enabled);
    }
    catch (err) {
        console.error(`❌ 요약 토글 실패 (channel ${channel.id}):`, err?.message ?? err);
        await interaction.reply({ content: '❌ 설정 저장에 실패했습니다. 잠시 후 다시 시도해주세요.', ephemeral: true });
        return;
    }
    // ephemeral: 명령 실행자에게만 보이고 채널을 더럽히지 않음 (요약봇·번역봇 대상 아님)
    await interaction.reply({
        content: enabled
            ? '✅ 이 채널의 **자동 요약을 다시 켰습니다.** (`/요약` 으로 즉시 요약도 가능합니다.)'
            : '🔕 이 채널의 **자동 요약을 껐습니다.** 다시 켜려면 `/요약켜기` 를 입력하세요. (필요하면 `/요약` 으로 그때그때 요약은 계속 가능합니다.)',
        ephemeral: true,
    });
}
