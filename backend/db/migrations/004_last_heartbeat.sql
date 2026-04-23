ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_sessions_heartbeat
  ON sessions(is_active, last_heartbeat);
