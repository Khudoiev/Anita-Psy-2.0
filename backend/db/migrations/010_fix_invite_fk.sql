-- Пересоздаём FK constraint с ON DELETE SET NULL на всех окружениях
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_invite_id_fkey;

ALTER TABLE users
  ADD CONSTRAINT users_invite_id_fkey
  FOREIGN KEY (invite_id)
  REFERENCES invites(id)
  ON DELETE SET NULL;
