#!/bin/bash
# Anita AI — Production Remote Deployment Script
set -e

PROJECT_DIR="/home/aleks90715/Anita Production 2.1"
ZIP_FILE="/home/aleks90715/deploy_package.zip"

echo "=== Starting Remote Deployment ==="
date

# 1. Check if zip exists
if [ ! -f "$ZIP_FILE" ]; then
    echo "Error: $ZIP_FILE not found."
    exit 1
fi

# 2. Extract files
echo "Extracting current code to $PROJECT_DIR..."
mkdir -p "$PROJECT_DIR"

# Preserve .env if it exists in the OLD directory and not in the NEW one
OLD_DIR="/home/aleks90715/my-agent/ANITA-PSY-main/project/Anita Psy — копия"
if [ -f "$OLD_DIR/.env" ] && [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "Copying .env from old directory..."
    cp "$OLD_DIR/.env" "$PROJECT_DIR/.env"
fi

sudo unzip -o "$ZIP_FILE" -d "$PROJECT_DIR"
rm "$ZIP_FILE"

# Ensure .env is available to the backend code via dotenv
cp "$PROJECT_DIR/.env" "$PROJECT_DIR/backend/.env"

# 3. Database Migration (Safe)
echo "Running database migrations..."
sudo docker exec -i anita-db psql -U anita -d anita << 'EOF'
-- Heartbeat system
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP DEFAULT NOW();
UPDATE sessions SET last_heartbeat = started_at WHERE last_heartbeat IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_heartbeat ON sessions(is_active, last_heartbeat);

-- Invite FK safety
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_invite_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES invites(id) ON DELETE SET NULL;

-- Temp bans table (migration 005)
CREATE TABLE IF NOT EXISTS temp_bans (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT,
  banned_at   TIMESTAMP DEFAULT NOW(),
  banned_by   UUID REFERENCES admins(id),
  unbanned_at TIMESTAMP,
  new_invite_id UUID REFERENCES invites(id)
);
CREATE INDEX IF NOT EXISTS idx_temp_bans_user ON temp_bans(user_id);

-- IP blacklist table (used by checkBlacklistAndLimit middleware)
CREATE TABLE IF NOT EXISTS ip_blacklist (
  id         SERIAL PRIMARY KEY,
  ip         VARCHAR(45) UNIQUE NOT NULL,
  reason     TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Auth columns on users (username/password registration system)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username        VARCHAR(30) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash   VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS secret_question TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS secret_answer   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registered_at   TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at   TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen       TIMESTAMP DEFAULT NOW();

-- Chat history tables (chats.js)
CREATE TABLE IF NOT EXISTS user_chats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(200) DEFAULT 'Новый разговор',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_chats_user ON user_chats(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID NOT NULL REFERENCES user_chats(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id, created_at);

-- User memory table (Anita's per-user memory)
CREATE TABLE IF NOT EXISTS user_memory (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  facts           JSONB DEFAULT '[]',
  themes          TEXT[] DEFAULT '{}',
  techniques      TEXT[] DEFAULT '{}',
  name_hint       VARCHAR(100),
  mood_trajectory TEXT,
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Message quota table
CREATE TABLE IF NOT EXISTS message_quota (
  id       SERIAL PRIMARY KEY,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date     DATE NOT NULL DEFAULT CURRENT_DATE,
  count    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_quota_user_date ON message_quota(user_id, date);
EOF

# 4. Restart Services
echo "Activating containers in $PROJECT_DIR..."
cd "$PROJECT_DIR"
sudo docker-compose --env-file .env up -d --build --remove-orphans --force-recreate

echo "=== Deployment Successful ==="
sudo docker ps --format "table {{.Names}}\t{{.Status}}"
