-- Migration 004: Add last_heartbeat to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_sessions_heartbeat ON sessions(is_active, last_heartbeat);

-- Migration 005: Add temp_bans, user account fields
CREATE TABLE IF NOT EXISTS temp_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  reason TEXT,
  banned_at TIMESTAMP DEFAULT NOW(),
  unbanned_at TIMESTAMP,
  new_invite_id UUID REFERENCES invites(id)
);
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS secret_question VARCHAR(255),
  ADD COLUMN IF NOT EXISTS secret_answer VARCHAR(255),
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ip VARCHAR(45),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS device_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS browser VARCHAR(50),
  ADD COLUMN IF NOT EXISTS admin_note TEXT;
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  action VARCHAR(100),
  target_type VARCHAR(50),
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ip_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip VARCHAR(45) UNIQUE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS message_quota (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  username VARCHAR(50),
  contact_hint VARCHAR(255),
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  reset_token VARCHAR(128) UNIQUE,
  token_expires_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) DEFAULT 'Новый разговор',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES user_chats(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_memory (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  facts JSONB DEFAULT '[]'::jsonb,
  themes JSONB DEFAULT '[]'::jsonb,
  techniques JSONB DEFAULT '[]'::jsonb,
  name_hint VARCHAR(255),
  mood_trajectory VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Migration 006: Full architecture schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_token VARCHAR(64),
  title VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  messages_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  effectiveness_score FLOAT
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_guest ON conversations(guest_token) WHERE guest_token IS NOT NULL;
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  model VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '90 days'
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_expiry ON messages(expires_at);

-- Drop and recreate user_memory with new structure if it doesn't have the right columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_memory' AND column_name='category') THEN
    DROP TABLE IF EXISTS user_memory CASCADE;
    CREATE TABLE user_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      category VARCHAR(50) CHECK (category IN ('personal','emotional','relational','behavioral','goals','triggers','strengths')),
      fact TEXT NOT NULL,
      importance VARCHAR(10) CHECK (importance IN ('high','medium','low')),
      confidence FLOAT DEFAULT 1.0,
      source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      last_referenced TIMESTAMP,
      times_referenced INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true
    );
    CREATE INDEX IF NOT EXISTS idx_memory_user ON user_memory(user_id, importance, last_referenced DESC);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS technique_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  technique_name VARCHAR(100) NOT NULL,
  session_turn INTEGER,
  outcome VARCHAR(20) CHECK (outcome IN ('user_continued','user_returned','session_extended','user_disengaged','user_churned')),
  mood_trajectory VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outcomes_technique ON technique_outcomes(technique_name, outcome);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'technique_stats') THEN
    CREATE MATERIALIZED VIEW technique_stats AS
    SELECT technique_name, COUNT(*) as total_uses,
      COUNT(*) FILTER (WHERE outcome IN ('user_continued','user_returned','session_extended')) as positive_outcomes,
      COUNT(*) FILTER (WHERE outcome IN ('user_disengaged','user_churned')) as negative_outcomes,
      ROUND(COUNT(*) FILTER (WHERE outcome IN ('user_continued','user_returned','session_extended'))::numeric / NULLIF(COUNT(*), 0) * 100, 1) as success_rate_pct,
      AVG(session_turn) as avg_turn_used
    FROM technique_outcomes GROUP BY technique_name;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS prompt_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','testing')),
  suggestion_type VARCHAR(50),
  current_text TEXT,
  proposed_text TEXT,
  reasoning TEXT NOT NULL,
  expected_benefit TEXT NOT NULL,
  potential_risks TEXT,
  evidence JSONB,
  approved_by UUID REFERENCES admins(id),
  approved_at TIMESTAMP,
  applied_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS token_usage (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  memory_tokens INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
CREATE TABLE IF NOT EXISTS crisis_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  conversation_id UUID REFERENCES conversations(id),
  trigger_phrase TEXT,
  response_given TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_by UUID REFERENCES admins(id),
  reviewed_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_consent (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  terms_version VARCHAR(20) NOT NULL,
  data_processing BOOLEAN NOT NULL DEFAULT false,
  ai_improvement BOOLEAN NOT NULL DEFAULT false,
  accepted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_at_acceptance VARCHAR(45)
);
