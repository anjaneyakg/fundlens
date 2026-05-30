# NEXT SESSION — FundLens
Last updated: 30 May 2026 (PH3-S1 Advisor Dashboard done · Node.js 24 done)

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## Phase 3 status: PH3-S1 ✅ DONE
Advisor Dashboard live at /advisor (commit 07e15f1).
5 widgets: My Assets, Client List, Health Snapshot, Alerts, Market Indicators.
advisor_client_links + bse_index_data + airrow_sentiment_archive all queried.
Nav user dropdown shows "📊 Advisor Dashboard" for advisor + admin roles.
Build: 952 modules, 0 errors.

---

## Current priority (do this first):
Task: PH3-S2 — White-label system
Route: /advisor (existing dashboard) + Nav.jsx + advisor_profiles table

### PH3-S2 White-label spec

Show advisor firm name and logo throughout the experience when advisor is logged in.

**Deliverables:**
1. Tighten `advisor_profiles` RLS — currently `USING true` (open). Update to allow:
   - Advisor reads/updates their own row: `auth.jwt() ->> 'sub' = user_id`
   - Admin reads all rows
   Write the migration SQL and run it in Supabase SQL editor.
2. `useAdvisorTheme.jsx` already injects CSS and logo — verify it uses `profiles!client_id` correctly
3. AdvisorDashboard.jsx header — show `advisor_profiles.firm_name` below greeting when set
4. F5SendReport.jsx — uses `fundlens_advisor_profile` from localStorage; update to also try Supabase `advisor_profiles`
5. Add "Firm Settings" stub page at `/advisor/settings` — form to set firm_name, logo_url, css_override

**Do NOT touch:**
- All E1–E8, F1–F6 pages (Phase 2 done)
- /admin routes
- vercel.json

## Manual test SQL for advisor_client_links (run in Supabase SQL editor):

```sql
-- Populate ClientListWidget with a test client for visual verification.
-- Replace YOUR_FIREBASE_UID with your actual UID (visible in Supabase profiles table or browser console).

INSERT INTO advisor_client_links (
  advisor_id,
  client_id,
  link_origin,
  status,
  can_view_portfolio, can_view_goals, can_view_family,
  can_view_health, can_view_reports,
  can_send_alerts, can_send_reports, can_add_to_cart,
  client_label
) VALUES (
  'YOUR_FIREBASE_UID',
  'TEST_CLIENT_UID_00001',
  'manual',
  'active',
  true, true, false, true, true, true, true, false,
  'Test Client — Ramesh K.'
)
ON CONFLICT DO NOTHING;
```

After running: visit /advisor → Client List widget should show 1 row.

## Do NOT touch in next session:
- vercel.json (catch-all in place — do not change)
- Firebase auth files (src/firebase.js, src/hooks/useAuth.jsx, src/hooks/useRole.jsx)
- pipeline scripts (unless NAV session)
- All E1–E8, F1–F6 pages (Phase 2 done)
- src/advisor/AdvisorDashboard.jsx (unless PH3-S2 spec requires it)

## Open issues to keep in mind:
- ✅ Node.js 24 upgrade — DONE (30 May 2026, FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 in all GHA workflows)
- ✅ PH3-S1 Advisor Dashboard — DONE (30 May 2026, commit 07e15f1)
- ✅ User Manager bug — FIXED (useAuth.jsx + api/admin.js now use profiles table)
- ✅ Role detection bug — FIXED (profiles table, onIdTokenChanged, fresh token)
- ✅ VITE_SUPABASE_ANON_KEY — added to Vercel 24 May 2026
- ✅ SUPABASE_SERVICE_KEY + SUPABASE_SERVICE_ROLE_KEY — added to Vercel 24 May 2026
- ✅ Migrations 002 + 003 — run in fundlens-prod 24 May 2026
- ⚠ advisor_profiles RLS — currently open (USING true); tighten in PH3-S2
- ⚠ REINDEX needed: `REINDEX INDEX CONCURRENTLY nav_history_scheme_id_nav_date_idx;` in Supabase SQL editor
- ⚠ advisor_client_links test INSERT — run manual SQL above before PH3-S2 to verify ClientListWidget
- Phase 4 build warnings: FDvsMF.jsx line 533 (duplicate style), CompareSchemes.jsx lines 775/823 (duplicate border)
- Supabase disk: 12 GB autoscaled · ~6.3 GB used · key migrated to sb_secret format

## Session history:
- Phase 2 (PL-1 → PL-16): all ✅ Done — 24 May 2026
- Auth fix (24 May 2026): useAuth.jsx + api/admin.js + AdminLayout.jsx + migrations 001/002 ✅
- Nav Admin Console link fix (24 May 2026): surgical 3-edit fix to Nav.jsx ✅
- Node.js 24 upgrade (30 May 2026): FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 in 4 GHA workflow files ✅
- PH3-S1 Advisor Dashboard (30 May 2026): 5-widget dashboard, client list, market indicators, AIrrow sentiment ✅
- Next: PH3-S2 — White-label system
