-- Счётчик сообщений за день на пользователя
CREATE TABLE IF NOT EXISTS message_quota (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  count       INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

-- Индекс для быстрой проверки квоты
CREATE INDEX IF NOT EXISTS idx_quota_user_date ON message_quota(user_id, date);
