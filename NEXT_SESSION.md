# NEXT SESSION — FundLens
Last updated: 03 Jun 2026 (EB-Fix-3 complete — CC reconcile moved, currency prefs, multi-currency entry)

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## EB-Fix-3 status: DONE ✅ (03 Jun 2026)
- CC Reconciliation removed from Analytics tab entirely (Section G deleted)
- CC Reconcile added as 3rd sub-tab in Log tab; settlement persisted to `expense_payment_sources.last_settled_amount/cycle`
- `expense_currency_prefs` table wired into ExpenseContext (fetch, addCurrencyPref, updateCurrencyRate, removeCurrencyPref)
- Foreign Currencies section added to Setup tab (locked INR, user currencies with inline edit/remove, quick-add chips, add form)
- Entry panel: currency chip row + FX rate row + live INR preview + saves original_amount/currency/fx_rate_used/inr_equivalent
- TxnRow: FX sub-line shown when original_currency is set

## Expense Manager — current SQL schema
All SQL already run manually before EB-Fix-3 session:
- `expense_payment_sources`: + last_settled_amount numeric, last_settled_cycle text
- `expense_transactions`: + original_amount numeric, original_currency text, fx_rate_used numeric, inr_equivalent numeric
- `expense_currency_prefs` table (new): id, user_id, currency_code, currency_symbol, display_name, fx_rate_to_inr, is_default, display_order, rate_updated_at, created_at; UNIQUE(user_id, currency_code)

---

## ⚠️ REQUIRED MANUAL ACTIONS BEFORE TESTING:

1. Run `migrations/005_expense_manager.sql` in Supabase fundlens-prod SQL editor (if not yet done).
   Creates: expense_payment_sources, expense_categories, expense_recurring, expense_transactions.

2. (Carry-over) Run `migrations/004_registration.sql` if not yet done.

3. (Carry-over) Verify `advisor_client_links` table exists in fundlens-prod.

4. Items saved before the dues-tab fix have `due_date_next = NULL`. Re-add them via Setup tab or UPDATE directly in Supabase.

---

## Current priority (do this next):
Task: EB-Fix-4 — Split Expense + Friends List + Friend Analytics

Scope:
- **Split expense**: Log an expense shared between multiple people (e.g., ₹1000 restaurant bill split 3 ways). UI: "Split" toggle in entry panel; enter N participants + their share. Saves multiple expense_transactions (one per person). Optional: "Send request" to a friend.
- **Friends list**: New sub-table `expense_friends` (id, user_id, friend_name, phone_or_email, notes, created_at). CRUD in Setup tab (Section G — Friends). Display friends as chips in the Split expense flow.
- **Friend analytics**: In Analytics tab or Log tab, show outstanding split balances — who owes you and how much. Aggregate from split transactions.

No SQL needed at session start — new tables (`expense_friends`, `expense_splits`) will be created in that session's manual SQL block.

Read at session start: ExpenseManager.jsx, ExpenseEntryPanel.jsx, ExpenseContext.jsx (only these three).

---

## Open issues to keep in mind:
- ✅ EB-S1 through EB-S3 — ALL DONE
- ✅ EB-Fix-3 — DONE (03 Jun 2026)
- ✅ PH3-S1 through PH3-S5 — ALL DONE
- ✅ PH4-S5 bug fixes — ALL DONE (31 May 2026)
- ✅ Node.js 24 upgrade — DONE (30 May 2026)
- ⚠ Run migrations/005_expense_manager.sql — REQUIRED before testing /expenses
- ⚠ Run migrations/004_registration.sql — REQUIRED before testing /register
- ⚠ Verify advisor_client_links table exists in fundlens-prod
- ⚠ promo_messages — 0 rows; insert sample rows to test carousel
- ⚠ REINDEX needed: `REINDEX INDEX CONCURRENTLY nav_history_scheme_id_nav_date_idx;`
- Family members in Expense Manager: local state only, NOT persisted to DB (EB-S4 future scope)
- ExpenseEntryPanel: `is_reimbursable` toggle NOT added. Users can mark via expanded TxnRow in Log tab.
- Supabase disk: 12 GB autoscaled · ~6.3 GB used
- Currency prefs: capped at 3 foreign currencies (plus locked INR). Quick-add chips for USD/EUR/GBP/AED/SGD/JPY.

## Session history:
- EB-S1 Expense Manager foundation (01 Jun 2026) ✅
- EB-S1 visual fixes (02 Jun 2026) ✅
- EB-S2 Analytics + Dues (02 Jun 2026) ✅
- Dues tab bug fix (02 Jun 2026) ✅
- EB-S3 Reimbursement + alerts + subscription + CSV (02 Jun 2026) ✅
- EB-Fix-3 CC reconcile to Log tab, CC settlement persistence, multi-currency FX (03 Jun 2026) ✅
- Next: EB-Fix-4 — Split expense + friends list + friend analytics
