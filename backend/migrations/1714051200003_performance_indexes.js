/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Add indexes for admin dashboard and analytics
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen DESC)');
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_users_country ON users (country) WHERE country IS NOT NULL');
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions (started_at DESC)');
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs (created_at DESC)');
  
  // Optional: Enable pg_trgm for faster searches if available
  // pgm.sql('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  // pgm.sql('CREATE INDEX IF NOT EXISTS idx_users_nickname_trgm ON users USING gin (nickname gin_trgm_ops)');
};

exports.down = pgm => {
  pgm.dropIndex('users', 'idx_users_last_seen');
  pgm.dropIndex('users', 'idx_users_country');
  pgm.dropIndex('sessions', 'idx_sessions_started_at');
  pgm.dropIndex('admin_logs', 'idx_admin_logs_created_at');
};
