-- migrations/004_registration.sql
-- PH3-S4: Registration wizard, promo codes, debarred check, admin notifications
-- Run manually in Supabase fundlens-prod SQL editor.
-- Prerequisites: migrations/001 (profiles), 002 (advisor_profiles), 003 (promo_messages) must already be applied.

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE 1: promo_codes
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT UNIQUE NOT NULL,
  max_uses         INTEGER NOT NULL DEFAULT 1 CHECK (max_uses <= 100),
  used_count       INTEGER NOT NULL DEFAULT 0,
  tier_target      TEXT NOT NULL, -- 'individual' | 'advisor_mfd' | 'advisor_ria'
  registration_type TEXT NOT NULL, -- 'investor' | 'advisor'
  expires_at       TIMESTAMPTZ,
  created_by       TEXT REFERENCES profiles(id),
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "promo_codes_admin"
  ON promo_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.jwt() ->> 'sub'
        AND profiles.role = 'admin'
    )
  );

-- Anyone can read an active code (for validation at registration — anon client)
CREATE POLICY "promo_codes_public_read"
  ON promo_codes FOR SELECT
  USING (is_active = true);

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE 2: regulatory_debarred
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regulatory_debarred (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL, -- 'arn' | 'sebi_ria' | 'pan'
  entity_value  TEXT NOT NULL, -- the ARN number, SEBI RIA number, or PAN
  entity_name   TEXT,
  source        TEXT NOT NULL, -- 'SEBI' | 'AMFI'
  debarred_since DATE,
  last_verified  DATE DEFAULT CURRENT_DATE,
  notes         TEXT,
  UNIQUE(entity_type, entity_value)
);
ALTER TABLE regulatory_debarred ENABLE ROW LEVEL SECURITY;

-- Public read — needed at registration via anon client
CREATE POLICY "regulatory_debarred_public_read"
  ON regulatory_debarred FOR SELECT
  USING (true);

-- Admin full access
CREATE POLICY "regulatory_debarred_admin"
  ON regulatory_debarred FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.jwt() ->> 'sub'
        AND profiles.role = 'admin'
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE 3: admin_notifications
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL, -- 'new_advisor_application' | 'new_investor_registration' | 'advisor_approved' | 'advisor_rejected' | 'admin_registered_advisor'
  message    TEXT NOT NULL,
  read       BOOLEAN DEFAULT false,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admin only (read/write)
CREATE POLICY "admin_notifications_admin"
  ON admin_notifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.jwt() ->> 'sub'
        AND profiles.role = 'admin'
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- ALTER TABLE: advisor_profiles — add registration/application fields
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE advisor_profiles
  ADD COLUMN IF NOT EXISTS applicant_name    TEXT,
  ADD COLUMN IF NOT EXISTS registration_type TEXT, -- 'mfd_arn' | 'sebi_ria'
  ADD COLUMN IF NOT EXISTS arn_number        TEXT,
  ADD COLUMN IF NOT EXISTS euin_number       TEXT,
  ADD COLUMN IF NOT EXISTS euin_pending      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sebi_ria_number   TEXT,
  ADD COLUMN IF NOT EXISTS phone             TEXT,
  ADD COLUMN IF NOT EXISTS city              TEXT,
  ADD COLUMN IF NOT EXISTS referral_source   TEXT,
  ADD COLUMN IF NOT EXISTS status            TEXT DEFAULT 'pending',
    -- 'pending' | 'approved' | 'rejected' | 'admin_registered'
  ADD COLUMN IF NOT EXISTS applied_at        TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT,
  ADD COLUMN IF NOT EXISTS registered_by     TEXT,
    -- Firebase UID of admin if admin-registered; null if self-registered
  ADD COLUMN IF NOT EXISTS promo_code_used   TEXT,
  ADD COLUMN IF NOT EXISTS debarred_check_passed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS debarred_check_at     TIMESTAMPTZ;

-- ──────────────────────────────────────────────────────────────────────────────
-- Tighten advisor_profiles RLS (was USING true — open policy)
-- Per NEXT_SESSION.md Priority P0
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "advisor_profiles_open" ON advisor_profiles;

-- Advisors can read/write their own row
CREATE POLICY "advisor_profiles_self"
  ON advisor_profiles FOR ALL
  USING (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

-- Admins can read all rows
CREATE POLICY "advisor_profiles_admin_read"
  ON advisor_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.jwt() ->> 'sub'
        AND profiles.role = 'admin'
    )
  );

-- Admins can update all rows (approve/reject flow)
CREATE POLICY "advisor_profiles_admin_update"
  ON advisor_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.jwt() ->> 'sub'
        AND profiles.role = 'admin'
    )
  );

-- Admins can insert rows (admin-register-advisor flow)
CREATE POLICY "advisor_profiles_admin_insert"
  ON advisor_profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.jwt() ->> 'sub'
        AND profiles.role = 'admin'
    )
  );
