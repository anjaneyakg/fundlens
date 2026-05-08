# Session Summary — 08 May 2026
_PortfolioLens PL-3 + PL-4_

## What was built

### PL-3 — Parser engine + portfolioEngine

**New files:**
- `src/pages/PortfolioLens/utils/fileParser.js`
  - `detectAndParse(file)` — main entry point, returns `{detected, transactions|snapshots, meta}`
  - Auto-detects CAMS (row 0: MF_NAME+FOLIO_NUMBER), KFin (row 0: FundName+SchemeISIN), Holdings (row 0/1: AMC Name+SCHEMECODE+Unit Balance)
  - `parseCams()` — 14-column CAMS transaction export (DD-MMM-YYYY dates, PRICE = nav)
  - `parseKFin()` — 13-column KFin export (includes SchemeISIN, DD-Mon-YYYY dates)
  - `parseHoldings()` — CAMS current valuation snapshot (NAV Date as Excel serial number)
  - `normType()` → 7 canonical types: PURCHASE | REDEMPTION | SWITCH_IN | SWITCH_OUT | DIVIDEND | REVERSAL | ADMIN
  - SHA-256 folio hashing via Web Crypto API for DPDP compliance
  - `xlsx` (SheetJS 0.18.5) handles both genuine .xls (Excel 97) and .xlsx

- `src/pages/PortfolioLens/utils/portfolioEngine.js`
  - `buildHoldings(transactions, snapshots=[])` — avg-cost method, groups by scheme+folio, computes XIRR per holding, detects Direct/Regular + Growth/IDCW from scheme name
  - `xirr(cashflows)` — Newton-Raphson, 300 iterations, purchase=negative convention
  - `portfolioXirr(holdings)` — aggregates all cashflows across holdings for portfolio-level XIRR
  - `summarise(holdings)` — total_invested, total_current_value, total_gain, total_gain_pct, scheme_count, amc_count

**Modified files:**
- `src/pages/PortfolioLens/utils/portfolioStore.js` — added `updatePortfolio(id, updates)`
- `src/pages/PortfolioLens/F6DataManager.jsx`
  - `PortfolioCard` rebuilt with "Parse transactions" / "Re-parse file" button
  - Hidden `<input type="file" ref>` triggered on click
  - `handleParseFile` — calls detectAndParse → buildHoldings → updatePortfolio → onParsed refresh
  - Parse success/error banners inline on the card
  - Fixed missing `onParsed={refresh}` prop
  - Updated wizard step 3 info box (removed "coming soon" note)
- `package.json` / `package-lock.json` — `xlsx` 0.18.5 added

### PL-4 — E1 Dashboard

**New file:** `src/pages/PortfolioLens/E1Dashboard.jsx`
- Portfolio selector dropdown (shown only when multiple portfolios exist)
- Two empty states: no portfolios (→ F6) / no parsed data (→ F6)
- **4 metric cards:** Total Invested · Current Value (+gain%) · Unrealised Gain · Portfolio XIRR
- **Quick stats:** scheme count, AMC count, Direct count, Regular count
- **Top Holdings table** (top 8 by invested_amount) — scheme name, plan chip, AMC, invested, current value, gain%, XIRR; responsive (hides invested + XIRR columns on mobile)
- **LTCG harvest banner** — fires when holdings_period_days > 365 and unrealised_gain > 0; shows total eligible gain + link to E7
- All amounts in ₹ with toLocaleString('en-IN'), XIRR as annualised %

**Modified:** `src/App.jsx` — e1 route now uses `<E1Dashboard />` (was PLPlaceholder)

## localStorage schema (unchanged)
- `fundlens_pl_consent` → `{given, timestamp, version:"1.0", checkboxes}`
- `fundlens_portfolios` → `{schema_version:"1.0", portfolios:[...]}`
- Portfolio `status`: `"pending_parse"` → `"active"` after parsing
- Portfolio `holdings[]` — full holdings array with transactions embedded

## Next session
**PL-5 — E2 Visual Overview**
- Allocation donut (equity/debt/hybrid/other by invested amount)
- AMC treemap by current value
- Portfolio journey chart (cumulative invested vs current value over time)
- SIP vs lumpsum AUM split
