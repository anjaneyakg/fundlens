-- Migration 001 — PH0-S1 — Users table
-- Run in: Supabase fundlens-prod SQL editor
-- Status: PENDING — Supabase was unavailable when this was written (09 May 2026)

CREATE TABLE IF NOT EXISTS public.users (
  id         TEXT        PRIMARY KEY,               -- Firebase UID (auth.jwt() ->> 'sub')
  email      TEXT,
  role       TEXT        NOT NULL DEFAULT 'individual', -- 'individual' | 'advisor' | 'admin'
  plan_tier  TEXT        NOT NULL DEFAULT 'free',       -- 'free' | 'individual' | 'advisor_mfd' | 'advisor_ria'
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Each user can read their own row
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT USING (auth.jwt() ->> 'sub' = id);

-- Each user can insert their own row (first sign-in auto-creates)
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = id);

-- Each user can update their own row
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.jwt() ->> 'sub' = id);
