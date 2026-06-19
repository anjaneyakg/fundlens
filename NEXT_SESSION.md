# NEXT SESSION — FundLens
Last updated: 19 Jun 2026 (amc_aliases table built — 122 rows; 4 consumers refactored; 24 schemes amc_id resolved)

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## compute_returns.py status: DONE ✅ (04 Jun 2026) — v1.1 IO-optimised
- `FundInsight/pipeline/compute_returns.py` v1.1 (IO-optimised, ready for full run)
- `FundInsight/.github/workflows/daily_returns_sync.yml` — Mon–Fri 18:00 UTC (30 min after daily_nav_sync)
- IO incident 03 Jun: 9 queries/batch × 33 batches exhausted Supabase Disk IO budget
- Fix: 1 combined query/batch via unnest+DISTINCT ON (9× fewer DB round trips)
- Batch size 200 (down from 500), 2s sleep between batches
- IO budget resets at midnight UTC (05:30 IST). **Run full batch on 04 Jun after 05:30 IST.**
- Command: `cd ~/Documents/FundInsight && python pipeline/compute_returns.py`
- Dry-run first is optional — script has been tested, only the full batch remains

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

## EB-Fix-8 status: DONE ✅ (04 Jun 2026)
- Date picker in ExpenseEntryPanel was unclickable: `pointerEvents:'none'` + `width:0, height:0` on the `<input type="date">`
- Fix: removed pointer-events restriction, input now covers full button area via `inset: 0` equivalent
- Affects all txn types (Expense / Income / Transfer-in)

## EB-Balances status: DONE ✅ (04 Jun 2026)
- Balances tab built: household total card, accounts grouped by owner, SVG sparklines
- Tab order: Analytics / Balances / Dues / Log / Setup. Default: Analytics.
- transfer_in excluded from all Analytics calculations (filtered useMemo + monthlyTrend)
- Payment source owner chip (Self + family members) + Set Balance anchor (amount + date) in Setup
- New columns already in Supabase: `balance_amount`, `balance_as_of_date`, `owner_family_member`
- Build: 968 modules, 0 errors

## EB-Fix-9 status: DONE ✅ (04 Jun 2026)
- (1) Set Balance confirmed correct: `updatePaymentSource` already used auth client + user_id RLS filter.
- (2) Balances tab now shows net movement (MODE B) for accounts without opening balance anchor. Household total includes all accounts; asterisk + footnote if any MODE B. `computeAllTimeMovement()` added.
- (3) `updateSplitStatus` fixed: added `.eq('user_id', user.uid)`, `settled_at: null` for non-settled, optimistic setSplits update.

## merge_holdings.py v1.1 status: DONE ✅ (18 Jun 2026) — embedded newline fix

**Problem fixed:** Scheme Mapping page was showing 361 "AMCs" instead of 48. Root cause: Excel ALT+ENTER cells produced `\n` in `scheme_name`/`security_name_raw`/`industry` columns. Pandas quoted these correctly in CSV, but JavaScript `csv.split('\n')` tore them apart, creating phantom rows with ISINs/instrument-types appearing as AMC names.

**Fix:** `merge_holdings.py` v1.1 strips embedded `\r`/`\n` from all text columns before writing CSV. 1,177 rows cleaned (scheme_name 1,080 + security_name_raw 60 + industry 37). holdings_latest.csv re-pushed to GitHub with `GITHUB_WRITE_TOKEN`.

**Verification:** JS naive parse on clean file → exactly 48 unique amc_name values, 0 phantom rows.

**Remaining blocker for Scheme Mapping UI:** Vercel's `VITE_GITHUB_PAT` may need updating to have `repo` scope for the private FundInsight repo (the previous session found it was returning GitHub 404). If /admin/scheme-mapping still shows 0/0 after the holdings_latest.csv fix, update VITE_GITHUB_PAT in Vercel → Project Settings → Environment Variables.

## amc_aliases table: DONE ✅ (19 Jun 2026)

- 122 rows (amfi=69, portfolio_pipeline=50, commit_key=3), 0 null amc_ids
- All 4 inline AMC dicts replaced: merge_holdings.py (v1.2), api/amfi.js AMC_ALIASES_SCHEMES, api/amfi.js AMC_ALIASES_LIST, cell_4d_v2.py _COMMIT_AMC_MAP
- Old dicts commented out with "SUPERSEDED" note in each file; NOT deleted (2-week retention window)
- 24 schemes amc_id resolved: 24/24 via amc_aliases.canonical_name match (resolved in previous session)
- Invesco: canonical="Invesco India Mutual Fund", amc_id=05460347 (amcs table has "Invesco Mutual Fund" — DEFAULTED, flagged)
- Next pipeline table: scheme_code_map (BRD/FRD §8.4) → then cell_c_reconciler.py

