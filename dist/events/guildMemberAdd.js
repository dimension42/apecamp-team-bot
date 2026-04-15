"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGuildMemberAdd = handleGuildMemberAdd;
const supabase_1 = require("../supabase");
async function handleGuildMemberAdd(member) {
    const discordUid = member.id;
    const username = member.user.username;
    const { error } = await supabase_1.supabase
        .from('discord_members')
        .upsert({ discord_uid: discordUid, username }, { onConflict: 'discord_uid' });
    if (error) {
        console.error(`❌ UID 저장 실패 (${username}):`, error.message);
    }
    else {
        console.log(`✅ UID 저장: ${username} (${discordUid})`);
    }
}
