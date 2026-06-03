# NEXT SESSION — FundLens
Last updated: 03 Jun 2026 (compute_returns.py v1.0 + daily_returns_sync cron)

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## compute_returns.py status: DONE ✅ (03 Jun 2026)
- `FundInsight/pipeline/compute_returns.py` v1.0 written
- `FundInsight/.github/workflows/daily_returns_sync.yml` — Mon–Fri 18:00 UTC (30 min after daily_nav_sync)
- Reads nav_history via psycopg2 (10 queries/batch: 9 standard anchors + 1 inception)
- Writes to scheme_returns via supabase-py upsert ON CONFLICT (scheme_id, as_of_date)
- **First run NOT yet done** — scheme_returns table has 0 rows

## EB-Fix-6 status: DONE ✅ (03 Jun 2026, commit 1224ebc)
- Income label: "PAYMENT SOURCE" → "INTO ACCOUNT" in entry panel
- Transfer-in: FROM ACCOUNT chip row added above TRANSFERRED FROM people row

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

## Current priority (do this FIRST next session):

### Step 0 — Run compute_returns.py (before any other work)
```bash
cd ~/Documents/FundInsight
# Activate venv: source .venv/Scripts/activate  (Git Bash)
python pipeline/compute_returns.py --dry-run --verbose
# Confirm output matches expected format, then:
python pipeline/compute_returns.py
# Verify scheme_returns row count in Supabase after full run
```

### Step 1 — Cell C: Scheme Reconciler (main pipeline task)

Context:
- `scheme_portfolios` table has 0 rows. Blocked on Cell C.
- Feb 2026: 115,469 rows in `holdings_raw_4d_2026-02.csv` (47 AMCs)
- Mar 2026: 119,308 rows in `holdings_raw_4d_2026-03.csv` (48 AMCs)
- Cell C goal: fuzzy-match holding names in the CSV to AMFI scheme master → populate `scheme_code_amfi`
- After Cell C: build `merge_holdings.py` → `master_holdings.csv` → Phase C Supabase upsert

Read at session start: `cell_4d_v2.py`, `amcList.js` (scheme master reference), the two CSV output files.

---

## Open issues to keep in mind:
- ✅ EB-S1 through EB-S3 — ALL DONE
- ✅ EB-Fix-3 — DONE (03 Jun 2026)
- ✅ EB-Fix-6 — DONE (03 Jun 2026, commit 1224ebc) — income label + transfer_in FROM ACCOUNT row
- ✅ PH3-S1 through PH3-S5 — ALL DONE
- ✅ PH4-S5 bug fixes — ALL DONE (31 May 2026)
- ✅ Node.js 24 upgrade — DONE (30 May 2026)
- ⚠ scheme_returns table: 0 rows — run `python pipeline/compute_returns.py` from FundInsight/ (first run)
- ⚠ Add SUPABASE_DB_PASSWORD to FundInsight repo GHA secrets (for daily_returns_sync.yml)
- ⚠ Run migrations/005_expense_manager.sql — REQUIRED before testing /expenses
- ⚠ Run migrations/004_registration.sql — REQUIRED before testing /register
- ⚠ Verify advisor_client_links table exists in fundlens-prod
- ⚠ promo_messages — 0 rows; insert sample rows to test carousel
- ⚠ REINDEX: **do NOT use Supabase browser SQL editor (times out)**. Run: `cd ~/Documents/FundInsight && python pipeline/reindex_nav.py`
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
- EB-Fix-6 Income label + transfer_in FROM ACCOUNT row (03 Jun 2026) ✅
- compute_returns.py v1.0 + daily_returns_sync.yml cron (03 Jun 2026) ✅
- Next: Run compute_returns.py --dry-run, then full run; then Cell C — Scheme Reconciler
