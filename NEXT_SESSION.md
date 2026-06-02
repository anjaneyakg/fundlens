# NEXT SESSION — FundLens
Last updated: 02 Jun 2026 (EB-S2 Analytics + Dues full implementation)

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## EB-S2 status: DONE ✅ (02 Jun 2026)
- ExpenseAnalytics.jsx: 8 sections (A–H), recharts 2.12.7
  - A: mask/unmask pill toggle (grey charts + ₹ •••• when masked)
  - B: period selector (This Month / Last Month / 3M / 6M / This Year / Custom)
  - C: summary tiles (Income, Expense, Net with txn counts)
  - D: category donut chart + budget utilisation list (green/amber/red bars)
  - E: 6-month income/expense bar chart (always last 6 months, ignores period filter)
  - F: payment source split pie + legend
  - G: CC reconciliation (billing cycle, manual bill input, diff, Log Untracked, Mark Resolved)
  - H: 12-month projection (ComposedChart: committed + variable stacked + total line, projection table)
- ExpenseManager.jsx: Analytics tab wired, Dues tab full implementation
  - Overdue section (red) + upcoming grouped by This Week / Next Week / Later
  - Mark Paid: addTransaction + computeNextDue + updateRecurringItem + toast
  - Snooze 3d: updateRecurringItem +3 days + toast
  - Empty state: 🎉 All clear!
Build: 966 modules, 0 errors, 0 new warnings.

## EB-S1 status: DONE ✅ (01 Jun 2026 + fixes 02 Jun 2026)
- Full foundation: 4 tables, context, FAB, entry panel, widget, /expenses page
- Visual fixes: light theme, Toast, save FSM, budget alert badges

---

## ⚠️ REQUIRED MANUAL ACTIONS BEFORE TESTING:

1. Run `migrations/005_expense_manager.sql` in Supabase fundlens-prod SQL editor.
   Creates: expense_payment_sources, expense_categories, expense_recurring, expense_transactions.

2. (Carry-over) Run `migrations/004_registration.sql` if not yet done.

3. (Carry-over) Verify `advisor_client_links` table exists in fundlens-prod.

---

## Current priority (do this next):
Task: EB-S3 — Expense Manager UX Polish + Reimbursement Tracker

Scope:
- Subscription audit: list all active subscriptions from recurring items, flag ones not used in 60+ days
- Unusual spend alerts: flag categories where this month's spend is 2x+ the 3-month average
- Reimbursement tracker: filter transactions where is_reimbursable=true, status=pending; UI to mark received
- Family member setup UX polish: persist to localStorage, better flow for adding members
- Export to CSV: transactions in selected date range (no new table — front-end generation)
- Mobile audit pass on ExpenseAnalytics (chart overflow, font sizes, grid layouts)

---

## Expense Manager sessions:
- EB-S1: Foundation ✅
- EB-S1 fixes: Light theme, toast, budget badges ✅
- EB-S2: Analytics + Dues full implementation ✅
- EB-S3: Subscription audit, unusual spend, reimbursement tracker, export ⏳ Pending

---

## Open issues to keep in mind:
- ✅ EB-S1 — DONE (01 Jun 2026)
- ✅ EB-S1 visual fixes — DONE (02 Jun 2026)
- ✅ EB-S2 Analytics + Dues — DONE (02 Jun 2026)
- ✅ PH3-S1 through PH3-S5 — ALL DONE
- ✅ PH4-S5 bug fixes — ALL DONE (31 May 2026)
- ✅ Node.js 24 upgrade — DONE (30 May 2026)
- ⚠ Run migrations/005_expense_manager.sql — REQUIRED before testing /expenses
- ⚠ Run migrations/004_registration.sql — REQUIRED before testing /register
- ⚠ Verify advisor_client_links table exists in fundlens-prod
- ⚠ promo_messages — 0 rows; insert sample rows to test carousel
- ⚠ REINDEX needed: `REINDEX INDEX CONCURRENTLY nav_history_scheme_id_nav_date_idx;`
- Family members in Expense Manager: local state only, not persisted to DB (EB-S3 scope)
- Supabase disk: 12 GB autoscaled · ~6.3 GB used

## EB-S2 architectural notes (for future sessions):
- ExpenseAnalytics: addTransaction prop needed for CC reconciliation "Log Untracked" — always pass from ExpenseManager
- Section E monthly trend: uses ALL `transactions` (not `filtered`) so period selector doesn't affect it — intentional
- CC billing cycle: `getCCBillingCycle(cc)` in ExpenseAnalytics.jsx — handles no billing_cycle_date (falls back to current month)
- 12-month projection: categories covered by recurring items are EXCLUDED from variable estimate to avoid double-count
- DueRow: `processing === r.id` pattern — only the processing item shows loading state, others disabled
- `computeNextDue(r)`: advances by one cycle based on r.frequency — called after Mark Paid, before updateRecurringItem

## Session history:
- Phase 2 (PL-1 → PL-16): all ✅ Done — 24 May 2026
- PH3-S1 through PH3-S5: all ✅ Done — 30-31 May 2026
- PH4-S5 Bug fixes: ✅ Done — 31 May 2026
- EB-S1 Expense Manager foundation (01 Jun 2026): 4 tables, context, entry panel, FAB, widget, /expenses page ✅
- EB-S1 visual fixes (02 Jun 2026): Toast, light theme, save FSM, budget alert badges ✅
- EB-S2 Analytics + Dues (02 Jun 2026): ExpenseAnalytics 8 sections, Dues Mark Paid/Snooze ✅
- Next: EB-S3 — UX polish, reimbursement tracker, subscription audit, export
