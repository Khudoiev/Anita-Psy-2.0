CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════
-- CONVERSATIONS & MESSAGES
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_token         VARCHAR(64),
  title               VARCHAR(200),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW(),
  messages_count      INTEGER DEFAULT 0,
  is_archived         BOOLEAN DEFAULT false,
  effectiveness_score FLOAT
);
CREATE INDEX IF NOT EXISTS idx_conv_user  ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_guest ON conversations(guest_token) WHERE guest_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  tokens_used     INTEGER,
  model           VARCHAR(50),
  created_at      TIMESTAMP DEFAULT NOW(),
  expires_at      TIMESTAMP DEFAULT NOW() + INTERVAL '90 days'
);
CREATE INDEX IF NOT EXISTS idx_messages_conv   ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_expiry ON messages(expires_at);

-- ═══════════════════════════════════════════
-- USER MEMORY
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_memory (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID REFERENCES users(id) ON DELETE CASCADE,
  category               VARCHAR(50) CHECK (category IN (
                           'personal','emotional','relational',
                           'behavioral','goals','triggers','strengths'
                         )),
  fact                   TEXT NOT NULL,
  importance             VARCHAR(10) CHECK (importance IN ('high','medium','low')),
  confidence             FLOAT DEFAULT 1.0,
  source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  created_at             TIMESTAMP DEFAULT NOW(),
  last_referenced        TIMESTAMP,
  times_referenced       INTEGER DEFAULT 0,
  is_active              BOOLEAN DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_memory_user ON user_memory(user_id, importance, last_referenced DESC);

-- ═══════════════════════════════════════════
-- TECHNIQUE EFFECTIVENESS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS technique_outcomes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  technique_name   VARCHAR(100) NOT NULL,
  session_turn     INTEGER,
  outcome          VARCHAR(20) CHECK (outcome IN (
                     'user_continued','user_returned',
                     'session_extended','user_disengaged','user_churned'
                   )),
  mood_trajectory  VARCHAR(20),
  created_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outcomes_technique ON technique_outcomes(technique_name, outcome);

CREATE MATERIALIZED VIEW IF NOT EXISTS technique_stats AS
SELECT
  technique_name,
  COUNT(*) as total_uses,
  COUNT(*) FILTER (WHERE outcome IN (
    'user_continued','user_returned','session_extended'
  )) as positive_outcomes,
  COUNT(*) FILTER (WHERE outcome IN (
    'user_disengaged','user_churned'
  )) as negative_outcomes,
  ROUND(
    COUNT(*) FILTER (WHERE outcome IN (
      'user_continued','user_returned','session_extended'
    ))::numeric / NULLIF(COUNT(*), 0) * 100, 1
  ) as success_rate_pct,
  AVG(session_turn) as avg_turn_used
FROM technique_outcomes
GROUP BY technique_name;

-- ═══════════════════════════════════════════
-- PROMPT IMPROVEMENT SUGGESTIONS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS prompt_suggestions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMP DEFAULT NOW(),
  status           VARCHAR(20) DEFAULT 'pending' CHECK (
                     status IN ('pending','approved','rejected','testing')
                   ),
  suggestion_type  VARCHAR(50),
  current_text     TEXT,
  proposed_text    TEXT,
  reasoning        TEXT NOT NULL,
  expected_benefit TEXT NOT NULL,
  potential_risks  TEXT,
  evidence         JSONB,
  approved_by      UUID REFERENCES admins(id),
  approved_at      TIMESTAMP,
  applied_at       TIMESTAMP
);

-- ═══════════════════════════════════════════
-- TOKEN USAGE
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS token_usage (
  user_id            UUID REFERENCES users(id) ON DELETE CASCADE,
  date               DATE NOT NULL DEFAULT CURRENT_DATE,
  prompt_tokens      INTEGER DEFAULT 0,
  completion_tokens  INTEGER DEFAULT 0,
  memory_tokens      INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- ═══════════════════════════════════════════
-- CRISIS EVENTS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crisis_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id),
  conversation_id  UUID REFERENCES conversations(id),
  trigger_phrase   TEXT,
  response_given   TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  reviewed_by      UUID REFERENCES admins(id),
  reviewed_at      TIMESTAMP
);

-- ═══════════════════════════════════════════
-- CONSENT
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_consent (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  terms_version     VARCHAR(20) NOT NULL,
  data_processing   BOOLEAN NOT NULL DEFAULT false,
  ai_improvement    BOOLEAN NOT NULL DEFAULT false,
  accepted_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_at_acceptance  VARCHAR(45)
);
