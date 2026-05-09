# FundLens — Current State (Pipeline, Data & Build Track)

**Owner:** Claude Code
**Last updated:** 09 May 2026 · v23.6
**Companion file:** `PLATFORM_STATE.md` — design, auth decisions, go-live plan

> **Session protocol:**
> Fetch BOTH files at session start:
> - `https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md`
> - `https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md`
>
> Update ONLY `CURRENT_STATE.md` at session close. Never touch `PLATFORM_STATE.md`.
> Always: update file → `git add` → `git commit` → `git push` before ending session.

---

## PH0-S4 — Homepage v3 Redesign ✅ (09 May 2026)

| Item | Status |
|---|---|
| `migrations/003_promo_messages.sql` — promo_messages table + public RLS read policy (run when Supabase recovers) | ✅ Written |
| `src/context/AdvisorModeContext.jsx` — shared context for Investor/Advisor toggle, single source of truth | ✅ Done |
| `src/App.jsx` — wrapped with `AdvisorModeProvider` | ✅ Done |
| `src/components/Nav.jsx` — `advisorMode` now reads from `AdvisorModeContext` (not local state) | ✅ Done |
| `src/pages/Home.jsx` — full rewrite: v3 long-page Apple-style design | ✅ Done |
| Vite build — 942 modules, no new errors | ✅ Done |

### Homepage v3 — sections delivered

