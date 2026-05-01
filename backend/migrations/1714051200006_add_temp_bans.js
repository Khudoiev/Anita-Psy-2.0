/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS temp_bans (
      id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      banned_by   uuid REFERENCES admins(id) ON DELETE SET NULL,
      reason      text,
      banned_at   timestamp without time zone DEFAULT now(),
      unbanned_at timestamp without time zone,
      new_invite_id uuid REFERENCES invites(id)
    );

    CREATE INDEX IF NOT EXISTS idx_temp_bans_user ON temp_bans(user_id);
  `);
};

exports.down = pgm => {
  pgm.sql('DROP INDEX IF EXISTS idx_temp_bans_user');
  pgm.sql('DROP TABLE IF EXISTS temp_bans CASCADE');
};
