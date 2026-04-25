--
-- PostgreSQL database dump
--

\restrict tHPFbOx7uX6IvSYeaOAOG07UJnzWaeed1sgWZdPMBuLtnzSSMzmT52gVTsnEorP

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
-- Name: admins; Type: TABLE; Schema: public; Owner: anita_staging
--

CREATE TABLE public.admins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.admins OWNER TO anita_staging;

--
-- Name: invites; Type: TABLE; Schema: public; Owner: anita_staging
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


ALTER TABLE public.invites OWNER TO anita_staging;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: anita_staging
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    started_at timestamp without time zone DEFAULT now(),
    ended_at timestamp without time zone,
    duration_seconds integer,
    messages_count integer DEFAULT 0,
    is_active boolean DEFAULT true
);


ALTER TABLE public.sessions OWNER TO anita_staging;

--
-- Name: users; Type: TABLE; Schema: public; Owner: anita_staging
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invite_id uuid,
    session_token character varying(128) NOT NULL,
    nickname character varying(50),
    first_seen timestamp without time zone DEFAULT now(),
    last_seen timestamp without time zone DEFAULT now(),
    is_blocked boolean DEFAULT false
);


ALTER TABLE public.users OWNER TO anita_staging;

--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: anita_staging
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: anita_staging
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: anita_staging
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: invites invites_token_key; Type: CONSTRAINT; Schema: public; Owner: anita_staging
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_token_key UNIQUE (token);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: anita_staging
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: anita_staging
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_session_token_key; Type: CONSTRAINT; Schema: public; Owner: anita_staging
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_session_token_key UNIQUE (session_token);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita_staging
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: anita_staging
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.invites(id);


--
-- PostgreSQL database dump complete
--

\unrestrict tHPFbOx7uX6IvSYeaOAOG07UJnzWaeed1sgWZdPMBuLtnzSSMzmT52gVTsnEorP