- **A. Carousel** — auto-scrolls 4s, dot navigation, tries Supabase `promo_messages` table, falls back to 3 static messages (table doesn't exist yet → fallback path confirmed active)
- **B. Hero** — centered, system-font headline; switches on `advisorMode`: Investor ("Know your mutual funds. Really know them.") / Advisor ("Give your clients the analysis they deserve.")
- **C. Data indicators strip** — 3 plain-language items with dividers, no numbers
- **D. Feature sections** — Plan (text-left), Research (text-right / flipped, alt bg), Track (text-left); each with CSS-drawn visual panel and CTA button
- **E. Advisor strip** — MFD card (green, #1D9E75) + RIA card (blue, #1565C0), 2-col desktop → 1-col mobile
- **F. Save & Invest teaser** — centered, "coming soon" badge, no CTA
- **G. Footer** — FundLens wordmark, Privacy Policy / Terms / Contact links, AMFI + BSE data disclaimer; no individual name

### Toggle sync

`advisorMode` lifted from Nav local state → `AdvisorModeContext`. Nav and Home both read from context. One source of truth. Toggle in Nav instantly switches hero content on homepage.

### Pending manual actions (Supabase down — run when recovered)

4. Run `migrations/003_promo_messages.sql` in fundlens-prod SQL editor, then populate with 3 rows matching STATIC_PROMOS content.

---

## PH0-S3 — New Navigation Shell ✅ (09 May 2026)

| Item | Status |
|---|---|
| `src/components/Nav.jsx` — full rewrite: single-row sticky, Plan/Research/Track/Save & Invest/Promote tabs | ✅ Done |
| `src/App.jsx` — `/stp-actual` moved from individual-protected to public (group A = Plan) | ✅ Done |
| Vite build — 901 modules, no new errors | ✅ Done |

### Nav features delivered

- **Plan tab** — public mega dropdown (2-col grid), groups A/B/C/D/E
- **Research tab** — individual-required dropdown (1-col), groups Z/X; lock icon + redirect to /login for guests
- **Track tab** — individual-required link to /portfolio; same lock/redirect for guests
- **Save & Invest** — disabled pill, "Soon" badge, no dropdown
- **Promote tab** — hidden unless `advisorMode && isAdvisor`
- **Direct/Regular universe pill** — preserved from old nav, localStorage + CustomEvent
- **Investor/Advisor toggle** — pill with icons; only shown to advisor-role users; controls Promote visibility
- **User menu** — avatar initials + sign out dropdown when logged in; Sign in / Get started buttons when guest
- **Mobile drawer** — hamburger at ≤768px; slide-in from right with all nav sections + universe pill + auth button

### Route protection map (as of PH0-S3)

| Route | Protection |
|---|---|
| `/`, `/login`, `/upgrade` | Public |
| Plan tools (all calculators + `/stp-actual`) | Public |
| `/schemes`, `/category-leaderboard`, `/compare-schemes` | `requiredRole="individual"` |
| `/portfolio/*` | `requiredRole="individual"` |
| `/admin/*` | `requiredRole="admin"` |

---

## PH0-S2 — Roles, ProtectedRoute Tiers, UserManager Fix ✅ (09 May 2026)

| Item | Status |
|---|---|
| `migrations/001_users_table.sql` — PH0-S1 SQL as file (run when Supabase recovers) | ✅ Written |
| `migrations/002_advisor_profiles.sql` — advisor_profiles table + admin RLS policies | ✅ Written |
| `src/hooks/useAuth.jsx` — added `planTier` state + exposed in context | ✅ Done |
| `src/hooks/useRole.jsx` — new hook: isGuest/isIndividual/isAdvisor/isAdmin/hasRole | ✅ Done |
| `src/components/ProtectedRoute.jsx` — `requiredRole` prop, role hierarchy, /upgrade redirect | ✅ Done |
| `api/get-users.js` — admin-verified serverless function, paginated, service_role | ✅ Done |
| `api/set-role.js` — admin-verified serverless function, validates + updates role | ✅ Done |
| `src/pages/admin/UserManager.jsx` — full rewrite: new schema, /api/get-users, /api/set-role, pagination | ✅ Done |
| `src/pages/Upgrade.jsx` — placeholder page, pricing preview, View plans + Go back | ✅ Done |
| `src/App.jsx` — research routes → `requiredRole="individual"`, admin → `requiredRole="admin"`, /upgrade added | ✅ Done |
| Vite build — 900 modules, no new errors | ✅ Done |

### Route protection map (as of PH0-S2)

| Route | Protection |
|---|---|
| `/`, `/login`, `/upgrade` | Public |
| Plan tools (calculators) | Public |
| `/schemes`, `/category-leaderboard`, `/stp-actual`, `/compare-schemes` | `requiredRole="individual"` |
| `/portfolio/*` | `requiredRole="individual"` |
| `/admin/*` | `requiredRole="admin"` |

### Pending manual actions (Supabase down — run when recovered)

1. Run `migrations/001_users_table.sql` in fundlens-prod SQL editor
2. Run `migrations/002_advisor_profiles.sql` in fundlens-prod SQL editor
3. Add VITE_FIREBASE_* (6 vars) to Vercel dashboard

### env var note for api/get-users.js + api/set-role.js

Both functions use `SUPABASE_SERVICE_KEY` (matches existing `api/admin/set-user-tier.js`).
No new Vercel env vars needed — `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are already set.

---

## PH0-S1 — Firebase Auth + Supabase JWT Wiring ✅ (09 May 2026)

| Item | Status |
|---|---|
| `src/firebase.js` — Firebase app init, env-var only | ✅ Done |
| `src/lib/supabaseClient.js` — `createSupabaseClient(token)` + guest `supabase` export | ✅ Done |
| `src/hooks/useAuth.jsx` — full rewrite: Firebase onAuthStateChanged, JWT in memory only | ✅ Done |
| `src/pages/Login.jsx` — Google Sign-In primary, email/password secondary, #1D9E75 | ✅ Done |
| `src/components/ProtectedRoute.jsx` — simplified to Firebase user check | ✅ Done |
| `src/App.jsx` — `/portfolio` + `/admin` wrapped in ProtectedRoute | ✅ Done |
| `npm install firebase` — firebase ^12.13.0 added | ✅ Done |
| Vite build — 899 modules, no new errors | ✅ Done |
| Supabase SQL: users table + RLS policies | ⚠ Run manually in Supabase SQL editor (see SQL below) |
| Vercel env vars: VITE_FIREBASE_* (6 vars) | ⚠ Add to Vercel dashboard manually |

### Supabase SQL — Run Once in fundlens-prod SQL editor

```sql
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'individual',
  plan_tier TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON public.users
  FOR SELECT USING (auth.jwt() ->> 'sub' = id);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.jwt() ->> 'sub' = id);
```

### .env status
All VITE_FIREBASE_* and VITE_SUPABASE_* variables confirmed present in local .env.
Add all VITE_FIREBASE_* (6 vars) to Vercel dashboard → Project Settings → Environment Variables.

**Notes for PH0-S2:**
- UserManager.jsx still queries old `user_roles` + `tiers` tables — will fail gracefully. Rewrite in PH0-S2.
- `accessToken` is aliased to `token` in new useAuth context so UserManager doesn't hard-crash.
- ProtectedRoute simplified to auth-only check; tier/role-based gates go in PH0-S2.

---

## Access Control System — Superseded by Firebase Auth (PH0-S1)

| Item | Status |
|---|---|
| Migration 07: RTA Portfolio Module tables (staging + prod) | ✅ Done |
| Migration 08: Tiers, roles, feature_flags seeded (staging + prod) | ✅ Done |
| Admin: User Manager at `/admin/users` | ✅ Live (queries old schema — rewrite in PH0-S2) |
| Admin: Tool Access Matrix at `/admin/tool-access` | ✅ Live |
| `.gitignore` created (node_modules, dist, .env excluded) | ✅ Done |

**Last commit before PH0-S1:** 68705d1

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
| `nav_history` | 8.5M+ (backfill run 5 in progress, resuming from 2018-04-19) | ⏳ Backfill in progress | Script validated at 99.5% match rate. |
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
| `cell_4d_v2.py` | v2.4 | ✅ Live | All 50 AMCs configured. Nippon 110/110. All P0 issues resolved. Ready to commit. |
| `backfill_amc_map.py` | v3 | ✅ Live | One-time per historical month. |
| `bulk_upload.py` | v1 | ✅ Live | Emergency batch upload only. |
| `backfill_nav_history.py` | v1.2.0 | ✅ Live | --auto-resume flag added. 300s timeout. 3-attempt retry on load_scheme_map. Run 5 in progress. |
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
| 1 | Mahindra 0 rows | 1,482 rows, 27 schemes confirmed. v2.3 fix (scheme R3C2) correct. Feb ✅ — Mar still needs run. | ✅ RESOLVED |
| 2 | Shriram 0 rows | 1,012 rows, 10 schemes confirmed. xlrd fallback + "money market instrument" fix applied. | ✅ RESOLVED |
| 3 | Nippon 0 rows | 110/110 schemes, 6,641 rows, 0 errors. Fixes: BytesIO load; clean_scheme_name normalises \n→space; _TRUNCATE_PATTERNS An→An? + (FOF) strip. | ✅ RESOLVED |
| 4 | Union 0 rows | 33/33 schemes, 2,947 rows, 0 errors. Fix: scheme_r1c1 (6,3) → (7,3) in Union AMC_CONFIG. | ✅ RESOLVED |
| 5 | Zerodha 0 rows | 17/17 schemes, 1,441 rows, 0 errors. FOR pattern + bare MONTH YEAR pattern + clean-before-junk-check reorder. | ✅ RESOLVED |
| 6 | Run Mar 2026 parser | `python pipeline/cell_4d_v2.py --month 2026-03 --source github` — confirm Mahindra (Feb=1,482 rows ✅, Mar untested) | ⚠ P0 |
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
| S4 | FundInsight-Pipeline token (gist+repo scope) — review before expiry | Jul 6 2026 | ⚠ Review by Jul 6 2026 |
| S5 | LICENSE file | Before go-live | ✅ Live on GitHub, 09 May 2026 |

---

## Security Sessions

| Session | Action | Status |
|---|---|---|
| S1 | Git history audit | ✅ 09 May 2026 — clean |
| S2 | PAT scope audit + GIST_PAT renewal | ✅ 09 May 2026 |
| S3 | LICENSE file (Indiadvice) | ✅ 09 May 2026 |

---

## Open Priorities — Resolved This Session

| Item | Status |
|---|---|
| GIST_PAT renewal | ✅ DONE — 09 May 2026 |
| Git history audit | ✅ DONE — 09 May 2026 — clean |
| VITE_GITHUB_PAT scope | ✅ DONE — 09 May 2026 |
| LICENSE file | ✅ DONE — 09 May 2026 |

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
