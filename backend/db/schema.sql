-- Администраторы
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Приглашения
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL,
  label VARCHAR(100),          -- подпись для кого (например "Мария К.")
  max_uses INTEGER DEFAULT 1,  -- сколько раз можно использовать
  uses_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP,        -- NULL = бессрочно
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Пользователи (созданные через invite)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID REFERENCES invites(id),
  session_token VARCHAR(128) UNIQUE NOT NULL,
  nickname VARCHAR(50),
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  is_blocked BOOLEAN DEFAULT false
);

-- Сессии (каждый визит)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  messages_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO admins (username, password_hash) 
VALUES ('admin', '$2b$10$3CqvCDgmA./8XEQqlWAPOONhZRsfxk.g7nEqY57AGMBBB2lhs2HN.');
-- Пароль по умолчанию: admin123 (bcrypt hash)
