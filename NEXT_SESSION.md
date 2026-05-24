# NEXT SESSION — FundLens
Last updated: 24 May 2026

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## Current priority (do this first):
Task: PL-15 — F4 Model Portfolio
File to create: src/pages/PortfolioLens/F4ModelPortfolio.jsx
Depends on: portfolioStore.js, portfolioEngine.js (already built)
Route: /portfolio/f4 (currently PLPlaceholder — replace in App.jsx)

### F4 Model Portfolio spec
A 3×3 risk × horizon grid that lets the user define and save a model allocation for their portfolio.
Think of it as a "target portfolio blueprint" — separate from the transactional rebalance plan.

**The 3×3 grid:**

| | Short-term (< 3Y) | Medium-term (3–7Y) | Long-term (> 7Y) |
|---|---|---|---|
| Conservative | 20E / 60D / 20L | 40E / 40D / 20L | 60E / 30D / 10L |
| Moderate | 30E / 50D / 20L | 55E / 30D / 15L | 70E / 20D / 10L |
| Aggressive | 40E / 40D / 20L | 65E / 25D / 10L | 80E / 15D / 5L |

(E=Equity, D=Debt, L=Liquid — % must sum to 100 in each cell)

**Behavior:**
- User selects their risk profile (Conservative / Moderate / Aggressive)
- User selects their investment horizon (Short / Medium / Long)
- Selected cell highlights; shows current vs model allocation gap
- Each cell is editable — user can override defaults
- "Save model" → localStorage key `fundlens_model_portfolio_v1`
- "Apply to F3" button — pre-fills F3 Rebalance Planner targets with the model allocations
  (Note: F3 is a separate route, so "Apply" navigates to /portfolio/f3 with URL params or localStorage handoff)
- Advisor mode: HO/firm defaults (read from advisor_profiles — stub for now, use same localStorage defaults)

**UI:**
- 3×3 grid of cards; selected cell has ACC border + background
- Risk selector: 3 pill buttons (Conservative / Moderate / Aggressive)
- Horizon selector: 3 pill buttons (Short / Medium / Long)
- Selected cell shows Equity/Debt/Liquid % bars + current portfolio comparison
- Edit modal: 3 number inputs (E/D/L) with live sum validation
- Mobile: 1-col stacked with risk + horizon dropdowns

## Parallel track (separate session):
NAV backfill — run nightly 11PM-2AM IST until MAX(nav_date) = 2026-04-30
Command: cd fundlens && set -a && source .env && set +a &&
python pipeline/backfill_nav_history.py --auto-resume
Stop at: 3 hours or if DB size exceeds 6.5 GB

## Do NOT touch in next session:
- vercel.json (already has catch-all, no changes needed)
- Firebase auth files (src/firebase.js, src/hooks/useAuth.jsx, src/hooks/useRole.jsx)
- pipeline scripts (unless NAV session)
- F1HealthCheck.jsx, F2Alerts.jsx, F3RebalancePlanner.jsx (done — do not rewrite)

## Open issues to keep in mind:
- Node.js 24 upgrade deadline: June 2026 (PH4-S4)
- User Manager bug: pass accessToken to sbFetch
- VITE_SUPABASE_ANON_KEY missing from Vercel env vars
- Supabase migrations 002 + 003 still pending (Supabase IO issues)

## Phase 2 status at session close:
- PH2-S1 through PH2-S9 all ✅ Done (PL-1 through PL-12)
- PH2-S10 (F2–F5) in progress: F2 ✅ PL-13, F3 ✅ PL-14, F4–F5 pending
- Next session: PL-15 = F4 Model Portfolio
