# NEXT SESSION — FundLens
Last updated: 30 May 2026 (PH3-S3 Promote module done)

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## Phase 3 status: PH3-S1 ✅ PH3-S2 ✅ PH3-S3 ✅
PH3-S1: Advisor Dashboard at /advisor (5 widgets) — commit 07e15f1
PH3-S2: White-label branding system — AdvisorSettings /advisor/settings, F5 PDF branding — commit 30cab63
PH3-S3: Promote module — /advisor/promote, 3 leaflet templates, email/WhatsApp copy, html2canvas JPEG export — this session
Build: 956 modules, 0 errors.

---

## Current priority (do this first):
Task: PH3-S4 — Advisor onboarding flow

Spec TBD at session start. Likely:
- Onboarding wizard for new advisors (firm details, branding, first client invite)
- advisor_profiles approval flow (admin approves advisor accounts)
- Onboarding completion state (percentage bar, steps checklist)

---

## Priority 2: Tighten advisor_profiles RLS

Run this SQL in Supabase fundlens-prod SQL editor (still pending):

```sql
-- Drop the existing open policy
DROP POLICY IF EXISTS "advisor_profiles_open" ON advisor_profiles;

-- Advisors can read/write their own row only
CREATE POLICY "advisor_profiles_self"
  ON advisor_profiles
  FOR ALL
  USING (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

-- Admins can read all rows (for UserManager)
CREATE POLICY "advisor_profiles_admin_read"
  ON advisor_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.jwt() ->> 'sub'
        AND profiles.role = 'admin'
    )
  );
```

Note: advisor_firm_profiles (new table, PH3-S2) has correct RLS already.

## Priority 3: Populate promo_messages for Promote module

The Promote module (PH3-S3) reads from `promo_messages` WHERE is_active=true.
The table exists (migration 003 run 24 May 2026) but no rows yet.
Insert at least 3 sample rows to test the Promote UI:

```sql
INSERT INTO promo_messages (title, text, body_text, feature_bullets, category, template_layout, cta_style, corner_position, background_colour_hex, is_active, display_order)
VALUES
  (
    'Start your SIP journey today',
    'Systematic Investment Plans — the smarter way to build wealth.',
    'A SIP lets you invest a fixed amount every month in mutual funds, averaging out market highs and lows over time.',
    '["Rupee-cost averaging reduces market timing risk","As low as ₹500/month to start","Fully liquid — withdraw anytime","Backed by SEBI-regulated AMCs"]',
    'leaflet', 'header_split', 'card', null, null, true, 1
  ),
  (
    'Review your portfolio — annual health check',
    'A mutual fund portfolio review keeps your goals on track.',
    'Dear [Client Name],\n\nAs your Advisor / Distributor, I wanted to reach out for our annual portfolio review...',
    '[]',
    'email', null, null, null, null, true, 2
  ),
  (
    'Market update — May 2026',
    'Quick market snapshot for your awareness 📊',
    null,
    '[]',
    'whatsapp', null, null, null, null, true, 3
  );
```

## Open issues to keep in mind:
- ✅ PH3-S1 Advisor Dashboard — DONE (30 May 2026, commit 07e15f1)
- ✅ PH3-S2 White-label branding — DONE (30 May 2026, commit 30cab63)
- ✅ PH3-S3 Promote module — DONE (30 May 2026, this session)
- ✅ Node.js 24 upgrade — DONE (30 May 2026)
- ⚠ advisor_profiles RLS — currently open (USING true); run SQL above before PH3-S4
- ⚠ promo_messages — table exists but 0 rows; run INSERT above to test Promote UI
- ⚠ REINDEX needed: `REINDEX INDEX CONCURRENTLY nav_history_scheme_id_nav_date_idx;`
- ⚠ advisor_client_links test INSERT — run manual SQL to verify ClientListWidget
- Phase 4 build warnings: FDvsMF.jsx line 533 (duplicate style), CompareSchemes.jsx lines 775/823 (duplicate border)
- Supabase disk: 12 GB autoscaled · ~6.3 GB used

## Session history:
- Phase 2 (PL-1 → PL-16): all ✅ Done — 24 May 2026
- Auth fix (24 May 2026): useAuth.jsx + api/admin.js + AdminLayout.jsx ✅
- Nav Admin Console link fix (24 May 2026): Nav.jsx ✅
- Node.js 24 upgrade (30 May 2026): FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 in 4 GHA workflows ✅
- PH3-S1 Advisor Dashboard (30 May 2026): 5-widget dashboard, commit 07e15f1 ✅
- PH3-S2 White-label branding (30 May 2026): AdvisorSettings + F5 PDF branding, commit 30cab63 ✅
- PH3-S3 Promote module (30 May 2026): AdvisorPromote + promote_shortcut widget + Nav wiring + html2canvas ✅
- Next: PH3-S4 — Advisor onboarding flow
