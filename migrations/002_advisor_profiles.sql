-- Migration 002 — PH0-S2 — Advisor profiles + admin read-all on profiles
-- Run in: Supabase fundlens-prod SQL editor AFTER migration 001
-- Status: ⚠ Pending — Supabase IO timeout (run when Supabase recovers)

-- 1. Advisor profiles table
CREATE TABLE IF NOT EXISTS public.advisor_profiles (
  user_id      TEXT        PRIMARY KEY REFERENCES public.profiles(id),
  firm_name    TEXT,
  logo_url     TEXT,
  css_override TEXT,
  approved_at  TIMESTAMPTZ,
  max_clients  INTEGER     DEFAULT 50,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.advisor_profiles ENABLE ROW LEVEL SECURITY;

-- Advisor can read their own profile
CREATE POLICY "advisor_read_own" ON public.advisor_profiles
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

-- Advisor can update their own profile
CREATE POLICY "advisor_update_own" ON public.advisor_profiles
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);

-- Admin can read all advisor profiles
CREATE POLICY "admin_read_all_advisors" ON public.advisor_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.jwt() ->> 'sub'
        AND role = 'admin'
    )
  );

-- 2. Admin read-all policy on profiles table (for admin UI listing all users via RLS)
--    NOTE: api/admin.js uses service_role and bypasses RLS, so this policy is
--    only needed if you ever want admin to query profiles directly via the anon client.
CREATE POLICY "admin_read_all_profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.jwt() ->> 'sub'
        AND p2.role = 'admin'
    )
  );
