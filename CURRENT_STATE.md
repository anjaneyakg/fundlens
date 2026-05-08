# FundLens — Current State (Pipeline, Data & Build Track)

**Owner:** Claude Code
**Last updated:** 09 May 2026 · v23.1
**Companion file:** `PLATFORM_STATE.md` — design, auth decisions, go-live plan

> **Session protocol:**
> Fetch BOTH files at session start:
> - `https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md`
> - `https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md`
>
> Update ONLY `CURRENT_STATE.md` at session close. Never touch `PLATFORM_STATE.md`.
> Always: update file → `git add` → `git commit` → `git push` before ending session.

---

## Access Control System — Live (26 Apr 2026)

| Item | Status |
|---|---|
| Migration 07: RTA Portfolio Module tables (staging + prod) | ✅ Done |
| Migration 08: Tiers, roles, feature_flags seeded (staging + prod) | ✅ Done |
| `useAuth.jsx` + `ProtectedRoute.jsx` | ✅ Live |
| Login page at `/login` | ✅ Live |
| Admin: User Manager at `/admin/users` | ✅ Live |
| Admin: Tool Access Matrix at `/admin/tool-access` | ✅ Live |
| `.gitignore` created (node_modules, dist, .env excluded) | ✅ Done |

**Last commit:** 68705d1

---

## PortfolioLens Build Status

| Session | Deliverable | Status |
|---|---|---|
| PL-1 | Shell layout + sidebar + routing | ✅ Done |
| PL-2 | F6 Data Manager + DPDP consent wizard | ✅ Done |
| PL-3 | Parser engine (CAMS + KFin + Holdings) + portfolioEngine.js | ✅ Done |
| PL-4 | E1 Dashboard | ✅ Done |
| PL-5 | E2 Visual Overview | ✅ Done |
| PL-6 | E3 Holdings & Exposure | ✅ Done |
| PL-7 | E4 Overlap Analysis | ✅ Done |
| PL-8 | E5 Performance Matrix | ✅ Done |
| PL-9 | E6 Cashflow & Returns | ✅ Done |
| PL-10 | E7 Capital Gains | ✅ Done |
| PL-11 | E8 Transaction Report | ✅ Done |
| PL-12 | F1 Health Check (8 rules) | ⏳ Next |
| PL-13 | F2 Alerts engine | ⏳ Pending |
| PL-14 | F3 Rebalance Planner | ⏳ Pending PL-12 |
| PL-15 | F4 Model Portfolio | ⏳ Pending |
| PL-16 | F5 Send Report | ⏳ Pending PL-12 |
| PL-17 | Advisor mode | ⏳ Pending all E+F |

### PortfolioLens Key Files

| File | Purpose |
|---|---|
| `src/pages/PortfolioLens/` | All PL pages and utils |
| `src/pages/PortfolioLens/utils/fileParser.js` | CAMS / KFin / Holdings Excel parser (SheetJS) |
| `src/pages/PortfolioLens/utils/portfolioEngine.js` | XIRR, avg-cost, buildHoldings, portfolioXirr, summarise |
| `src/pages/PortfolioLens/utils/portfolioStore.js` | localStorage CRUD + DPDP consent |
| `src/pages/PortfolioLens/F6DataManager.jsx` | DPDP consent gate + 3-step add wizard + parse button |
| `src/pages/PortfolioLens/E1Dashboard.jsx` | Summary cards, top holdings table, LTCG hint |
| `src/pages/PortfolioLens/E2Overview.jsx` | Category donut, AMC treemap, journey chart, plan/option donuts |
| `src/pages/PortfolioLens/E3Holdings.jsx` | Filterable holdings table + expand drill-down + exposure summary |
| `src/pages/PortfolioLens/E4Overlap.jsx` | Tag-based Jaccard similarity matrix + clustered heatmap + ranked pairs |
| `src/pages/PortfolioLens/E5Performance.jsx` | XIRR-ranked scheme table + category & AMC breakdown tabs |
| `src/pages/PortfolioLens/E6CashflowReturns.jsx` | Year-wise cashflow bar chart + FY/CY toggle + annual table |
| `src/pages/PortfolioLens/E7CapitalGains.jsx` | Unrealised/realised gains · LTCG/STCG · grandfathering (2018) · tax estimates |
| `src/pages/PortfolioLens/E8TransactionReport.jsx` | Full transaction log · avg-cost P&L on sells · FY/type/search filters · pagination |
| `src/hooks/useWindowWidth.js` | Responsive width hook |

**localStorage keys:** `fundlens_pl_consent`, `fundlens_portfolios` (schema_version: "2.0" — portfolio is investor-level with raw.cams/kfin/holdings slots)
**SheetJS:** xlsx 0.18.5 added for .xls/.xlsx parsing

---

## Immediate Next Session Priorities

