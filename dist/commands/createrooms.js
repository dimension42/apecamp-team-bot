"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const supabase_1 = require("../supabase");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('createrooms')
    .setDescription('팀별 프라이빗 채널을 생성합니다 (방장 전용)')
    .addStringOption((option) => option.setName('run_id').setDescription('팀 매칭 Run ID').setRequired(true))
    .addStringOption((option) => option.setName('day').setDescription('Day 구분 (예: Day1, Day2)').setRequired(true));
async function execute(interaction) {
    // 방장(서버 소유자)만 실행 가능
    if (interaction.user.id !== interaction.guild?.ownerId) {
        await interaction.reply({ content: '❌ 방장만 사용할 수 있는 명령어입니다.', ephemeral: true });
        return;
    }
    const runId = interaction.options.getString('run_id', true);
    const day = interaction.options.getString('day', true);
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    // Team-chat 카테고리 찾기
    const category = guild.channels.cache.find((c) => c.type === discord_js_1.ChannelType.GuildCategory && c.name === 'Team-chat');
    if (!category) {
        await interaction.editReply('❌ `Team-chat` 카테고리를 찾을 수 없습니다.');
        return;
    }
    // 길드 멤버 캐시 적재 — 권한 overwrite 대상이 실제 멤버인지 검증용.
    // (GuildMembers privileged intent 필요. 미가입/캐시 누락 UID를 overwrite에 넣으면
    //  guild.channels.create가 throw하여 해당 팀 채널 생성이 통째로 실패한다.)
    try {
        await guild.members.fetch();
    }
    catch (e) {
        console.error('⚠️ guild.members.fetch 실패 (부분 캐시로 진행):', e?.message ?? e);
    }
    // 팀 배정 조회.
    // 주의: team_assignments ↔ profiles 사이에 FK가 없어 PostgREST embed(profiles!inner)는
    // PGRST200("relationship 없음")으로 실패한다. 따라서 두 번 조회 후 JS에서 user_id로 조인한다.
    const { data: assignments, error } = await supabase_1.supabase
        .from('team_assignments')
        .select('team_number, user_id')
        .eq('run_id', runId)
        .order('team_number');
    if (error || !assignments || assignments.length === 0) {
        await interaction.editReply(`❌ 팀 데이터를 불러오지 못했습니다. run_id를 확인해주세요.\n\`${error?.message ?? '결과 없음'}\``);
        return;
    }
    // 배정된 user_id들의 프로필(활동명/실명/discord_uid) 조회
    const userIds = [...new Set(assignments.map((a) => a.user_id))];
    const { data: profileRows, error: profErr } = await supabase_1.supabase
        .from('profiles')
        .select('user_id, activity_name, real_name, discord_uid')
        .in('user_id', userIds);
    if (profErr) {
        await interaction.editReply(`❌ 프로필을 불러오지 못했습니다.\n\`${profErr.message}\``);
        return;
    }
    const profileMap = new Map((profileRows ?? []).map((p) => [p.user_id, p]));
    // 유효한 Discord snowflake(17~20자리) 형식 검증
    const isValidSnowflake = (id) => typeof id === 'string' && /^\d{17,20}$/.test(id);
    // 팀별로 그룹핑
    const teams = new Map();
    for (const row of assignments) {
        const teamNum = row.team_number;
        if (!teams.has(teamNum))
            teams.set(teamNum, []);
        const profile = profileMap.get(row.user_id);
        const rawUid = profile?.discord_uid ?? null;
        // 형식이 유효하고 '현재 길드에 가입된' 멤버만 권한 부여 대상. 그 외는 미연동 처리.
        const usableUid = isValidSnowflake(rawUid) && guild.members.cache.has(rawUid) ? rawUid : null;
        teams.get(teamNum).push({
            activityName: profile?.activity_name ?? profile?.real_name ?? '알수없음',
            discordUid: usableUid,
        });
    }
    let created = 0;
    let skipped = 0;
    const failed = [];
    for (const [teamNum, members] of teams) {
        const channelName = `team${teamNum}-${day.toLowerCase()}`;
        // 이미 존재하는 채널 스킵
        const exists = guild.channels.cache.find((c) => c.name === channelName);
        if (exists) {
            // 자가 치유: 채널은 있는데 모니터링 DB에 누락됐을 수 있으므로 등록을 보장하고 스킵
            try {
                await supabase_1.supabase.from('team_channel_summaries').upsert({ channel_id: exists.id, last_summary_at: new Date().toISOString() }, { onConflict: 'channel_id' });
            }
            catch (e) {
                console.error(`⚠️ team${teamNum} 기존 채널 등록 보장 실패:`, e?.message ?? e);
            }
            skipped++;
            continue;
        }
        // 팀 단위로 격리: 한 팀의 채널 생성이 실패해도 나머지 팀은 계속 진행
        try {
            // 채널에 접근 허용할 멤버 권한 설정
            const permissionOverwrites = [
                {
                    id: guild.roles.everyone.id,
                    type: discord_js_1.OverwriteType.Role,
                    deny: [discord_js_1.PermissionFlagsBits.ViewChannel],
                },
            ];
            // 번역봇 접근 허용 (env에 설정된 경우만)
            const translationBotId = process.env.TRANSLATION_BOT_ID;
            if (translationBotId && isValidSnowflake(translationBotId)) {
                permissionOverwrites.push({
                    id: translationBotId,
                    type: discord_js_1.OverwriteType.Member,
                    allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages],
                });
            }
            for (const member of members) {
                // discordUid는 위에서 snowflake 형식 + 길드 멤버십 검증을 통과한 값만 non-null
                if (member.discordUid) {
                    permissionOverwrites.push({
                        id: member.discordUid,
                        type: discord_js_1.OverwriteType.Member,
                        allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages],
                    });
                }
            }
            const newChannel = await guild.channels.create({
                name: channelName,
                type: discord_js_1.ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites,
            });
            // 요약봇이 모니터링할 채널로 등록 (last_summary_at = 지금 → 첫 메시지 즉시 요약 방지)
            await supabase_1.supabase.from('team_channel_summaries').upsert({
                channel_id: newChannel.id,
                last_summary_at: new Date().toISOString(),
            }, { onConflict: 'channel_id' });
            created++;
        }
        catch (err) {
            console.error(`❌ team${teamNum} 채널 생성 실패:`, err?.message ?? err);
            failed.push(teamNum);
        }
    }
    const unmatched = [...teams.values()]
        .flat()
        .filter((m) => !m.discordUid)
        .map((m) => m.activityName);
    let reply = `✅ 채널 생성 완료!\n- 생성됨: ${created}개\n- 스킵(이미 존재): ${skipped}개`;
    if (failed.length > 0) {
        reply += `\n- ❌ 실패: ${failed.length}개 (team ${failed.join(', ')}) — 로그 확인 필요`;
    }
    if (unmatched.length > 0) {
        // 2000자 한도 보호: 너무 많으면 일부만 표기
        const shown = unmatched.slice(0, 40);
        const more = unmatched.length - shown.length;
        reply += `\n\n⚠️ 디스코드 미연동/미가입 참가자 (채널에 추가 안 됨):\n${shown.join(', ')}`;
        if (more > 0)
            reply += ` 외 ${more}명`;
    }
    await interaction.editReply(reply);
}
