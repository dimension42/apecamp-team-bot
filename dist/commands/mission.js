"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
exports.handleMissionModal = handleMissionModal;
const discord_js_1 = require("discord.js");
const timer_1 = require("../services/timer");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('mission')
    .setDescription('미션 종료 타이머를 설정합니다 (관리자 전용)');
async function execute(interaction) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId('missionTimerModal')
        .setTitle('🎯 미션 종료 타이머 설정');
    const timeInput = new discord_js_1.TextInputBuilder()
        .setCustomId('endTime')
        .setLabel('종료 시간')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('예: 18:00')
        .setRequired(true);
    const formatInput = new discord_js_1.TextInputBuilder()
        .setCustomId('submissionFormat')
        .setLabel('제출 포맷')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('예: PDF, PPT, ZIP')
        .setRequired(true);
    const methodInput = new discord_js_1.TextInputBuilder()
        .setCustomId('submissionMethod')
        .setLabel('제출 방법')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setPlaceholder('예: #제출 채널에 파일을 업로드해주세요.')
        .setRequired(true);
    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(timeInput), new discord_js_1.ActionRowBuilder().addComponents(formatInput), new discord_js_1.ActionRowBuilder().addComponents(methodInput));
    await interaction.showModal(modal);
}
async function handleMissionModal(interaction, client) {
    const timeStr = interaction.fields.getTextInputValue('endTime');
    const submissionFormat = interaction.fields.getTextInputValue('submissionFormat');
    const submissionMethod = interaction.fields.getTextInputValue('submissionMethod');
    await interaction.deferReply({ ephemeral: true });
    try {
        const endTime = (0, timer_1.parseEndTime)(timeStr);
        await (0, timer_1.startTimer)({ endTime, submissionFormat, submissionMethod, client });
        await interaction.editReply(`✅ 미션 종료 타이머가 **${(0, timer_1.formatKST)(endTime)}**으로 설정됐습니다. 모든 팀 채널에 알림을 보내기 시작합니다.`);
    }
    catch (error) {
        await interaction.editReply(`❌ ${error.message}`);
    }
}