1. **PL-12** — F1 Health Check (8-rule engine with confidence scoring — time horizon to liquidity stress)
2. **Fix User Manager** — "Loading users" bug — pass `accessToken` to `sbFetch`
3. **Deploy to Vercel staging** — test `set-user-tier` + `set-flag` APIs
4. **Add `VITE_SUPABASE_ANON_KEY`** to Vercel environment variables
5. **NAV Backfill** — resume from 2018-01-01 when Supabase is stable (see `backfill_nav_history.py`)

---

## Database State — Supabase fundlens-prod

| Table | Rows | Status | Notes |
|---|---|---|---|
| `amcs` | 51 | ✅ Complete | 104 name variations (51 canonical + 53 alternates) |
| `schemes` | 16,364 | ✅ Complete | All active schemes, 100% AMC linkage |
| `nav_history` | 0 | ⏳ Awaiting backfill | Script validated at 99.5% match rate. Resume from 2018-01-01. |
| `bse_index_data` | 264,628 | ✅ Complete | BSE index data |
| `scrip_master` | 5,158 | ✅ Complete | Securities master |

**Storage:** ~16MB current · ~6.3GB projected after full backfill
**Supabase tier:** Pro ($25/mo) ✅ approved

### Supabase Instances

| Instance | Status | Notes |
|---|---|---|
| fundlens-dev | ⏸ Paused | Resume for migrations only, pause after |
| fundlens-staging | ✅ Active | Migrations 01-06 run, BSE backfill complete |
| fundlens-prod | ✅ Active | Live data |

---

## Pipeline Scripts

| Script | Version | Status | Notes |
|---|---|---|---|
| `cell_a_fetcher.py` | v1.1 | ✅ Live | Auto-fetches Groups 1/2/3. Writes amc_map.json. |
| `cell_4d_v2.py` | v2.3 | ✅ Live | All 50 AMCs configured. xlrd fallback. AMC_CONFIG fixes in progress — do not commit yet. |
| `backfill_amc_map.py` | v3 | ✅ Live | One-time per historical month. |
| `bulk_upload.py` | v1 | ✅ Live | Emergency batch upload only. |
| `backfill_nav_history.py` | v1.1.0 | ✅ Ready | 30Y NAV backfill. Dry run: 99.5% match. Resume from 2018-01-01. |
| `sync_amc_master.py` | v2.0 | ✅ Ready | Sync AMCs from FundInsight → amcs table. |
| `populate_schemes_table.py` | v2.0 | ✅ Ready | Load scheme master from AMFI. |
| `uti_fetch.py` | v1.0 | ⛔ Retired | Replaced by cell_a_fetcher. |
| `pipeline_cell1.py` | v4.3.1 | ⏸ Pending rebuild | Remove 5Y fetch, today-only NAV (Phase 1 S4) |
| `pipeline_cell2.py` | v4.3.1 | ⏸ Pending rebuild | Upload to Gist rebuild (Phase 1 S4) |

---

## NAV Backfill — Next Run Command

```bash
cd ~/Documents/fundlens
export SUPABASE_URL="https://sewywgatxkiulbrhwpyh.supabase.co"
export SUPABASE_KEY="[service_role_key]"
python pipeline/backfill_nav_history.py --full
```

Resume from 2018-01-01 when Supabase is confirmed stable.

**Verification SQL:**
```sql
SELECT COUNT(*) FROM nav_history;                     -- ~145M-150M
SELECT COUNT(DISTINCT scheme_id) FROM nav_history;    -- ~16,000
SELECT MIN(nav_date), MAX(nav_date) FROM nav_history; -- 1994-01-03, 2026-04-30
```

---

## Pipeline Issues — Open

| # | Issue | Detail | Status |
|---|---|---|---|
| 1 | Mahindra 0 rows | R3C2 scheme, R6C2 header — verify against actual file | ⚠ P0 |
| 2 | Shriram 0 rows | Header scan R16-R19 not finding data. Possible xlrd + layout mismatch. | ⚠ P0 |
| 3 | Nippon 0 rows | Config issue — verify against actual file | ⚠ P0 |
| 4 | Union 0 rows | 33 inner files. R6C3 scheme, R8/R9C3 header. One-file-per-scheme layout. | ⚠ P0 |
| 5 | Zerodha 0 rows | R2C3/R4C3 config untested. Open ZIP inner files to verify. | ⚠ P0 |
| 6 | Run Mar 2026 parser | `python pipeline/cell_4d_v2.py --month 2026-03 --source github` | ⚠ P0 |
| 7 | Build merge_holdings.py | Remap Feb+Mar CSVs to canonical schema. pd.concat → master_holdings.csv | ⏳ P1 |
| 8 | Build Cell C — Scheme Reconciler | AMFI NAV master fuzzy-match → scheme_code_amfi | ⏳ P1 |
| 9 | Build Cell E — Quality Gate | | ⏳ P2 |
| 10 | instrument_type normaliser | Phase B: section header → instrument_type code in process_sheet() | ⏳ P3 |
| 11 | Old Bridge Feb 0 rows | Feb ZIP has 2 files, Mar has 3. Missing file or different layout. | ⚠ Pending |
| 12 | jioblackrock Mar low rows | Mar ZIP only 4 files → 264 rows vs Feb 2,290. Re-download Mar ZIP. | ⚠ Pending |
| 13 | Canara Robeco | CDN WAF blocks auto-fetch permanently. Manual download + portal upload. | ⚠ Permanent |
| 14 | PPFAS xlrd | Feb .xls cannot open. xlrd fallback added in v2.3 — test if resolved. | ⚠ Pending |

