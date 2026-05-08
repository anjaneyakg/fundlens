# FundInsight — Current State
_Last updated: 08 May 2026 · v21.0_

## Pipeline Scripts — Live Versions
| Script | Version | Status |
|---|---|---|
| cell_a_fetcher.py | v1.0 | ✅ Live |
| cell_4d_v2.py | v2.1 | ✅ Live |
| uti_fetch.py | v1.0 | ⛔ Retired |

## Last Run Results
- **March 2026:** 378 files in GitHub data/raw/2026-03/
- **cell_4d_v2.py March run:** ⚠️ Pending — 0 rows for Mahindra, Shriram, Nippon
- **February 2026:** 311 files, amc_map.json pushed cleanly

## Open Issues (Priority Order)
- [ ] P0 — Fix 0-row AMCs: Mahindra, Shriram, Nippon
- [ ] P0 — Run cell_4d_v2.py --month 2026-03 --source github
- [ ] P1 — Build merge_holdings.py
- [ ] P1 — Build Cell C — Scheme Reconciler
- [ ] P2 — Build Cell E — Quality Gate
- [ ] P3 — Phase B: instrument_type normaliser
- [ ] P4 — Phase C: migrate to Supabase scheme_portfolios
- [ ] P5 — GIST_PAT (FundInsight-Pipeline) expires Jul 6 2026
- [ ] P5 — Node.js 24 upgrade — deadline June 2026

## Key Technical Facts
- UTI ISIN: col 7 (0-based), NOT col 2
- UTI scheme name: strip leading whitespace
- Kotak col_override: Name=3,ISIN=4,Industry=5,Qty=7,MktVal=8,%NAV=9
- SBI R1C1: R3C4 (corrected)
- GitHub source mode: AMC name always from commit message
- ZIP files: extracted in-memory, identity from commit message

## Session Protocol
- Reference doc: FundLens_Master_Reference_v20.docx (in project knowledge)
- At session start: paste this URL in chat
- Raw URL: https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- At session end: update this file + git commit + push
- Claude Code installed + working in VS Code. cell_4d_v2.py shows v2.3 but AMC_CONFIG fixes still in progress in separate session — do not commit yet

---

## Access Control System — Live (26 Apr 2026)
- Migration 07: RTA Portfolio Module tables (staging + prod) ✅
- Migration 08: Tiers, roles, feature_flags seeded (staging + prod) ✅
- useAuth.jsx + ProtectedRoute.jsx live ✅
- Login page live at /login ✅
- Admin: User Manager at /admin/users ✅
- Admin: Tool Access Matrix at /admin/tool-access ✅
- .gitignore created (node_modules, dist, .env excluded) ✅
- Commit: 68705d1

## PortfolioLens Build Status (as of 08 May 2026)

| Session | Deliverable | Status |
|---------|-------------|--------|
| PL-1 | Shell layout + sidebar + routing | ✅ DONE |
| PL-2 | F6 Data Manager + DPDP consent wizard | ✅ DONE |
| PL-3 | Parser engine (CAMS + KFin + Holdings) + portfolioEngine.js | ✅ DONE |
| PL-4 | E1 Dashboard | ✅ DONE |
| PL-5 | E2 Visual Overview | ⏳ NEXT |
| PL-6 | E3 Holdings & Exposure | pending |
| PL-7 | E4 Overlap Analysis | pending |
| PL-8 | E5 Performance Matrix | pending |
| PL-9 | E6 Cashflow & Returns | pending |
| PL-10 | E7 Capital Gains | pending |
| PL-11 | E8 Transaction Report | pending |
| PL-12 | F1 Health Check (8 rules) | pending |
| PL-13 | F2 Alerts engine | pending |
| PL-14 | F3 Rebalance Planner | pending PL-12 |
| PL-15 | F4 Model Portfolio | pending |
| PL-16 | F5 Send Report | pending PL-12 |
| PL-17 | Advisor mode | pending all E+F |

### PortfolioLens Key Files
- `src/pages/PortfolioLens/` — all PL pages and utils
- `src/pages/PortfolioLens/utils/fileParser.js` — CAMS / KFin / Holdings Excel parser (SheetJS)
- `src/pages/PortfolioLens/utils/portfolioEngine.js` — XIRR, avg-cost, buildHoldings, portfolioXirr, summarise
- `src/pages/PortfolioLens/utils/portfolioStore.js` — localStorage CRUD + DPDP consent
- `src/pages/PortfolioLens/F6DataManager.jsx` — DPDP consent gate + 3-step add wizard + parse button
- `src/pages/PortfolioLens/E1Dashboard.jsx` — summary cards, top holdings table, LTCG hint
- `src/hooks/useWindowWidth.js` — responsive width hook
- localStorage keys: `fundlens_pl_consent`, `fundlens_portfolios` (schema_version: "1.0")
- `xlsx` (SheetJS 0.18.5) added for .xls/.xlsx parsing

### PortfolioLens Mandatory Rules
1. JSX only — no TypeScript/.tsx
2. All dates via custom fmtDate() — no toLocaleDateString()/toISOString() for display
3. No dark themes — pastel/soft gradient, `#1D9E75` accent
4. Indian currency: toLocaleString('en-IN') with ₹ prefix
5. useWindowWidth() for responsive behaviour
6. service_role key never in frontend
7. No silent catch — always console.error with context

---

## Next Session Priority
- [ ] PL-5 — E2 Visual Overview (allocation donut, AMC treemap, journey chart, SIP vs lumpsum AUM)
- [ ] Fix User Manager "Loading users" — pass accessToken to sbFetch
- [ ] Deploy to Vercel staging and test set-user-tier + set-flag APIs
- [ ] Add VITE_SUPABASE_ANON_KEY to Vercel environment variables
- [ ] NAV Backfill — resume from 2018-01-01 when Supabase is stable (see backfill_nav_history.py)
