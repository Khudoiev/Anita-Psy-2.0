/* eslint-disable camelcase */

exports.shorthands = undefined;

// schema.sql initialises the DB on a fresh volume with sessions.user_id REFERENCES users(id)
// (no ON DELETE clause — defaults to RESTRICT). The baseline migration uses
// CREATE TABLE IF NOT EXISTS sessions, which is skipped when the table already exists.
// Result: DELETE FROM users fails for any user who has sessions.
exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE sessions
      DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE sessions
      DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id);
  `);
};