## Current priority (do this FIRST next session):

### P0 — Verify Scheme Mapping shows 48 AMCs
1. Open `/admin/scheme-mapping`
2. Confirm sidebar shows exactly 48 AMCs
3. If shows 0/0: Vercel `VITE_GITHUB_PAT` still returning 404 — update it in Vercel env vars with a token that has `repo` scope for FundInsight (same value as `GITHUB_WRITE_TOKEN` in local .env)
4. If shows 48: begin mapping pass (Tier 1 AMCs first — see below)

### P0 — Scheme Mapping pass (after UI confirmed working)

### Step 1 — Scheme Mapping pass

`holdings_latest.csv` now has Mar 2026 data. The Scheme Mapping UI at `/admin/scheme-mapping` needs a full mapping pass.

- 1,603 distinct `scheme_code_amc` values across 48 AMCs need mapping to AMFI scheme names
- `scheme_code_map.json` does NOT exist yet — will be created by this pass
- Priority AMCs (meaningful codes, map first): Kotak, SBI, HDFC, Nippon India, ICICI Prudential, Axis, Bandhan, Aditya Birla Sun Life
- New AMC in Mar: **Choice Mutual Fund** (15 securities, 1 scheme — map first, it's tiny)
- AMCs where scheme_code_amc = full scheme name (Shriram, Trust, JM, Union): these are already self-describing — confirm and save
- AMCs where scheme_code_amc = "Sheet1" (Angel One, Navi, Unifi): pick the correct AMFI scheme manually

After mapping pass: `scheme_code_map.json` will be written to GitHub via the Save button in the UI.

### Step 2 — Cell C: Scheme Reconciler (build after mapping pass)

Context:
- `scheme_portfolios` table has 0 rows. Blocked on Cell C.
- Cell C goal: fuzzy-match scheme_name (from holdings_latest.csv) to AMFI scheme master → resolve AMFI numeric scheme_code → look up scheme_id in `schemes` table
- scheme_code_map.json acts as override/fallback for low-confidence fuzzy matches
- Output: `scheme_code_amfi_map.csv` with (amc_name, scheme_name, scheme_id, confidence, match_method)
- After Cell C: build `cell_c_upsert.py` + `scheme_portfolios` DDL → upsert to Supabase

Read at session start: `cell_4d_v2.py`, `merge_holdings.py`, `pipeline/compute_returns.py` (for Supabase write pattern).

### Key notes for Cell C build:
- `scheme_code_amc` = sheet_name from Excel. For many AMCs it is a meaningful code (V3I, SMEEF), for others it is the full scheme name or "Sheet1".
- Match on `scheme_name` (cleaned scheme name), NOT on `scheme_code_amc`.
- Fuzzy match scoped per AMC (only compare within same AMC's schemes in Supabase).
- Use `rapidfuzz` library (fast, MIT license). pip install rapidfuzz.
- `schemes` table has: id (uuid), amfi_code (int), name (text), amc_id (uuid FK).
- `amcs` table has: id (uuid), name (text), short_name (text).
- Need to JOIN schemes with amcs to scope matching per AMC.

---

## Open issues to keep in mind:
- ✅ EB-S1 through EB-S3 — ALL DONE
- ✅ EB-Fix-3 — DONE (03 Jun 2026)
- ✅ EB-Fix-6 — DONE (03 Jun 2026, commit 1224ebc) — income label + transfer_in FROM ACCOUNT row
- ✅ PH3-S1 through PH3-S5 — ALL DONE
- ✅ PH4-S5 bug fixes — ALL DONE (31 May 2026)
- ✅ Node.js 24 upgrade — DONE (30 May 2026)
- ✅ merge_holdings.py v1.1 — DONE (18 Jun 2026) — embedded newline fix; holdings_latest.csv clean (48 AMCs); pushed to GitHub
- ⚠ Vercel VITE_GITHUB_PAT — may need updating to have `repo` scope for private FundInsight repo (Scheme Mapping proxy was returning GitHub 404 as of last session)
- ⚠ scheme_returns table: 0 rows — run `python pipeline/compute_returns.py` from FundInsight/ (first run)
- ⚠ scheme_code_map.json does NOT exist yet — do Scheme Mapping pass at /admin/scheme-mapping first
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
