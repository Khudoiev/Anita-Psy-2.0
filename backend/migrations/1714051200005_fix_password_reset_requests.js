/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Add missing columns to password_reset_requests
  // The baseline created the table with 'token NOT NULL', but code uses 'reset_token', username, etc.
  pgm.sql(`
    ALTER TABLE password_reset_requests
      ADD COLUMN IF NOT EXISTS username character varying(50),
      ADD COLUMN IF NOT EXISTS reset_token character varying(128) UNIQUE,
      ADD COLUMN IF NOT EXISTS token_expires_at timestamp without time zone,
      ADD COLUMN IF NOT EXISTS admin_note text,
      ADD COLUMN IF NOT EXISTS resolved_at timestamp without time zone,
      ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES admins(id);
  `);

  // The original 'token' column was NOT NULL UNIQUE — drop that constraint
  // since inserts now don't provide it
  pgm.sql(`
    ALTER TABLE password_reset_requests
      ALTER COLUMN token DROP NOT NULL;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE password_reset_requests
      DROP COLUMN IF EXISTS username,
      DROP COLUMN IF EXISTS reset_token,
      DROP COLUMN IF EXISTS token_expires_at,
      DROP COLUMN IF EXISTS admin_note,
      DROP COLUMN IF EXISTS resolved_at,
      DROP COLUMN IF EXISTS resolved_by;
  `);
  pgm.sql(`ALTER TABLE password_reset_requests ALTER COLUMN token SET NOT NULL;`);
};
