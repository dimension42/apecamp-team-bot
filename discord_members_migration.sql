-- discord_members 테이블 생성
CREATE TABLE IF NOT EXISTS discord_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_uid TEXT NOT NULL UNIQUE,
  username TEXT,
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_discord_members_discord_uid ON discord_members(discord_uid);
CREATE INDEX IF NOT EXISTS idx_discord_members_user_id ON discord_members(user_id);
