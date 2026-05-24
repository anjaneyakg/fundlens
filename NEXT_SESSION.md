# NEXT SESSION — FundLens
Last updated: 24 May 2026 (PL-16 complete — Phase 2 fully done)

## Fetch these at session start:
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md
- https://raw.githubusercontent.com/anjaneyakg/fundlens/main/NEXT_SESSION.md

## Phase 2 status: ✅ COMPLETE
All sessions PH2-S1 through PH2-S10 done.
PL-1 (F6 Data Manager) → PL-16 (F5 Send Report) — all delivered.

---

## Current priority (do this first):
Task: PH3-S1 — Multi-client dashboard
File to create: src/pages/PortfolioLens/AdvisorClientList.jsx
Route: /advisor/clients (new top-level route, advisor-only)

### PH3-S1 Multi-client dashboard spec

An advisor dashboard showing all clients' portfolios in a single view.

**Data model:**
- In this phase: client portfolios still stored in localStorage (one per browser profile)
- Advisor sees their own portfolio + can demo with test data
- Real multi-client via Supabase will come in Phase 3 later sessions (PH3-S3+)

**Sections:**
1. Client list table: client name (masked per DPDP), portfolio value, XIRR, health score, last updated, action buttons (View, Send Report)
2. Summary strip: total AUM across clients, avg health score, # schemes, # clients
3. "Add client" stub: shows "Coming soon — client invitation flow planned for PH3-S5"

**Behaviour:**
- Reads from localStorage key `fundlens_advisor_clients` (array of { id, name (display), portfolioId })
- Each portfolioId maps to a portfolio in `fundlens_portfolios`
- If no clients found: show empty state with CTA to upload portfolio via F6
- "View" button: navigate to /portfolio/e1 with portfolioId as query param (or state)
- "Send Report" button: navigate to /portfolio/f5 with portfolioId pre-selected
- Advisor mode: checks useRole() → role === 'advisor' or role === 'admin'

**DPDP compliance:**
- Client names shown as initials only (e.g. "A.K.") or user-chosen alias
- No PAN / folio numbers in this view

**UI:**
- Full-width table layout
- Responsive: stacked cards on mobile (< 768px)
- Health score coloured: green ≥75, amber 50–74, red <50
- Summary strip at top with 4 stat boxes (ACC green theme)

**Route wiring (App.jsx):**
```jsx
<Route path="/advisor" element={<ProtectedRoute requiredRole="advisor"><AdvisorLayout /></ProtectedRoute>}>
  <Route path="clients" element={<AdvisorClientList />} />
</Route>
```
- Create AdvisorLayout.jsx (thin wrapper — sidebar or just <Outlet />)
- Add "My Clients" link in Nav.jsx under Promote tab (advisor mode only)

## Parallel track (separate session):
NAV top-up — run nightly 11PM-2AM IST to maintain T-1 currency
Command: cd fundlens && set -a && source .env && set +a &&
python pipeline/backfill_nav_history.py --auto-resume
Stop at: 3 hours or if DB size exceeds 6.5 GB

## Do NOT touch in next session:
- vercel.json (already has catch-all, no changes needed)
- Firebase auth files (src/firebase.js, src/hooks/useAuth.jsx, src/hooks/useRole.jsx)
- pipeline scripts (unless NAV session)
- All E1–E8, F1–F6 pages (Phase 2 done — do not modify)

## Open issues to keep in mind:
- Node.js 24 upgrade deadline: June 2026 (PH4-S4) ⚠ URGENT
- User Manager bug: pass accessToken to sbFetch
- VITE_SUPABASE_ANON_KEY missing from Vercel env vars
- Supabase migrations 002 + 003 still pending (Supabase IO issues)

## Phase 2 closed at PL-16:
- PH2-S1 through PH2-S10 all ✅ Done
- PL-1 (F6 Data Manager) through PL-16 (F5 Send Report) — complete
- Next: Phase 3 — Advisor Layer (PH3-S1 through PH3-S5)
