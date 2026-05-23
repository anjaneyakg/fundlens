# NEXT SESSION — FundLens
Last updated: 24 May 2026

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## Current priority (do this first):
Task: PL-14 — F3 Rebalance Planner
File to create: src/pages/PortfolioLens/F3RebalancePlanner.jsx
Depends on: portfolioEngine.js + portfolioStore.js + portfolioEngine's buildHoldings (already built)
Route: /portfolio/f3 (currently PLPlaceholder — replace in App.jsx)

### F3 Rebalance Planner spec
Help the user rebalance their portfolio toward a target allocation, showing what to redeem and where to invest, with tax impact per lot.

**Step 1 — Current Allocation**
- Show current portfolio split by category (Equity / Debt / Liquid / Hybrid) as percentages and ₹ values
- Read from portfolioStore holdings snapshot (or computed from transactions if no snapshot)

**Step 2 — Target Allocation**
- User inputs target % per category (must sum to 100)
- Show gap: current vs target per category (over/under-weight)
- Preset buttons: Conservative (20/60/10/10), Balanced (50/30/10/10), Aggressive (80/10/5/5)

**Step 3 — Rebalance Plan**
- For over-weight categories: suggest which schemes to partially/fully redeem
- Tax-aware lot selection: prefer LTCG lots (held > 12 months for equity, > 36 months for debt) over STCG lots
- Show per-scheme: units to redeem · estimated ₹ · estimated tax (LTCG/STCG, within/beyond ₹1.25L exemption)
- For under-weight categories: show target ₹ to invest (user picks schemes separately)

**Step 4 — Summary**
- Total to redeem · Total tax estimated · Net proceeds to reinvest
- Printable/copy-able summary table
- "Save plan" → localStorage key `fundlens_rebalance_plan_v1`

**Tax rules to apply:**
- Equity STCG: < 12 months → 20%
- Equity LTCG: ≥ 12 months → 12.5% above ₹1.25L cumulative annual limit
- Debt STCG: < 36 months → slab rate (show as "per your slab")
- Debt LTCG: ≥ 36 months → 12.5% (no indexation from 2023)
- Arbitrage/Liquid: treated as debt for tax

**UI:**
- Stepper (Step 1 / 2 / 3 / 4) with Next / Back navigation
- Category donut chart updates live as user adjusts targets
- Mobile responsive (useWindowWidth)

## Parallel track (separate session):
NAV backfill — run nightly 11PM-2AM IST until MAX(nav_date) = 2026-04-30
Command: cd fundlens && set -a && source .env && set +a &&
python pipeline/backfill_nav_history.py --auto-resume
Stop at: 3 hours or if DB size exceeds 6.5 GB

## Do NOT touch in next session:
- vercel.json (already has catch-all, no changes needed)
- Firebase auth files (src/firebase.js, src/hooks/useAuth.jsx, src/hooks/useRole.jsx)
- pipeline scripts (unless NAV session)
- F1HealthCheck.jsx (done — do not rewrite)
- F2Alerts.jsx (done — do not rewrite)

## Open issues to keep in mind:
- Node.js 24 upgrade deadline: June 2026 (PH4-S4)
- User Manager bug: pass accessToken to sbFetch
- VITE_SUPABASE_ANON_KEY missing from Vercel env vars
- Supabase migrations 002 + 003 still pending (Supabase IO issues)

## Phase 2 status at session close:
- PH2-S1 through PH2-S9 all ✅ Done (PL-1 through PL-12)
- PH2-S10 (F2–F5) in progress: F2 ✅ Done (PL-13), F3–F5 pending
- Next session: PL-14 = F3 Rebalance Planner
