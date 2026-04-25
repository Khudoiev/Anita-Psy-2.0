--
-- PostgreSQL database dump
--

\restrict q1rbAMmEsmUGpYfmM6hVLNv07UO8T7l1A3r2cjb03uiinzW79jEeGkirdOEqcwu

-- Dumped from database version 15.17
-- Dumped by pg_dump version 15.17

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_logs; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.admin_logs (
    id integer NOT NULL,
    admin_id uuid,
    action character varying(100) NOT NULL,
    target_type character varying(50),
    target_id character varying(100),
    details jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.admin_logs OWNER TO anita;

--
-- Name: admin_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: anita
--

CREATE SEQUENCE public.admin_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.admin_logs_id_seq OWNER TO anita;

--
-- Name: admin_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: anita
--

ALTER SEQUENCE public.admin_logs_id_seq OWNED BY public.admin_logs.id;


--
-- Name: admins; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.admins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.admins OWNER TO anita;

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id uuid,
    role character varying(50) NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.chat_messages OWNER TO anita;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    guest_token character varying(64),
    title character varying(200),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    messages_count integer DEFAULT 0,
    is_archived boolean DEFAULT false,
    effectiveness_score double precision
);


ALTER TABLE public.conversations OWNER TO anita;

--
-- Name: crisis_events; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.crisis_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    conversation_id uuid,
    trigger_phrase text,
    response_given text,
    created_at timestamp without time zone DEFAULT now(),
    reviewed_by uuid,
    reviewed_at timestamp without time zone
);


ALTER TABLE public.crisis_events OWNER TO anita;

--
-- Name: invites; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token character varying(64) NOT NULL,
    label character varying(100),
    max_uses integer DEFAULT 1,
    uses_count integer DEFAULT 0,
    expires_at timestamp without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.invites OWNER TO anita;

--
-- Name: ip_blacklist; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.ip_blacklist (
    id integer NOT NULL,
    ip character varying(45) NOT NULL,
    reason text,
    created_at timestamp without time zone DEFAULT now(),
    created_by uuid
);


ALTER TABLE public.ip_blacklist OWNER TO anita;

--
-- Name: ip_blacklist_id_seq; Type: SEQUENCE; Schema: public; Owner: anita
--

CREATE SEQUENCE public.ip_blacklist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ip_blacklist_id_seq OWNER TO anita;

--
-- Name: ip_blacklist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: anita
--

ALTER SEQUENCE public.ip_blacklist_id_seq OWNED BY public.ip_blacklist.id;


--
-- Name: message_quota; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.message_quota (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.message_quota OWNER TO anita;

--
-- Name: message_quota_id_seq; Type: SEQUENCE; Schema: public; Owner: anita
--

CREATE SEQUENCE public.message_quota_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.message_quota_id_seq OWNER TO anita;

--
-- Name: message_quota_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: anita
--

ALTER SEQUENCE public.message_quota_id_seq OWNED BY public.message_quota.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tokens_used integer,
    model character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone DEFAULT (now() + '90 days'::interval),
    CONSTRAINT messages_role_check CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'assistant'::character varying, 'system'::character varying])::text[])))
);


ALTER TABLE public.messages OWNER TO anita;

--
-- Name: password_reset_requests; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.password_reset_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    contact_hint character varying(255),
    reason text,
    token character varying(128) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.password_reset_requests OWNER TO anita;

--
-- Name: prompt_suggestions; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.prompt_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    status character varying(20) DEFAULT 'pending'::character varying,
    suggestion_type character varying(50),
    current_text text,
    proposed_text text,
    reasoning text NOT NULL,
    expected_benefit text NOT NULL,
    potential_risks text,
    evidence jsonb,
    approved_by uuid,
    approved_at timestamp without time zone,
    applied_at timestamp without time zone,
    CONSTRAINT prompt_suggestions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'testing'::character varying])::text[])))
);


ALTER TABLE public.prompt_suggestions OWNER TO anita;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    started_at timestamp without time zone DEFAULT now(),
    ended_at timestamp without time zone,
    duration_seconds integer,
    messages_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    last_heartbeat timestamp without time zone DEFAULT now()
);


ALTER TABLE public.sessions OWNER TO anita;

--
-- Name: technique_outcomes; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.technique_outcomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid,
    technique_name character varying(100) NOT NULL,
    session_turn integer,
    outcome character varying(20),
    mood_trajectory character varying(20),
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT technique_outcomes_outcome_check CHECK (((outcome)::text = ANY ((ARRAY['user_continued'::character varying, 'user_returned'::character varying, 'session_extended'::character varying, 'user_disengaged'::character varying, 'user_churned'::character varying])::text[])))
);


ALTER TABLE public.technique_outcomes OWNER TO anita;

