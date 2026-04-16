"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getState = getState;
exports.onMessage = onMessage;
exports.checkSummaryTrigger = checkSummaryTrigger;
exports.checkReminderTrigger = checkReminderTrigger;
exports.saveSummaryCheckpoint = saveSummaryCheckpoint;
exports.saveReminderCheckpoint = saveReminderCheckpoint;
exports.fetchMessagesSince = fetchMessagesSince;
const supabase_1 = require("../supabase");
// Trigger thresholds
const SUMMARY_CHAR_THRESHOLD = 5000;
const SUMMARY_TIME_MS = 15 * 60 * 1000; // 15 min
const BACKUP_TIME_MS = 60 * 60 * 1000; // 60 min
const BACKUP_MIN_CHARS = 1000;
const REMINDER_CHAR_THRESHOLD = 5000;
const REMINDER_TIME_MS = 15 * 60 * 1000; // 15 min
const states = new Map();
// Load state from Supabase on first message in a channel
async function initState(channelId) {
    const { data } = await supabase_1.supabase
        .from('team_channel_summaries')
        .select('*')
        .eq('channel_id', channelId)
        .single();
    const state = {
        charsSinceSummary: 0,
        charsSinceReminder: 0,
        lastSummaryAt: data?.last_summary_at ? new Date(data.last_summary_at).getTime() : 0,
        lastReminderAt: data?.last_reminder_at ? new Date(data.last_reminder_at).getTime() : 0,
        lastSummaryMessageId: data?.last_summary_message_id ?? null,
        initialized: true,
    };
    states.set(channelId, state);
    return state;
}
async function getState(channelId) {
    const existing = states.get(channelId);
    if (existing?.initialized)
        return existing;
    return initState(channelId);
}
// Called on every new message
async function onMessage(channelId, charCount) {
    const state = await getState(channelId);
    state.charsSinceSummary += charCount;
    state.charsSinceReminder += charCount;
}
async function checkSummaryTrigger(channelId) {
    const state = await getState(channelId);
    const now = Date.now();
    const charsMet = state.charsSinceSummary >= SUMMARY_CHAR_THRESHOLD;
    const timeMet = (now - state.lastSummaryAt) >= SUMMARY_TIME_MS;
    if (charsMet && timeMet)
        return true;
    // Backup: 60 min + at least 1000 chars
    const backupTimeMet = (now - state.lastSummaryAt) >= BACKUP_TIME_MS;
    if (backupTimeMet && state.charsSinceSummary >= BACKUP_MIN_CHARS)
        return true;
    return false;
}
async function checkReminderTrigger(channelId) {
    const state = await getState(channelId);
    const now = Date.now();
    const charsMet = state.charsSinceReminder >= REMINDER_CHAR_THRESHOLD;
    const timeMet = (now - state.lastReminderAt) >= REMINDER_TIME_MS;
    return charsMet || timeMet;
}
async function saveSummaryCheckpoint(channelId, lastMessageId) {
    const state = await getState(channelId);
    const now = Date.now();
    await supabase_1.supabase.from('team_channel_summaries').upsert({
        channel_id: channelId,
        last_summary_at: new Date(now).toISOString(),
        last_summary_message_id: lastMessageId,
        last_reminder_at: new Date(now).toISOString(),
    }, { onConflict: 'channel_id' });
    state.charsSinceSummary = 0;
    state.charsSinceReminder = 0;
    state.lastSummaryAt = now;
    state.lastReminderAt = now;
    state.lastSummaryMessageId = lastMessageId;
}
async function saveReminderCheckpoint(channelId) {
    const state = await getState(channelId);
    const now = Date.now();
    await supabase_1.supabase.from('team_channel_summaries').upsert({
        channel_id: channelId,
        last_reminder_at: new Date(now).toISOString(),
    }, { onConflict: 'channel_id' });
    state.charsSinceReminder = 0;
    state.lastReminderAt = now;
}
// Fetch all messages after a given message ID (or all if null)
async function fetchMessagesSince(channel, afterMessageId) {
    const collected = [];
    if (afterMessageId) {
        // Paginate forward using `after`
        let after = afterMessageId;
        while (true) {
            const fetched = await channel.messages.fetch({ limit: 100, after });
            if (fetched.size === 0)
                break;
            const sorted = [...fetched.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
            collected.push(...sorted);
            after = sorted[sorted.length - 1].id;
            if (fetched.size < 100)
                break;
        }
    }
    else {
        // Paginate backward from latest, then reverse
        let before = undefined;
        while (true) {
            const fetched = await channel.messages.fetch({ limit: 100, before });
            if (fetched.size === 0)
                break;
            collected.push(...fetched.values());
            before = fetched.last()?.id;
            if (fetched.size < 100)
                break;
        }
        collected.reverse();
    }
    return collected
        .filter((m) => !m.author.bot && m.content.trim().length > 0)
        .map((m) => ({
        author: m.author.globalName ?? m.author.username,
        content: m.content,
    }));
}
