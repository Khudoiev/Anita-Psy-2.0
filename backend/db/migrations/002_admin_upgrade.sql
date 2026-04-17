-- 002_admin_upgrade.sql

-- 1. Геолокация и IP-аналитика, расширенные данные об устройствах
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ip            VARCHAR(45),
  ADD COLUMN IF NOT EXISTS country       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country_code  CHAR(2),
  ADD COLUMN IF NOT EXISTS city          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS isp           VARCHAR(200),
  ADD COLUMN IF NOT EXISTS user_agent    TEXT,
  ADD COLUMN IF NOT EXISTS device_type   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS browser       VARCHAR(50);

-- 2. Расширенное управление пользователями
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nickname   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- 3. Безопасность и Rate Limiting (IP Blacklist)
CREATE TABLE IF NOT EXISTS ip_blacklist (
  id          SERIAL PRIMARY KEY,
  ip          VARCHAR(45) NOT NULL UNIQUE,
  reason      TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  created_by  UUID REFERENCES admins(id)
);

-- 4. Лог действий администратора
CREATE TABLE IF NOT EXISTS admin_logs (
  id          SERIAL PRIMARY KEY,
  admin_id    UUID REFERENCES admins(id),
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id   VARCHAR(100),
  details     JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);
