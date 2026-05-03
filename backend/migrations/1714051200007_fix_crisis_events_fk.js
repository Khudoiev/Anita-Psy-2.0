/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // crisis_events.conversation_id had no ON DELETE clause — RESTRICT by default.
  // When deleting a user, conversations cascade-delete, which then fails because
  // crisis_events still references those conversations.
  // Fix: SET NULL so crisis events are preserved (safety audit trail) but not blocking.
  pgm.sql(`
    ALTER TABLE crisis_events
      DROP CONSTRAINT IF EXISTS crisis_events_conversation_id_fkey;
    ALTER TABLE crisis_events
      ADD CONSTRAINT crisis_events_conversation_id_fkey
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE crisis_events
      DROP CONSTRAINT IF EXISTS crisis_events_conversation_id_fkey;
    ALTER TABLE crisis_events
      ADD CONSTRAINT crisis_events_conversation_id_fkey
        FOREIGN KEY (conversation_id) REFERENCES conversations(id);
  `);
};
