-- Migration 001 — PH0-S1 — User profiles table
-- Run in: Supabase fundlens-prod SQL editor
-- Status: ✅ Run — table public.profiles is live
-- Note: table is named "profiles" (not "users") — all frontend + admin code uses "profiles"

CREATE TABLE IF NOT EXISTS public.profiles (
  id         TEXT        PRIMARY KEY,               -- Firebase UID (auth.jwt() ->> 'sub')
  email      TEXT,
  role       TEXT        NOT NULL DEFAULT 'individual', -- 'individual' | 'advisor' | 'admin'
  plan_tier  TEXT        NOT NULL DEFAULT 'free',       -- 'free' | 'individual' | 'advisor_mfd' | 'advisor_ria'
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Each user can read their own row
CREATE POLICY "profiles_read_own" ON public.profiles
  FOR SELECT USING (auth.jwt() ->> 'sub' = id);

-- Each user can insert their own row (first sign-in auto-creates)
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = id);

-- Each user can update their own row
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.jwt() ->> 'sub' = id);