---

## Security Issues — Time-Critical

| # | Issue | Deadline | Status |
|---|---|---|---|
| S1 | Git history audit | Before Phase 2 | ✅ Clean, 09 May 2026 |
| S2 | GIST_PAT renewal + PAT scope audit | ~20 May 2026 | ✅ Complete, 09 May 2026 |
| S3 | Node.js 24 upgrade | June 2026 | ⚠ Pending |
| S4 | FundInsight-Pipeline GIST_PAT | Jul 6 2026 | ⚠ Pending |
| S5 | LICENSE file | Before go-live | ✅ Live on GitHub, 09 May 2026 |

---

## Security Sessions

| Session | Action | Status |
|---|---|---|
| S1 | Git history audit | ✅ Clean, 09 May 2026 |
| S2 | PAT scope audit + GIST_PAT renewal | ✅ Complete, 09 May 2026 |
| S3 | LICENSE file (Indiadvice) | ✅ Live on GitHub, 09 May 2026 |

---

## Parse Results — Latest

| Month | Rows | AMCs | File |
|---|---|---|---|
| Feb 2026 | 115,469 | 47 | holdings_raw_4d_2026-02.csv |
| Mar 2026 | 119,308 | 48 | holdings_raw_4d_2026-03.csv |

---

## Key Technical Facts (Parser)

| Fact | Detail |
|---|---|
| UTI ISIN | col 7 (0-based), NOT col 2 |
| UTI scheme name | Strip leading whitespace |
| Kotak col_override | Name=3, ISIN=4, Industry=5, Qty=7, MktVal=8, %NAV=9 |
| SBI R1C1 | R3C4 (corrected) |
| GitHub source mode | AMC name always from commit message, never from filename |
| ZIP files | Extracted in-memory, identity from commit message |
| Mirae | Never use auto-fetched files. Always manually download monthly portfolio ZIP. |
| Canara | CDN WAF blocks all programmatic access. Manual download + portal upload only. |

---

## Monthly Run Checklist (cell_a_fetcher.py)

| # | Variable | Change |
|---|---|---|
| 1 | PORTFOLIO_MONTH | YYYY-MM |
| 2 | PORTFOLIO_DATE | Last trading day |
| 3 | UTI_YEAR / UTI_MONTH | Year + full month name |
| 4 | api_url_field (Invesco) | Month URL field |
| 5 | TARGET_MONTH_STR (Wealth Co.) | Scraper date string |
| 6 | HDFC_LAST_DAY | Last day of portfolio month |
| 7 | HDFC_MONTH_NAME | Full month name |
| 8 | HDFC_UPLOAD_FOLDER | s3fs folder (month+1) |
| 9 | Unifi URLs (3) | Date suffix ddmmyyyy |
| 10 | canara_upload_month | MM of upload folder (moot if CDN blocked) |
| 11 | canara_month_code | Month string in filename (moot if CDN blocked) |

---

## Mandatory Coding Rules

| Rule | Detail |
|---|---|
| No TypeScript | JSX only, no .tsx files |
| Dates | All dates via `fmtDate()` — never `toLocaleDateString()` or `toISOString()` |
| No dark themes | Pastel/soft gradient only. `#1D9E75` accent. |
| Full rewrites | Never incremental find-and-replace |
| vercel.json | Read before touching — has broken deployment twice |
| service_role | Never in any frontend file or VITE_ env var |
| Currency | `toLocaleString('en-IN')` with ₹ prefix |
| Responsive | `useWindowWidth()` hook |
| Error handling | No silent `catch(()=>{})` — always `console.error` with context |
| AMC identity | `amc_map.json` is source of truth — never guess from filename |
| Python | Use `python` not `python3` (Windows) |
| Supabase PATCH | May return 200 with empty body. Always `res.text()` first. |

---

## Key Coordinates

| Item | Value |
|---|---|
| FundLens repo | github.com/anjaneyakg/fundlens (PUBLIC) |
| FundInsight repo | github.com/anjaneyakg/FundInsight (PRIVATE) |
| Live URL | fundlens-six.vercel.app / fundlens.in |
| Local machine | C:\Users\anjan_o1xyjq0\Documents\FundInsight\ |
| Python | Use `python` not `python3` |
| Venv activate | `source .venv/Scripts/activate` (Git Bash) |
| Supabase URL | https://sewywgatxkiulbrhwpyh.supabase.co |
| VITE_GITHUB_PAT | Renewed Apr 2026 in Vercel |
| GIST_PAT | ✅ Renewed 09 May 2026 |
| Health endpoint | https://fundlens-six.vercel.app/api/v1/health |
