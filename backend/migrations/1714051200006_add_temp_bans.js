/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Create with correct schema if not exists (fresh DB)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS temp_bans (
      id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      banned_by     uuid REFERENCES admins(id) ON DELETE SET NULL,
      reason        text,
      banned_at     timestamp without time zone DEFAULT now(),
      unbanned_at   timestamp without time zone,
      new_invite_id uuid REFERENCES invites(id)
    );
  `);

  // If baseline created temp_bans with old schema (admin_id instead of banned_by),
  // add the missing columns so inserts don't fail
  pgm.sql(`
    ALTER TABLE temp_bans ADD COLUMN IF NOT EXISTS banned_by     uuid REFERENCES admins(id) ON DELETE SET NULL;
    ALTER TABLE temp_bans ADD COLUMN IF NOT EXISTS banned_at     timestamp without time zone DEFAULT now();
    ALTER TABLE temp_bans ADD COLUMN IF NOT EXISTS unbanned_at   timestamp without time zone;
    ALTER TABLE temp_bans ADD COLUMN IF NOT EXISTS new_invite_id uuid REFERENCES invites(id);
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_temp_bans_user ON temp_bans(user_id);`);
};

exports.down = pgm => {
  pgm.sql('DROP INDEX IF EXISTS idx_temp_bans_user');
  pgm.sql('DROP TABLE IF EXISTS temp_bans CASCADE');
};
