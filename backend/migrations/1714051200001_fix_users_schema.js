/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Ensure all required columns exist in users table (for cases where table already existed)
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen timestamp without time zone DEFAULT now()');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS country character varying(100)');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code character(2)');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS city character varying(100)');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS isp character varying(200)');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS user_agent text');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS device_type character varying(20)');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS browser character varying(50)');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_note text');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS username character varying(50) UNIQUE');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash character varying(255)');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamp without time zone');
  
  // Also sessions table fix
  pgm.sql('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS started_at timestamp without time zone DEFAULT now()');
};

exports.down = pgm => {
  // We don't drop columns in down to avoid data loss in this fix migration
};
