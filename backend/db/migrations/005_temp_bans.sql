CREATE TABLE IF NOT EXISTS temp_bans (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT,
  banned_at   TIMESTAMP DEFAULT NOW(),
  banned_by   UUID REFERENCES admins(id),
  unbanned_at TIMESTAMP,  -- NULL = активный бан
  new_invite_id UUID REFERENCES invites(id)  -- инвайт выданный после разбана
);

CREATE INDEX IF NOT EXISTS idx_temp_bans_user ON temp_bans(user_id);
