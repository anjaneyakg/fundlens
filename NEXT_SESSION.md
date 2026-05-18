# NEXT SESSION — FundLens
Last updated: 18 May 2026

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## Current priority (do this first):
Task: PL-12 — F1 Health Check (8-rule engine)
File to work on: src/pages/PortfolioLens/F1HealthCheck.jsx (create new)
Depends on: portfolioEngine.js (already built)
Expected output: Health check page with 8 rules, confidence scoring, 
expandable accordion, LTCG opportunity alert

## Parallel track (separate session):
NAV backfill — run nightly 11PM-2AM IST until MAX(nav_date) = 2026-04-30
Command: cd fundlens && set -a && source .env && set +a && 
python pipeline/backfill_nav_history.py --auto-resume
Stop at: 3 hours or if DB size exceeds 6.5 GB

## Do NOT touch in next session:
- vercel.json
- Firebase auth files
- pipeline scripts (unless NAV session)

## Open issues to keep in mind:
- Node.js 24 upgrade deadline: June 2026
- User Manager bug: pass accessToken to sbFetch
- VITE_SUPABASE_ANON_KEY missing from Vercel env vars
