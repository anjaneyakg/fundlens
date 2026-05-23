# NEXT SESSION — FundLens
Last updated: 24 May 2026

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## Current priority (do this first):
Task: PL-13 — F2 Alerts engine
File to create: src/pages/PortfolioLens/F2Alerts.jsx
Depends on: portfolioEngine.js + portfolioStore.js (already built)
Route: /portfolio/f2 (currently PLPlaceholder — replace in App.jsx)

### F2 Alerts spec
Alerts are rules that fire when a portfolio condition crosses a threshold.
Store alerts config in localStorage under key `fundlens_alerts_v1`.

**Alert types to implement:**
- **XIRR drop** — portfolio XIRR drops below user-set threshold (e.g. < 8%)
- **NAV staleness** — Holdings snapshot is > 30 days old
- **Large unrealised loss** — a holding is > 20% below cost (unrealised_gain_pct < -20)
- **LTCG harvest window** — total LTCG approaching ₹1.25L (fires when LTCG is ₹80K–₹1.25L)
- **Regular plan detected** — any holding in Regular plan (fires once, not repeatedly)
- **Short-term equity** — any equity holding < 180 days old (3-6 month warning before 12-month tax cliff)

**Alert states:** `watching` (not yet triggered) | `fired` (condition met) | `snoozed` (user dismissed, re-checks in 30 days)

**UI:**
- Alert card list with status badge (watching/fired/snoozed)
- "Mark as reviewed" button on fired alerts → moves to snoozed
- "Add alert" flow — pick type, configure threshold, save
- No-alerts empty state

## Parallel track (separate session):
NAV backfill — run nightly 11PM-2AM IST until MAX(nav_date) = 2026-04-30
Command: cd fundlens && set -a && source .env && set +a &&
python pipeline/backfill_nav_history.py --auto-resume
Stop at: 3 hours or if DB size exceeds 6.5 GB

## Do NOT touch in next session:
- vercel.json (already has catch-all, no changes needed)
- Firebase auth files (src/firebase.js, src/hooks/useAuth.jsx, src/hooks/useRole.jsx)
- pipeline scripts (unless NAV session)
- F1HealthCheck.jsx (just written — do not rewrite)

## Open issues to keep in mind:
- Node.js 24 upgrade deadline: June 2026 (PH4-S4)
- User Manager bug: pass accessToken to sbFetch
- VITE_SUPABASE_ANON_KEY missing from Vercel env vars
- Supabase migrations 002 + 003 still pending (Supabase IO issues)

## Phase 2 status at session close:
- PH2-S1 through PH2-S9 all ✅ Done (PL-1 through PL-12)
- PH2-S10 (F2–F5) is next
- Next session: PL-13 = F2 Alerts (first part of PH2-S10)