--
-- Name: technique_stats; Type: MATERIALIZED VIEW; Schema: public; Owner: anita
--

CREATE MATERIALIZED VIEW public.technique_stats AS
 SELECT technique_outcomes.technique_name,
    count(*) AS total_uses,
    count(*) FILTER (WHERE ((technique_outcomes.outcome)::text = ANY ((ARRAY['user_continued'::character varying, 'user_returned'::character varying, 'session_extended'::character varying])::text[]))) AS positive_outcomes,
    count(*) FILTER (WHERE ((technique_outcomes.outcome)::text = ANY ((ARRAY['user_disengaged'::character varying, 'user_churned'::character varying])::text[]))) AS negative_outcomes,
    round((((count(*) FILTER (WHERE ((technique_outcomes.outcome)::text = ANY ((ARRAY['user_continued'::character varying, 'user_returned'::character varying, 'session_extended'::character varying])::text[]))))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 1) AS success_rate_pct,
    avg(technique_outcomes.session_turn) AS avg_turn_used
   FROM public.technique_outcomes
  GROUP BY technique_outcomes.technique_name
  WITH NO DATA;


ALTER TABLE public.technique_stats OWNER TO anita;

--
-- Name: temp_bans; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.temp_bans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    banned_by uuid,
    reason text,
    banned_at timestamp without time zone DEFAULT now(),
    unbanned_at timestamp without time zone
);


ALTER TABLE public.temp_bans OWNER TO anita;

--
-- Name: token_usage; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.token_usage (
    user_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    prompt_tokens integer DEFAULT 0,
    completion_tokens integer DEFAULT 0,
    memory_tokens integer DEFAULT 0
);


ALTER TABLE public.token_usage OWNER TO anita;

--
-- Name: user_chats; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.user_chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title character varying(255) DEFAULT 'Новый разговор'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_chats OWNER TO anita;

--
-- Name: user_consent; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.user_consent (
    user_id uuid NOT NULL,
    terms_version character varying(20) NOT NULL,
    data_processing boolean DEFAULT false NOT NULL,
    ai_improvement boolean DEFAULT false NOT NULL,
    accepted_at timestamp without time zone DEFAULT now() NOT NULL,
    ip_at_acceptance character varying(45)
);


ALTER TABLE public.user_consent OWNER TO anita;

--
-- Name: user_memory; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.user_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    category character varying(50),
    fact text NOT NULL,
    importance character varying(10),
    confidence double precision DEFAULT 1.0,
    source_conversation_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    last_referenced timestamp without time zone,
    times_referenced integer DEFAULT 0,
    is_active boolean DEFAULT true,
    CONSTRAINT user_memory_category_check CHECK (((category)::text = ANY ((ARRAY['personal'::character varying, 'emotional'::character varying, 'relational'::character varying, 'behavioral'::character varying, 'goals'::character varying, 'triggers'::character varying, 'strengths'::character varying])::text[]))),
    CONSTRAINT user_memory_importance_check CHECK (((importance)::text = ANY ((ARRAY['high'::character varying, 'medium'::character varying, 'low'::character varying])::text[])))
);


ALTER TABLE public.user_memory OWNER TO anita;

--
-- Name: users; Type: TABLE; Schema: public; Owner: anita
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invite_id uuid,
    session_token character varying(128) NOT NULL,
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
    username character varying(50),
    password_hash character varying(255),
    secret_question character varying(255),
    secret_answer character varying(255),
    registered_at timestamp without time zone,
    last_login_at timestamp without time zone
);


ALTER TABLE public.users OWNER TO anita;

--
-- Name: admin_logs id; Type: DEFAULT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.admin_logs ALTER COLUMN id SET DEFAULT nextval('public.admin_logs_id_seq'::regclass);


--
-- Name: ip_blacklist id; Type: DEFAULT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.ip_blacklist ALTER COLUMN id SET DEFAULT nextval('public.ip_blacklist_id_seq'::regclass);


--
-- Name: message_quota id; Type: DEFAULT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.message_quota ALTER COLUMN id SET DEFAULT nextval('public.message_quota_id_seq'::regclass);


--
-- Name: admin_logs admin_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_pkey PRIMARY KEY (id);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: crisis_events crisis_events_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.crisis_events
    ADD CONSTRAINT crisis_events_pkey PRIMARY KEY (id);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: invites invites_token_key; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_token_key UNIQUE (token);


--
-- Name: ip_blacklist ip_blacklist_ip_key; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_ip_key UNIQUE (ip);


--
-- Name: ip_blacklist ip_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_pkey PRIMARY KEY (id);


--
-- Name: message_quota message_quota_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.message_quota
    ADD CONSTRAINT message_quota_pkey PRIMARY KEY (id);


