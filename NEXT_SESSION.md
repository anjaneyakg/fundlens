# NEXT SESSION — FundLens
Last updated: 30 May 2026 (PH3-S2 White-label branding done)

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## Phase 3 status: PH3-S1 ✅ PH3-S2 ✅
PH3-S1: Advisor Dashboard at /advisor (5 widgets) — commit 07e15f1
PH3-S2: White-label branding system — AdvisorSettings at /advisor/settings, F5 PDF branding — commit 30cab63
Build: 953 modules, 0 errors.

---

## Current priority (do this first):
Task: PH3-S3 — Promote module
Route: /promote (existing nav tab, currently dead) → new pages

### PH3-S3 Promote module spec

Build the Promote tab content for advisors:

**Deliverables:**
1. `/promote/leaflets` — PDF co-branded one-pager generator using saved branding
   - Pull branding from advisor_firm_profiles (same Supabase fetch as AdvisorSettings)
   - Fill a pre-designed A4 layout: firm logo + name, tagline, 3 fund picks (advisor selects), contact details, disclaimer
   - window.print() to PDF
2. `/promote/email-draft` — email template builder
   - Select a template type (Portfolio Review, Goal Review, Market Update)
   - Pre-filled text with advisor firm_name and client greeting
   - Copy to clipboard button
3. `/promote/whatsapp` — WhatsApp message template
   - Similar to email draft but formatted for WhatsApp (shorter, emoji-friendly)
   - One-click `https://wa.me/?text=...` link

**Nav wire-up:**
- Promote tab already shows for `advisorMode && isAdvisor` in Nav.jsx
- The NavTab type is 'track' (navigates on click, no dropdown) — update to show as a dropdown with 3 items: Leaflets, Email Draft, WhatsApp

**Do NOT touch:**
- vercel.json
- All E1–E8, F1–F6 pages
- /admin routes

## Priority 2: Tighten advisor_profiles RLS

Run this SQL in Supabase fundlens-prod SQL editor before PH3-S3:

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

Note: advisor_firm_profiles (new table) has correct RLS already.

## Open issues to keep in mind:
- ✅ PH3-S1 Advisor Dashboard — DONE (30 May 2026, commit 07e15f1)
- ✅ PH3-S2 White-label branding — DONE (30 May 2026, commit 30cab63)
- ✅ Node.js 24 upgrade — DONE (30 May 2026)
- ⚠ advisor_profiles RLS — currently open (USING true); run SQL above before PH3-S3
- ⚠ REINDEX needed: `REINDEX INDEX CONCURRENTLY nav_history_scheme_id_nav_date_idx;`
- ⚠ advisor_client_links test INSERT — run manual SQL to verify ClientListWidget in AdvisorDashboard
- Phase 4 build warnings: FDvsMF.jsx line 533 (duplicate style), CompareSchemes.jsx lines 775/823 (duplicate border)
- Supabase disk: 12 GB autoscaled · ~6.3 GB used

## Session history:
- Phase 2 (PL-1 → PL-16): all ✅ Done — 24 May 2026
- Auth fix (24 May 2026): useAuth.jsx + api/admin.js + AdminLayout.jsx ✅
- Nav Admin Console link fix (24 May 2026): Nav.jsx ✅
- Node.js 24 upgrade (30 May 2026): FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 in 4 GHA workflows ✅
- PH3-S1 Advisor Dashboard (30 May 2026): 5-widget dashboard, commit 07e15f1 ✅
- PH3-S2 White-label branding (30 May 2026): AdvisorSettings + F5 PDF branding, commit 30cab63 ✅
- Next: PH3-S3 — Promote module
