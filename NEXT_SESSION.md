# NEXT SESSION — FundLens
Last updated: 31 May 2026 (PH4-S5 Bug fixes done)

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## Phase 3 status: ALL DONE ✅
PH3-S1: Advisor Dashboard at /advisor (5 widgets) — commit 07e15f1
PH3-S2: White-label branding system — AdvisorSettings /advisor/settings, F5 PDF branding — commit 30cab63
PH3-S3: Promote module — /advisor/promote, 3 leaflet templates, email/WhatsApp copy, html2canvas JPEG export — commit 0506b8b
PH3-S4: Registration wizard, promo codes, debarred check, admin notifications — commit f909377
PH3-S5: Client invitation flow — api/advisor.js, AdvisorInviteClient, AcceptInvite, Register invite handling — commit 4092534

## PH4-S5 status: DONE ✅
- Fix 1: CompareSchemes.jsx — removed duplicate `border` keys (build warnings)
- Fix 2: FDvsMF.jsx — merged duplicate style props on range input (build warning)
- Fix 3: SchemeMapping.jsx — AMC autocomplete no longer bleeds across AMCs
- Fix 4: CompareSchemes.jsx categorySlug — apostrophes stripped before slugifying ("children_s" → "childrens")
- Fix 5: SIPCalculator.jsx — migrated to Supabase nav_history (primary) + mfapi fallback
Build: 960 modules, 0 errors, 0 new warnings.

---

## ⚠️ REQUIRED MANUAL ACTIONS BEFORE TESTING:

1. Run `migrations/004_registration.sql` in Supabase fundlens-prod SQL editor.
   Creates: promo_codes, regulatory_debarred, admin_notifications tables.
   Also ALTERs advisor_profiles (adds 12 new columns) and tightens RLS.

2. Verify `advisor_client_links` table exists in fundlens-prod (it was referenced in PH3-S1 ClientListWidget).
   If it doesn't exist, create it with the columns listed in CURRENT_STATE.md PH3-S5 section.

---

## Current priority (do this next):
Task: PH4-S6 — Mobile Responsive Audit

Scope:
- Audit all pages/components at 375px viewport
- Add/fix useWindowWidth() for conditional layouts everywhere it's missing
- Fix any hard-coded pixel widths that break at mobile
- Ensure Plan tools (calculators) work at 375px
- Ensure nav drawer works correctly at all sizes
- Check PortfolioLens pages for mobile issues

Remaining Phase 4 scope from PLATFORM_STATE.md:
- PH4-S1: Online assistant — pre-login
- PH4-S2: Online assistant — post-login
- PH4-S3: Admin module upgrades (carousel mgmt, role mgmt, advisor approval)
- PH4-S6: Mobile responsive audit (375px, useWindowWidth() everywhere) ← DO THIS NEXT
- PH4-S7: Performance & SEO (lazy loading, code splitting, meta tags, sitemap)

---

## Open issues to keep in mind:
- ✅ PH3-S1 through PH3-S5 — ALL DONE
- ✅ PH4-S5 bug fixes — ALL DONE (31 May 2026)
- ✅ Node.js 24 upgrade — DONE (30 May 2026)
- ✅ advisor_profiles RLS tightened — in migration 004 (run manually)
- ✅ Build warnings (duplicate border/style) — FIXED in PH4-S5
- ⚠ Run migrations/004_registration.sql — REQUIRED before testing /register and /accept-invite
- ⚠ Verify advisor_client_links table exists in fundlens-prod with correct schema
- ⚠ promo_messages — table exists but 0 rows; insert sample rows to test Promote UI
- ⚠ REINDEX needed: `REINDEX INDEX CONCURRENTLY nav_history_scheme_id_nav_date_idx;`
- Supabase disk: 12 GB autoscaled · ~6.3 GB used

## PH4-S5 architectural notes (for future sessions):
- SIPCalculator.jsx now imports `supabase` from `../lib/supabaseClient`
- loadNavHistory: Supabase primary (.limit(10000)), mfapi fallback — navMap key format preserved (UTC YYYY-MM-DD via toISOString)
- SchemeMapping.jsx: amfiSchemes returns `[]` (not all schemes) when AMC name has no exact match in amfiMap — users can still type custom names
- CompareSchemes.jsx categorySlug: apostrophes stripped first with `/'/g → ""`, then `/[^a-z0-9]+/g → "_"` — matches SchemeBasket slugify output
- Note: SchemeBasket.jsx slugify was already correct (used `/[^a-z0-9\s]/g → ""`), only CompareSchemes needed the fix

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
- PH3-S5 Client invitation flow (31 May 2026): api/advisor.js + AdvisorInviteClient + AcceptInvite + Register invite handling, commit 4092534 ✅
- PH4-S5 Bug fixes (31 May 2026): CompareSchemes border/slug, FDvsMF style merge, SchemeMapping autocomplete, SIPCalculator mfapi migration ✅
- Next: PH4-S6 — Mobile responsive audit
