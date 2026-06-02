# NEXT SESSION — FundLens
Last updated: 02 Jun 2026 (EB-S3 complete — Expense Manager feature-complete)

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## EB-S3 status: DONE ✅ (02 Jun 2026)
- Reimbursable tracker: All/Reimbursable toggle, Pending/Received sections, Mark Received action
- Unusual spend alerts: 90-day category average, 2.5× threshold, ⚠ badge + dismissible banner
- End-of-month summary card: savings rate, top 3, budget overshoot, txn count, prior month comparison (visible on 26th–3rd)
- Subscription audit (Analytics Section I): active subscriptions list, Deactivate button, annual cost highlight
- CSV export: filtered transactions as DD-MMM-YYYY CSV, blob download, toast confirmation
Build: 966 modules, 0 errors, 0 new warnings.

## Expense Manager status: FEATURE COMPLETE ✅
- EB-S1: Foundation — 4 tables, context, FAB, entry panel, widget, /expenses page
- EB-S1 fixes: Light theme, toast, save FSM, budget alert badges
- EB-S2: Analytics (8 sections A–H), Dues tab (Mark Paid, Snooze, grouping)
- Dues bug fix: due_date_next computation, local-time filtering
- EB-S3: Reimbursement tracker, unusual alerts, subscription audit, end-of-month card, CSV export

---

## ⚠️ REQUIRED MANUAL ACTIONS BEFORE TESTING:

1. Run `migrations/005_expense_manager.sql` in Supabase fundlens-prod SQL editor.
   Creates: expense_payment_sources, expense_categories, expense_recurring, expense_transactions.

2. (Carry-over) Run `migrations/004_registration.sql` if not yet done.

3. (Carry-over) Verify `advisor_client_links` table exists in fundlens-prod.

4. Items saved before the dues-tab fix have `due_date_next = NULL`. Re-add them via Setup tab or UPDATE directly in Supabase.

---

## Current priority (do this next):
Task: PH4-S6 — Mobile Responsive Audit

Scope:
- Resume main Phase 4 roadmap (Expense Manager is feature-complete)
- Audit all pages/components at 375px viewport
- Add/fix useWindowWidth() for conditional layouts everywhere it's missing
- Fix any hard-coded pixel widths that break at mobile
- Ensure Plan tools (calculators) work at 375px
- Ensure nav drawer works correctly at all sizes
- Check PortfolioLens pages for mobile issues
- Audit ExpenseAnalytics.jsx chart overflow at narrow viewports

---

## Open issues to keep in mind:
- ✅ EB-S1 through EB-S3 — ALL DONE
- ✅ PH3-S1 through PH3-S5 — ALL DONE
- ✅ PH4-S5 bug fixes — ALL DONE (31 May 2026)
- ✅ Node.js 24 upgrade — DONE (30 May 2026)
- ⚠ Run migrations/005_expense_manager.sql — REQUIRED before testing /expenses
- ⚠ Run migrations/004_registration.sql — REQUIRED before testing /register
- ⚠ Verify advisor_client_links table exists in fundlens-prod
- ⚠ promo_messages — 0 rows; insert sample rows to test carousel
- ⚠ REINDEX needed: `REINDEX INDEX CONCURRENTLY nav_history_scheme_id_nav_date_idx;`
- Family members in Expense Manager: local state only, NOT persisted to DB (EB-S4 future scope)
- ExpenseEntryPanel: `is_reimbursable` toggle NOT added (file restricted in EB-S3). Users can mark via expanded TxnRow in Log tab.
- Supabase disk: 12 GB autoscaled · ~6.3 GB used

## EB-S3 architectural notes (for future sessions):
- `flaggedTransactionIds`: Set from useMemo, computes on `[transactions, filtered]`. Flagging threshold: amount > 2.5× 90-day category average, min 3 prior txns.
- `handleReimbursableUpdate(id, patch)`: unified handler for both "mark reimbursable" and "mark received" — same function, different patch.
- End-of-month card: `summaryOffset = dom <= 3 ? -1 : 0`. Summary shows for closing month when near month-end.
- Subscription audit: `deactivatedIds` local Set for optimistic removal; `updateRecurringItem` is now passed as prop to ExpenseAnalytics.
- CSV export: uses `fmtDateLong(d)` helper (DD-MMM-YYYY) not `fmtDate` (DD/MM/YY). Blob + URL.createObjectURL pattern.
- Reimbursable view: shows ALL-TIME reimbursable txns (not period-filtered). Pending/Received sections.

## Session history:
- EB-S1 Expense Manager foundation (01 Jun 2026) ✅
- EB-S1 visual fixes (02 Jun 2026) ✅
- EB-S2 Analytics + Dues (02 Jun 2026) ✅
- Dues tab bug fix (02 Jun 2026) ✅
- EB-S3 Reimbursement + alerts + subscription + CSV (02 Jun 2026) ✅
- Next: PH4-S6 — Mobile responsive audit (resume main Phase 4 roadmap)