--
-- Name: message_quota message_quota_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.message_quota
    ADD CONSTRAINT message_quota_user_id_date_key UNIQUE (user_id, date);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: password_reset_requests password_reset_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_pkey PRIMARY KEY (id);


--
-- Name: password_reset_requests password_reset_requests_token_key; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_token_key UNIQUE (token);


--
-- Name: prompt_suggestions prompt_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.prompt_suggestions
    ADD CONSTRAINT prompt_suggestions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: technique_outcomes technique_outcomes_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.technique_outcomes
    ADD CONSTRAINT technique_outcomes_pkey PRIMARY KEY (id);


--
-- Name: temp_bans temp_bans_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.temp_bans
    ADD CONSTRAINT temp_bans_pkey PRIMARY KEY (id);


--
-- Name: token_usage token_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.token_usage
    ADD CONSTRAINT token_usage_pkey PRIMARY KEY (user_id, date);


--
-- Name: user_chats user_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.user_chats
    ADD CONSTRAINT user_chats_pkey PRIMARY KEY (id);


--
-- Name: user_consent user_consent_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.user_consent
    ADD CONSTRAINT user_consent_pkey PRIMARY KEY (user_id);


--
-- Name: user_memory user_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.user_memory
    ADD CONSTRAINT user_memory_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_session_token_key; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_session_token_key UNIQUE (session_token);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_conv_guest; Type: INDEX; Schema: public; Owner: anita
--

CREATE INDEX idx_conv_guest ON public.conversations USING btree (guest_token) WHERE (guest_token IS NOT NULL);


--
-- Name: idx_conv_user; Type: INDEX; Schema: public; Owner: anita
--

CREATE INDEX idx_conv_user ON public.conversations USING btree (user_id, updated_at DESC);


--
-- Name: idx_memory_user; Type: INDEX; Schema: public; Owner: anita
--

CREATE INDEX idx_memory_user ON public.user_memory USING btree (user_id, importance, last_referenced DESC);


--
-- Name: idx_messages_conv; Type: INDEX; Schema: public; Owner: anita
--

CREATE INDEX idx_messages_conv ON public.messages USING btree (conversation_id, created_at);


--
-- Name: idx_messages_expiry; Type: INDEX; Schema: public; Owner: anita
--

CREATE INDEX idx_messages_expiry ON public.messages USING btree (expires_at);


--
-- Name: idx_outcomes_technique; Type: INDEX; Schema: public; Owner: anita
--

CREATE INDEX idx_outcomes_technique ON public.technique_outcomes USING btree (technique_name, outcome);


--
-- Name: idx_quota_user_date; Type: INDEX; Schema: public; Owner: anita
--

CREATE INDEX idx_quota_user_date ON public.message_quota USING btree (user_id, date);


--
-- Name: idx_sessions_heartbeat; Type: INDEX; Schema: public; Owner: anita
--

CREATE INDEX idx_sessions_heartbeat ON public.sessions USING btree (is_active, last_heartbeat);


--
-- Name: admin_logs admin_logs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id);


--
-- Name: chat_messages chat_messages_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.user_chats(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: crisis_events crisis_events_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.crisis_events
    ADD CONSTRAINT crisis_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: crisis_events crisis_events_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.crisis_events
    ADD CONSTRAINT crisis_events_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.admins(id);


--
-- Name: crisis_events crisis_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.crisis_events
    ADD CONSTRAINT crisis_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: ip_blacklist ip_blacklist_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admins(id);


--
-- Name: message_quota message_quota_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.message_quota
    ADD CONSTRAINT message_quota_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: password_reset_requests password_reset_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: prompt_suggestions prompt_suggestions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.prompt_suggestions
    ADD CONSTRAINT prompt_suggestions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.admins(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: technique_outcomes technique_outcomes_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.technique_outcomes
    ADD CONSTRAINT technique_outcomes_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: temp_bans temp_bans_banned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.temp_bans
    ADD CONSTRAINT temp_bans_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.admins(id) ON DELETE SET NULL;


--
-- Name: temp_bans temp_bans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.temp_bans
    ADD CONSTRAINT temp_bans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: token_usage token_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.token_usage
    ADD CONSTRAINT token_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_chats user_chats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.user_chats
    ADD CONSTRAINT user_chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_consent user_consent_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.user_consent
    ADD CONSTRAINT user_consent_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_memory user_memory_source_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.user_memory
    ADD CONSTRAINT user_memory_source_conversation_id_fkey FOREIGN KEY (source_conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: user_memory user_memory_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.user_memory
    ADD CONSTRAINT user_memory_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.invites(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict q1rbAMmEsmUGpYfmM6hVLNv07UO8T7l1A3r2cjb03uiinzW79jEeGkirdOEqcwu

