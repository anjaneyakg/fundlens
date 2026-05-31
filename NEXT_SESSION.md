# NEXT SESSION — FundLens
Last updated: 31 May 2026 (PH3-S5 Client invitation flow done — Phase 3 complete)

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## Phase 3 status: ALL DONE ✅
PH3-S1: Advisor Dashboard at /advisor (5 widgets) — commit 07e15f1
PH3-S2: White-label branding system — AdvisorSettings /advisor/settings, F5 PDF branding — commit 30cab63
PH3-S3: Promote module — /advisor/promote, 3 leaflet templates, email/WhatsApp copy, html2canvas JPEG export — commit 0506b8b
PH3-S4: Registration wizard, promo codes, debarred check, admin notifications — commit f909377
PH3-S5: Client invitation flow — api/advisor.js, AdvisorInviteClient, AcceptInvite, Register invite handling — this session
Build: 960 modules, 0 errors.

---

## ⚠️ REQUIRED MANUAL ACTIONS BEFORE TESTING:

1. Run `migrations/004_registration.sql` in Supabase fundlens-prod SQL editor.
   Creates: promo_codes, regulatory_debarred, admin_notifications tables.
   Also ALTERs advisor_profiles (adds 12 new columns) and tightens RLS.

2. Verify `advisor_client_links` table exists in fundlens-prod (it was referenced in PH3-S1 ClientListWidget).
   If it doesn't exist, create it with the columns listed in CURRENT_STATE.md PH3-S5 section.

---

## Current priority (do this next):
Task: PH4-S1 — Phase 4 Polish

Phase 4 scope from PLATFORM_STATE.md:
- PH4-S1: Online assistant — pre-login
- PH4-S2: Online assistant — post-login
- PH4-S3: Admin module upgrades (carousel mgmt, role mgmt, advisor approval)
- PH4-S5: Bug fixes (SchemeMapping autocomplete, SchemeBasket slug, SIPCalculator)
- PH4-S6: Mobile responsive audit (375px, useWindowWidth() everywhere)
- PH4-S7: Performance & SEO (lazy loading, code splitting, meta tags, sitemap)

Recommended starting point: PH4-S5 (bug fixes) + PH4-S6 (mobile audit) — most impactful for go-live readiness.

---

## Open issues to keep in mind:
- ✅ PH3-S1 through PH3-S5 — ALL DONE
- ✅ Node.js 24 upgrade — DONE (30 May 2026)
- ✅ advisor_profiles RLS tightened — in migration 004 (run manually)
- ⚠ Run migrations/004_registration.sql — REQUIRED before testing /register and /accept-invite
- ⚠ Verify advisor_client_links table exists in fundlens-prod with correct schema
- ⚠ promo_messages — table exists but 0 rows; insert sample rows to test Promote UI
- ⚠ REINDEX needed: `REINDEX INDEX CONCURRENTLY nav_history_scheme_id_nav_date_idx;`
- Phase 4 build warnings (Phase 4 fixes): FDvsMF.jsx line 533 (duplicate style), CompareSchemes.jsx lines 775/823 (duplicate border)
- Supabase disk: 12 GB autoscaled · ~6.3 GB used

## PH3-S5 architectural notes (for future sessions):
- `api/advisor.js` is new (7th serverless function — within Vercel Hobby 12-function limit)
- `requireAdvisor()` checks profiles.role IN ('advisor', 'admin')
- Invite URL hardcoded to https://fundlens.in/accept-invite?token=TOKEN (production)
- accept-invite is idempotent for the same client_id (returns already_linked: true if re-used by same user)
- Register.jsx reads ?invite= param and calls accept-invite after refreshRole()
- advisor_client_links: client_id is null for 'invited' and 'placeholder' rows until accepted
- AdvisorDashboard WidgetCard now accepts headerExtra prop (minimal surgical change)

## Session history:
- Phase 2 (PL-1 → PL-16): all ✅ Done — 24 May 2026
- Auth fix (24 May 2026): useAuth.jsx + api/admin.js + AdminLayout.jsx ✅
- Nav Admin Console link fix (24 May 2026): Nav.jsx ✅
- Node.js 24 upgrade (30 May 2026): FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 in 4 GHA workflows ✅
- PH3-S1 Advisor Dashboard (30 May 2026): 5-widget dashboard, commit 07e15f1 ✅
- PH3-S2 White-label branding (30 May 2026): AdvisorSettings + F5 PDF branding, commit 30cab63 ✅
- PH3-S3 Promote module (30 May 2026): AdvisorPromote + promote_shortcut widget + Nav wiring + html2canvas, commit 0506b8b ✅
- PH3-S4 Onboarding flow (31 May 2026): Register wizard, promo codes, debarred check, admin notifications, commit f909377 ✅
- Auth bug fixes (31 May 2026): token guard in AdvisorApplications (4b16731), SERVICE_KEY fallback (802c422), debug logs (6f67e2a/780475c) ✅
- PH3-S5 Client invitation flow (31 May 2026): api/advisor.js + AdvisorInviteClient + AcceptInvite + Register invite handling ✅
- Next: Phase 4 — Polish & Pre-launch
