# NEXT SESSION — FundLens
Last updated: 01 Jun 2026 (EB-S1 Expense Manager foundation done)

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## EB-S1 status: DONE ✅ (01 Jun 2026)
- migrations/005_expense_manager.sql — 4 tables (expense_payment_sources, expense_categories, expense_recurring, expense_transactions) with RLS
- src/context/ExpenseContext.jsx — data layer, auto-default seeding (17 categories + Cash source)
- src/components/expenses/ExpenseEntryPanel.jsx — slide-up entry panel
- src/components/expenses/ExpenseFAB.jsx — fixed FAB, all post-login screens
- src/components/expenses/ExpenseDashboardWidget.jsx — masked/unmasked widget
- src/pages/ExpenseManager.jsx — /expenses, Log + Setup + Analytics (stub) + Dues tabs
- App.jsx — ExpenseProvider wrapper, /expenses route, FAB for authenticated users
- Nav.jsx — "Expenses" as first tab (desktop + mobile drawer)
Build: 964 modules, 0 errors, 0 new warnings.

---

## ⚠️ REQUIRED MANUAL ACTIONS BEFORE TESTING EB-S1:

1. Run `migrations/005_expense_manager.sql` in Supabase fundlens-prod SQL editor.
   Creates: expense_payment_sources, expense_categories, expense_recurring, expense_transactions.
   All 4 tables have RLS: `auth.jwt() ->> 'sub' = user_id`.

2. (Carry-over) Run `migrations/004_registration.sql` if not yet done.
   Creates: promo_codes, regulatory_debarred, admin_notifications.
   Also ALTERs advisor_profiles.

3. (Carry-over) Verify `advisor_client_links` table exists in fundlens-prod.

---

## Current priority (do this next):
Task: EB-S2 — Expense Manager Analytics

Scope:
- Full Analytics tab (replace stub): monthly snapshot, category breakdown donut, month-over-month trend
- Masked/unmasked interaction with eye icon (integrate with ExpenseDashboardWidget mask state)
- CC reconciliation panel: logged spend vs settled amount, billing cycle tracking
- Budget utilisation alerts: per-category, shown in analytics + log tab header
- 12-month cash outflow projection chart (Recharts)
- "Quick Stats" header row on Log tab (upgrade current summary bar)

---

## Expense Manager future sessions:
- EB-S2: Full Analytics tab (charts, CC reconciliation, budget alerts, 12-month projection)
- EB-S3: Push notifications for recurring dues, 12-month projection, family member login/collaboration
- EB-S4: CC statement import (PDF parse), export to CSV, advanced filters

---

## Open issues to keep in mind:
- ✅ EB-S1 — DONE (01 Jun 2026)
- ✅ PH3-S1 through PH3-S5 — ALL DONE
- ✅ PH4-S5 bug fixes — ALL DONE (31 May 2026)
- ✅ Node.js 24 upgrade — DONE (30 May 2026)
- ✅ advisor_profiles RLS tightened — in migration 004 (run manually)
- ✅ Build warnings (duplicate border/style) — FIXED in PH4-S5
- ⚠ Run migrations/005_expense_manager.sql — REQUIRED before testing /expenses
- ⚠ Run migrations/004_registration.sql — REQUIRED before testing /register and /accept-invite
- ⚠ Verify advisor_client_links table exists in fundlens-prod with correct schema
- ⚠ promo_messages — table exists but 0 rows; insert sample rows to test Promote UI
- ⚠ REINDEX needed: `REINDEX INDEX CONCURRENTLY nav_history_scheme_id_nav_date_idx;`
- Supabase disk: 12 GB autoscaled · ~6.3 GB used
- Family members in Expense Manager: stored as text in transactions — local Setup list, NOT persisted to DB yet (EB-S3 scope)

## EB-S1 architectural notes (for future sessions):
- ExpenseContext auto-seeds: fires ONLY if `expense_categories` count === 0 for user — idempotent
- Last-used category/source: `localStorage` keys `eep_last_cat` / `eep_last_src`
- Dues tab: `due_date_next` must be set on recurring items for them to appear — populate this field when adding
- ExpenseFAB: visible when `user && !isGuest` — hidden from guests and on /admin routes
- ExpenseDashboardWidget: importable in any future dashboard page — does NOT need its own provider (already wrapped by AppInner's ExpenseProvider)
- Analytics tab: stub state, renders "coming soon" placeholder with 👁 icon

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
- EB-S1 Expense Manager foundation (01 Jun 2026): 4 tables, context, entry panel, FAB, widget, /expenses page ✅
- Next: EB-S2 — Full Analytics tab
