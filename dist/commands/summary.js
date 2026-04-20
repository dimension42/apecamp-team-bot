"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yoyakData = exports.summaryData = void 0;
exports.executeSummary = executeSummary;
const discord_js_1 = require("discord.js");
const openai_1 = require("../services/openai");
const channelMonitor_1 = require("../services/channelMonitor");
exports.summaryData = new discord_js_1.SlashCommandBuilder()
    .setName('summary')
    .setDescription('Get a summary of the conversation since the last summary');
exports.yoyakData = new discord_js_1.SlashCommandBuilder()
    .setName('요약')
    .setDescription('마지막 요약 이후 대화 내용을 요약합니다');
// Shared logic for both /summary and /요약
async function executeSummary(interaction) {
    const channel = interaction.channel;
    // 채널이 없거나 TextChannel이 아닌 경우 차단
    if (!channel || !(channel instanceof discord_js_1.TextChannel)) {
        await interaction.reply({ content: '❌ 이 명령어는 팀 채널에서만 사용할 수 있습니다.', ephemeral: true });
        return;
    }
    // /createrooms로 DB에 등록된 팀 채널인지 검증 (이름만으로는 우회 가능)
    if (!(await (0, channelMonitor_1.isRegisteredTeamChannel)(channel.id))) {
        await interaction.reply({ content: '❌ 이 명령어는 팀 채널에서만 사용할 수 있습니다.', ephemeral: true });
        return;
    }
    await interaction.deferReply();
    const state = await (0, channelMonitor_1.getState)(channel.id);
    const messages = await (0, channelMonitor_1.fetchMessagesSince)(channel, state.lastSummaryMessageId);
    if (messages.length === 0) {
        await interaction.editReply('No new messages to summarize since the last summary.');
        return;
    }
    const summary = await (0, openai_1.summarizeMessages)(messages);
    // Use the last fetched message as new checkpoint
    const latestFetched = await channel.messages.fetch({ limit: 1 });
    const latestId = latestFetched.first()?.id;
    if (latestId) {
        await (0, channelMonitor_1.saveSummaryCheckpoint)(channel.id, latestId);
    }
    // channel.send()으로 보내야 번역봇이 MessageCreate 이벤트를 잡을 수 있음
    await interaction.deleteReply();
    await channel.send(`📋 **Conversation Summary**\n\n${summary}`);
}
