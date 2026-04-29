/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE user_memory ADD COLUMN IF NOT EXISTS profile JSONB DEFAULT '{
      "name": null,
      "core_issues": [],
      "triggers": [],
      "progress": "",
      "personality_notes": "",
      "preferred_techniques": [],
      "mood_history": [],
      "insights_history": [],
      "is_onboarded": false
    }'::jsonb;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE user_memory DROP COLUMN IF EXISTS profile;
  `);
};
