/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Extensions
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  // 2. Tables
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS admins (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      username character varying(50) NOT NULL UNIQUE,
      password_hash character varying(255) NOT NULL,
      created_at timestamp without time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id SERIAL PRIMARY KEY,
      admin_id uuid REFERENCES admins(id),
      action character varying(100) NOT NULL,
      target_type character varying(50),
      target_id character varying(100),
      details jsonb,
      created_at timestamp without time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS invites (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      token character varying(64) NOT NULL UNIQUE,
      label character varying(100),
      max_uses integer DEFAULT 1,
      uses_count integer DEFAULT 0,
      expires_at timestamp without time zone,
      is_active boolean DEFAULT true,
      created_at timestamp without time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS users (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      invite_id uuid REFERENCES invites(id) ON DELETE SET NULL,
      session_token character varying(128) NOT NULL UNIQUE,
      nickname character varying(50),
      first_seen timestamp without time zone DEFAULT now(),
      last_seen timestamp without time zone DEFAULT now(),
      is_blocked boolean DEFAULT false,
      ip character varying(45),
      country character varying(100),
      country_code character(2),
      city character varying(100),
      isp character varying(200),
      user_agent text,
      device_type character varying(20),
      browser character varying(50),
      admin_note text,
      username character varying(50) UNIQUE,
      password_hash character varying(255),
      secret_question character varying(255),
      secret_answer character varying(255),
      registered_at timestamp without time zone,
      last_login_at timestamp without time zone
    );

    CREATE TABLE IF NOT EXISTS user_chats (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      title character varying(255) DEFAULT 'Новый разговор',
      created_at timestamp without time zone DEFAULT now(),
      updated_at timestamp without time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      chat_id uuid REFERENCES user_chats(id) ON DELETE CASCADE,
      role character varying(50) NOT NULL,
      content text NOT NULL,
      created_at timestamp without time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      guest_token character varying(64),
      title character varying(200),
      created_at timestamp without time zone DEFAULT now(),
      updated_at timestamp without time zone DEFAULT now(),
      messages_count integer DEFAULT 0,
      is_archived boolean DEFAULT false,
      effectiveness_score double precision
    );

    CREATE TABLE IF NOT EXISTS messages (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
      role character varying(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content text NOT NULL,
      tokens_used integer,
      model character varying(50),
      created_at timestamp without time zone DEFAULT now(),
      expires_at timestamp without time zone DEFAULT (now() + '90 days'::interval)
    );

    CREATE TABLE IF NOT EXISTS crisis_events (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid REFERENCES users(id),
      conversation_id uuid REFERENCES conversations(id),
      trigger_phrase text,
      response_given text,
      created_at timestamp without time zone DEFAULT now(),
      reviewed_by uuid REFERENCES admins(id),
      reviewed_at timestamp without time zone
    );

    CREATE TABLE IF NOT EXISTS ip_blacklist (
      id SERIAL PRIMARY KEY,
      ip character varying(45) NOT NULL UNIQUE,
      reason text,
      created_at timestamp without time zone DEFAULT now(),
      created_by uuid REFERENCES admins(id)
    );

    CREATE TABLE IF NOT EXISTS message_quota (
      id SERIAL PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      date date DEFAULT CURRENT_DATE NOT NULL,
      count integer DEFAULT 0 NOT NULL,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      contact_hint character varying(255),
      reason text,
      token character varying(128) NOT NULL UNIQUE,
      status character varying(50) DEFAULT 'pending',
      created_at timestamp without time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid REFERENCES users(id),
      started_at timestamp without time zone DEFAULT now(),
      ended_at timestamp without time zone,
      duration_seconds integer,
      messages_count integer DEFAULT 0,
      is_active boolean DEFAULT true,
      last_heartbeat timestamp without time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS technique_outcomes (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
      technique_name character varying(100) NOT NULL,
      session_turn integer,
      outcome character varying(20) CHECK (outcome IN ('user_continued', 'user_returned', 'session_extended', 'user_disengaged', 'user_churned')),
      mood_trajectory character varying(20),
      created_at timestamp without time zone DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS token_usage (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date date DEFAULT CURRENT_DATE NOT NULL,
      prompt_tokens integer DEFAULT 0,
      completion_tokens integer DEFAULT 0,
      memory_tokens integer DEFAULT 0,
      PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS user_consent (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      terms_version character varying(20) NOT NULL,
      data_processing boolean DEFAULT false NOT NULL,
      ai_improvement boolean DEFAULT false NOT NULL,
      accepted_at timestamp without time zone DEFAULT now() NOT NULL,
      ip_at_acceptance character varying(45)
    );

    CREATE TABLE IF NOT EXISTS user_memory (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      category character varying(50) CHECK (category IN ('personal', 'emotional', 'relational', 'behavioral', 'goals', 'triggers', 'strengths')),
      fact text NOT NULL,
      importance character varying(10) CHECK (importance IN ('high', 'medium', 'low')),
      confidence double precision DEFAULT 1.0,
      source_conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
      created_at timestamp without time zone DEFAULT now(),
      last_referenced timestamp without time zone,
      times_referenced integer DEFAULT 0,
      is_active boolean DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS prompt_suggestions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at timestamp without time zone DEFAULT now(),
      status character varying(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'testing')),
      suggestion_type character varying(50),
      current_text text,
      proposed_text text,
      reasoning text NOT NULL,
      expected_benefit text NOT NULL,
      potential_risks text,
      evidence jsonb,
      approved_by uuid REFERENCES admins(id),
      approved_at timestamp without time zone,
      applied_at timestamp without time zone
    );
  `);

  // 3. Indexes
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_conv_guest ON conversations (guest_token) WHERE (guest_token IS NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations (user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_memory_user ON user_memory (user_id, importance, last_referenced DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_expiry ON messages (expires_at);
    CREATE INDEX IF NOT EXISTS idx_outcomes_technique ON technique_outcomes (technique_name, outcome);
    CREATE INDEX IF NOT EXISTS idx_quota_user_date ON message_quota (user_id, date);
    CREATE INDEX IF NOT EXISTS idx_sessions_heartbeat ON sessions (is_active, last_heartbeat);
  `);

  // 4. Materialized Views
  pgm.sql(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS technique_stats AS
    SELECT technique_name,
      count(*) AS total_uses,
      count(*) FILTER (WHERE outcome IN ('user_continued', 'user_returned', 'session_extended')) AS positive_outcomes,
      count(*) FILTER (WHERE outcome IN ('user_disengaged', 'user_churned')) AS negative_outcomes,
      round(((count(*) FILTER (WHERE outcome IN ('user_continued', 'user_returned', 'session_extended')))::numeric / NULLIF(count(*), 0)::numeric * 100), 1) AS success_rate_pct,
      avg(session_turn) AS avg_turn_used
    FROM technique_outcomes
    GROUP BY technique_name
    WITH NO DATA;
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP MATERIALIZED VIEW IF EXISTS technique_stats');
  pgm.sql('DROP TABLE IF EXISTS prompt_suggestions CASCADE');
  pgm.sql('DROP TABLE IF EXISTS user_memory CASCADE');
  pgm.sql('DROP TABLE IF EXISTS user_consent CASCADE');
  pgm.sql('DROP TABLE IF EXISTS token_usage CASCADE');
  pgm.sql('DROP TABLE IF EXISTS technique_outcomes CASCADE');
  pgm.sql('DROP TABLE IF EXISTS sessions CASCADE');
  pgm.sql('DROP TABLE IF EXISTS password_reset_requests CASCADE');
  pgm.sql('DROP TABLE IF EXISTS message_quota CASCADE');
  pgm.sql('DROP TABLE IF EXISTS ip_blacklist CASCADE');
  pgm.sql('DROP TABLE IF EXISTS crisis_events CASCADE');
  pgm.sql('DROP TABLE IF EXISTS messages CASCADE');
  pgm.sql('DROP TABLE IF EXISTS conversations CASCADE');
  pgm.sql('DROP TABLE IF EXISTS chat_messages CASCADE');
  pgm.sql('DROP TABLE IF EXISTS user_chats CASCADE');
  pgm.sql('DROP TABLE IF EXISTS users CASCADE');
  pgm.sql('DROP TABLE IF EXISTS invites CASCADE');
  pgm.sql('DROP TABLE IF EXISTS admin_logs CASCADE');
  pgm.sql('DROP TABLE IF EXISTS admins CASCADE');
};
