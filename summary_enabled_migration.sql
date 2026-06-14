-- team_channel_summaries에 채널별 자동 요약 on/off 플래그 추가
-- /요약끄기(summary-off) → false, /요약켜기(summary-on) → true
-- 기존 행은 모두 기본 켜짐(true)으로 채워지므로 동작 변화 없음(additive, 안전).
ALTER TABLE team_channel_summaries
  ADD COLUMN IF NOT EXISTS summary_enabled BOOLEAN NOT NULL DEFAULT TRUE;
