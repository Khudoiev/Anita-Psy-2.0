--
-- PostgreSQL database dump
--

\restrict dej1JZv5I80XtjqkJDFtKIwCD5Ry5M1H12ooHX9BpidYbCZTVWURUvNdyfeuugB

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
    admin_note text
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
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


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
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.invites(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict dej1JZv5I80XtjqkJDFtKIwCD5Ry5M1H12ooHX9BpidYbCZTVWURUvNdyfeuugB

