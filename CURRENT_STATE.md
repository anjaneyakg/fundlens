# FundLens — Current State (Pipeline, Data & Build Track)

**Owner:** Claude Code
**Last updated:** 24 May 2026 · v31.0
**Companion file:** `PLATFORM_STATE.md` — design, auth decisions, go-live plan

> **Session protocol:**
> Fetch BOTH files at session start:
> - `https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md`
> - `https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md`
>
> Update ONLY `CURRENT_STATE.md` at session close. Never touch `PLATFORM_STATE.md`.
> Always: update file → `git add` → `git commit` → `git push` before ending session.

---

## Phase 0 — Complete ✅ (09 May 2026)

| Session | Commit | Key files |
|---|---|---|
| PH0-S1 — Firebase Auth | `bb220e0` | firebase.js · useAuth.jsx · supabaseClient.js · Login.jsx · ProtectedRoute.jsx |
| PH0-S2 — Roles & access | `c89ddac` | useRole.jsx · ProtectedRoute.jsx · Upgrade.jsx · api/get-users.js · api/set-role.js |
| PH0-S3 — Nav shell | `a28d312` | Nav.jsx · AdvisorModeContext.jsx |
| PH0-S4 — Home v3 | `fc9a1db` | Home.jsx · migrations/003_promo_messages.sql |
| API consolidation | `6895c38` | api/amfi.js · api/admin.js |
| PH0-S5 — Theming | `5543556` | theme.css · useAdvisorTheme.jsx · index.css · Nav/Home/Login/Upgrade CSS vars |

### Phase 0 New Files

| File | Created in |
|---|---|
| `src/firebase.js` | PH0-S1 |
| `src/lib/supabaseClient.js` | PH0-S1 |
| `src/hooks/useAuth.jsx` | PH0-S1 (rewrite) |
| `src/pages/Login.jsx` | PH0-S1 (rewrite) |
| `src/hooks/useRole.jsx` | PH0-S2 |
| `src/pages/Upgrade.jsx` | PH0-S2 |
| `src/context/AdvisorModeContext.jsx` | PH0-S3 |
| `src/components/Nav.jsx` | PH0-S3 (rewrite) |
| `src/pages/Home.jsx` | PH0-S4 (rewrite) |
| `migrations/002_advisor_profiles.sql` | PH0-S2 |
| `migrations/003_promo_messages.sql` | PH0-S4 |
| `api/amfi.js` | API fix |
| `api/admin.js` | API fix |
| `src/theme.css` | PH0-S5 |
| `src/index.css` | PH0-S5 |
| `src/hooks/useAdvisorTheme.jsx` | PH0-S5 |

---

## API Consolidation ✅ (09 May 2026)

Consolidated 14 Vercel serverless functions → 5 to stay under Hobby plan 12-function limit.

| New file | Actions | Replaces |
|---|---|---|
| `api/amfi.js` | `?action=marketcap`, `schemes`, `schemes-list`, `scheme-code-map` | 4 files |
| `api/admin.js` | `?action=get-users`, `set-role`, `set-flag`, `set-user-tier` | 4 files |
| `api/holdings-csv.js` | — | kept as-is |
| `api/market-gauge.js` | — | kept as-is (wildcard CORS intentional) |
| `api/v1/health.js` | — | kept as-is |

Deleted: `amfi-marketcap.js`, `amfi-schemes.js`, `amfi-schemes-list.js`, `scheme-code-map.js`, `get-users.js`, `set-role.js`, `admin/set-flag.js`, `admin/set-user-tier.js`, `v1/auth/login.js`, `v1/auth/logout.js`, `v1/auth/signup.js` (auth/* confirmed dead — Firebase replaced Supabase auth in PH0-S1).

Frontend callers updated: `CoverageDashboard.jsx`, `ToolAccessMatrix.jsx`, `AmfiMarketCapUpload.jsx`, `UserManager.jsx`, `SchemeMapping.jsx`. Build: 942 modules, no new errors.

CORS fix: `amfi-schemes.js` used wildcard `*` — corrected to `fundlens-six.vercel.app` in `api/amfi.js`.

---

## PH0-S5 — CSS Theming System ✅ (09 May 2026)

| Item | Status |
|---|---|
| `src/theme.css` — single source of truth for all design tokens (brand, surfaces, text, semantic, typography, shape, shadows) | ✅ Done |
| `src/index.css` — global body reset using theme vars (`--font-body`, `--color-text-primary`, `--color-bg`) | ✅ Done |
| `src/main.jsx` — import `theme.css` then `index.css` before App (order matters: vars before globals) | ✅ Done |
| `src/hooks/useAdvisorTheme.jsx` — white-label hook: fetches `advisor_profiles`, injects `<style id="advisor-theme">` with sanitised CSS (only `--color-primary` and `--color-primary-dark` hex values permitted), exposes `advisorLogo` | ✅ Done |
| `src/components/Nav.jsx` — full rewrite: all hex → CSS vars, advisor logo swap with `onError` fallback to FundLens wordmark, dark mode override | ✅ Done |
| `src/pages/Home.jsx` — full rewrite: local `--hp-*` CSS var block removed, all vars replaced with direct theme vars, `background: #fff` on cards → `var(--color-surface-raised)` for dark mode | ✅ Done |
| `src/pages/Login.jsx` — full rewrite: all inline hex → CSS var strings, card bg → `var(--color-surface-raised)`, page bg → `var(--color-bg)` | ✅ Done |
| `src/pages/Upgrade.jsx` — full rewrite: all inline hex → CSS var strings | ✅ Done |
| Vite build — 945 modules, no new errors | ✅ Done |

### Theming system design

- **`src/theme.css`** — `:root` block with all design tokens. Dark mode via `@media (prefers-color-scheme: dark)` only — no JS toggle. Never import in components; imported once in `main.jsx`.
- **White-label override** — `useAdvisorTheme()` hook fetches `advisor_profiles` (Supabase) for signed-in advisors, injects `<style id="advisor-theme">` with regex-sanitised CSS. Only `--color-primary` and `--color-primary-dark` hex values are extracted; all other input is discarded. Tag removed on sign-out or unmount.
- **Logo swap** — Nav shows advisor `<img>` (`max-height: 32px; max-width: 120px; object-fit: contain`) when `advisorLogo` is set. Falls back to FundLens wordmark on `onError`. State reset via `useEffect` when `advisorLogo` changes.
- **CSS vars in React inline styles** — works correctly: `style={{ color: 'var(--color-primary)' }}` — browser resolves the custom property.
- **Dark mode coverage** — `--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-border`, all text vars overridden. Cards use `var(--color-surface-raised)` (not `#fff`) so dark mode renders correctly. `--color-primary`, `--color-primary-light`, `--color-advisor-ria` not overridden in dark (brand colors stay consistent).

### Token mapping (from old Home.jsx local vars)

| Old var | Theme var |
|---|---|
| `--hp-accent` | `var(--color-primary)` |
| `--hp-accent-dk` | `var(--color-primary-dark)` |
| `--hp-ria` | `var(--color-advisor-ria)` |
| `--hp-ria-lt` | `#e8f0fe` (inlined — no theme equivalent) |
| `--hp-text` | `var(--color-text-primary)` |
| `--hp-text-2` | `var(--color-text-secondary)` |
| `--hp-text-3` | `var(--color-text-muted)` |
| `--hp-border` | `var(--color-border)` |
| `--hp-green-lt` | `var(--color-primary-light)` |
| `--hp-bg-strip` | `var(--color-surface)` |
| `--hp-font` | `var(--font-body)` |

### Pending manual actions

None — all code changes complete. Run SQL migrations (001, 002, 003) when Supabase recovers, then populate `advisor_profiles.css_override` and `logo_url` to test white-label path.

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

## PL-12 — F1 Health Check ✅ (24 May 2026)

| Item | Status |
|---|---|
| `src/pages/PortfolioLens/F1HealthCheck.jsx` — 8-rule engine, SVG semicircle score gauge, expandable accordion | ✅ Done |
| `src/App.jsx` — replaced PLPlaceholder for `/portfolio/f1` with `<F1HealthCheck />` | ✅ Done |
| Vite build — 946 modules, no new errors | ✅ Done |

### F1 Health Rules (R1–R8)

| Rule | What it checks | Severity bands |
|---|---|---|
| R1 | Direct vs Regular plan adoption | PASS/WARN/FAIL |
| R2 | Growth vs IDCW option discipline | PASS/WARN/FAIL |
| R3 | Single-AMC concentration (> 35 / 50%) | PASS/WARN/FAIL |
| R4 | Portfolio complexity (5–12 schemes optimal) | PASS/WARN/FAIL |
| R5 | Short-term equity holdings (< 12 months = STCG at 20%) | PASS/WARN/FAIL/INFO |
| R6 | LTCG exemption utilisation (₹1.25L annual limit, tax harvesting) | PASS/WARN/FAIL/INFO |
| R7 | Dormant folio cleanup (< ₹500 invested residuals) | PASS/WARN/FAIL |
| R8 | Liquidity buffer (3–15% in liquid/overnight funds) | PASS/WARN |

### F1 Design decisions
- **Score gauge** — SVG semicircle arc; fills left → right; 0–100 integer; colour bands: ≥85 Excellent (green), 70–84 Good, 50–69 Needs Attention (amber), < 50 Poor (red)
- **R6** — requires Holdings snapshot for current NAV; shows INFO with prompt if missing
- **R5** — shows INFO if no equity/hybrid holdings detected
- **Category inference** — regex on `scheme_name` only; no external API; covers liquid, debt, arbitrage, hybrid, ELSS, passive equity, sector equity, equity
- **Score** — average of scorable (non-INFO) rules; INFO rules excluded from average so they don't penalise portfolios without Holdings snapshots

---

## PL-13 — F2 Alerts Engine ✅ (24 May 2026)

| Item | Status |
|---|---|
| `src/pages/PortfolioLens/F2Alerts.jsx` — 6 alert types, snooze/dismiss, 3-tab UI | ✅ Done |
| `src/App.jsx` — replaced PLPlaceholder for `/portfolio/f2` with `<F2Alerts />` | ✅ Done |
| Vite build — 947 modules, no new errors | ✅ Done |

### F2 Alert Types

| Alert | ID | Trigger | Severity |
|---|---|---|---|
| LTCG Window | `LTCG_WINDOW` | Equity holding 335–364 days old with unrealised STCG > ₹10K — hold 1 more month to avoid 20% STCG | High |
| LTCG Harvest | `LTCG_HARVEST` | Total unrealised LTCG exceeds ₹1.25L — harvest now to avoid exceeding annual exemption | High |
| Dormant Folio | `DORMANT_FOLIO` | Holding invested < ₹500 and held > 90 days — review and consolidate | Medium |
| SIP Due | `SIP_DUE` | Monthly SIP pattern detected (25–36 day gaps), next instalment within 7 days | Low |
| Concentration Risk | `CONCENTRATION_RISK` | Single AMC > 50% of portfolio value | Medium |
| Underperforming Fund | `UNDERPERFORMING` | Fund XIRR trails portfolio average by ≥ 5 pp AND invested ≥ ₹50K | Medium |

### F2 Design decisions
- **Alert states** — `watching` (condition unmet) · `fired` (condition met) · `snoozed` (dismissed for 7/30/365 days)
- **Snooze persistence** — stored in `fundlens_alerts_v1` (localStorage); deterministic alert IDs (`${TYPE}-${pid8}-${safeScheme}`) so snooze survives re-evaluations
- **Dismiss** — 365-day snooze (no separate dismissed state)
- **Reactivate** — restores snoozed alert to fired immediately
- **Tabs** — Active (fired) · Snoozed · All
- **Re-check button** — increments `checkKey` to force re-evaluation without page reload
- **Snooze dropdown** — fullscreen transparent backdrop (z-index 98) + dropdown (z-index 99) for outside-click close
- **`computeHoldingDays(h)`** — recomputes from `first_investment_date` in real-time (never uses stale `holding_period_days`)
- **UNDERPERFORMING** — uses portfolio average XIRR as benchmark proxy (no external data required)

---

## PL-15 — F4 Model Portfolio ✅ (24 May 2026)

| Item | Status |
|---|---|
| `src/pages/PortfolioLens/F4ModelPortfolio.jsx` — 3×3 risk × horizon grid, editable cells, Apply to F3 handoff | ✅ Done |
| `src/pages/PortfolioLens/F3RebalancePlanner.jsx` — minimal targeted edit: `useState` reads `fundlens_rebalance_target_v1` handoff key on mount | ✅ Done |
| `src/App.jsx` — replaced PLPlaceholder for `/portfolio/f4` with `<F4ModelPortfolio />` | ✅ Done |
| Vite build — 949 modules, no new errors | ✅ Done |

### F4 Design decisions
- **Grid** — 3×3: rows = Conservative/Moderate/Aggressive; columns = Short (< 3Y) / Medium (3–7Y) / Long (> 7Y)
- **Defaults** — 9 pre-populated cells with Indian MF allocations (E/H/D/L summing to 100); Hybrid=0 in all defaults per spec
- **Cell data** — `{ alloc: { Equity, Hybrid, Debt, Liquid }, categories: [...], returnRange }`
- **Edit modal** — 4 allocation inputs (E/H/D/L), fund category text (comma-separated), return range; live sum validator; Reset to default per cell
- **Selection** — risk + horizon pill buttons (desktop) / dropdowns (mobile); selected cell highlighted with ACC border; gap vs current portfolio shown on selected cell only
- **Apply to F3** — writes `fundlens_rebalance_target_v1` to localStorage then navigates to `/portfolio/f3`; F3 consumes on mount and removes the key
- **Save model** — `fundlens_model_portfolio_v1` (version 1.0); auto-saved on each edit + explicit Save button
- **Advisor stub** — "Client default" button shown when `isAdvisor`; toast only (Phase 3: will write to advisor_profiles)
- **Mobile** — `isMobile = width < 640`; dropdowns instead of pills; 1-column stacked card list; desktop shows structured grid with axis labels
- **Toast** — fixed bottom-right; 2.5s auto-dismiss; manual dismiss

---

## PL-16 — F5 Send Report ✅ (24 May 2026)

| Item | Status |
|---|---|
| `src/pages/PortfolioLens/F5SendReport.jsx` — section toggles, print CSS visibility trick, window.print(), mailto: email draft | ✅ Done |
| `src/App.jsx` — replaced PLPlaceholder for `/portfolio/f5` with `<F5SendReport />` | ✅ Done |
| Vite build — 950 modules, no new errors | ✅ Done |

### F5 Design decisions
- **Print isolation** — `body * { visibility: hidden }` + `.f5-print-report * { visibility: visible }` + `position:absolute;left:0;top:0` — hides nav/sidebar/toggles without needing class names on them
- **Print CSS** — `@page { size: A4 portrait; margin: 12mm 18mm }` · `page-break-before: always` between sections · stat grid 4-column · tables with header rule
- **Section toggles** — E1 (Portfolio Summary) always enabled; E2/E3/E7/F1/F3 user-toggleable; sections with no data shown greyed out with "no data" label
- **Email draft** — `mailto:` link (no server call) with plain-text summary — DPDP-safe; opens OS email client
- **Health score** — 6 rules (R1–R5, R8); R6/R7 skipped (need NAV/folio data); score = average of per-rule scores (PASS=100, WARN=60, FAIL=20)
- **F3 plan** — reads `fundlens_rebalance_plan_v1` from localStorage; shows redemptions/investments table
- **Advisor mode** — checks `role === 'advisor'` via `useRole()`; reads `fundlens_advisor_profile.firm_name` from localStorage for header; falls back to "FundLens"
- **DPDP** — no PAN/name/folio in report; all processing browser-side; mailto body is plain-text summary only
- **New localStorage keys read (read-only):** `fundlens_portfolios`, `fundlens_rebalance_plan_v1`, `fundlens_advisor_profile`

---

## PL-14 — F3 Rebalance Planner ✅ (24 May 2026)

| Item | Status |
|---|---|
| `src/pages/PortfolioLens/F3RebalancePlanner.jsx` — 4-step wizard, SVG donut, tax-aware redemption plan | ✅ Done |
| `src/App.jsx` — replaced PLPlaceholder for `/portfolio/f3` with `<F3RebalancePlanner />` | ✅ Done |
| Vite build — 948 modules, no new errors | ✅ Done |

### F3 Wizard Steps

| Step | Content |
|---|---|
| 1 — Current | Current allocation by macro-category (Equity/Hybrid/Debt/Liquid) — value, %, scheme count; live SVG donut |
| 2 — Target | User sets target %; presets (Conservative/Balanced/Aggressive); live donut pair; % total validator |
| 3 — Plan | Tax-efficient redemption list (LTCG-eligible lots first); buy-side target amounts; LTCG exemption note |
| 4 — Summary | Stat cards (redeem/tax/net/invest); full redemption table; Save plan to localStorage |

### F3 Design decisions
- **Macro categories** — Equity (equity + elss + equity_passive + equity_sector), Hybrid, Debt (debt + arbitrage), Liquid (liquid + overnight + money market)
- **Tax-efficient ordering** — LTCG-eligible lots first: equity/hybrid 365d; debt 1095d (3 years)
- **Tax calculation** — Equity STCG 20%, Equity/Hybrid LTCG 12.5% above 1.25L exemption, Debt LTCG 12.5%, Debt STCG slab rate
- **No Holdings snapshot required** — falls back to invested_amount; note shown
- **Save plan** — fundlens_rebalance_plan_v1 in localStorage
- **SVG donut** — stroke-dasharray on concentric circles; rotate(-90deg); 2.5px gap between segments

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
| PL-12 | F1 Health Check (8-rule engine, score gauge, accordion) | ✅ Done |
| PL-13 | F2 Alerts engine | ✅ Done |
| PL-14 | F3 Rebalance Planner | ✅ Done |
| PL-15 | F4 Model Portfolio | ✅ Done |
| PL-16 | F5 Send Report | ✅ Done — 24 May 2026 |
| PL-17 | Advisor mode | ⏳ Pending (Phase 3) |

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
| `src/pages/PortfolioLens/F1HealthCheck.jsx` | 8-rule engine (R1–R8) · semicircle score gauge · expandable accordion · LTCG alert |
| `src/pages/PortfolioLens/F2Alerts.jsx` | 6 alert types · watching/fired/snoozed states · snooze/dismiss actions · tabbed filter UI |
| `src/pages/PortfolioLens/F3RebalancePlanner.jsx` | 4-step wizard · current/target allocation · tax-aware lot selection · LTCG exemption · save plan |
| `src/pages/PortfolioLens/F4ModelPortfolio.jsx` | 3×3 model grid · editable E/H/D/L allocations · fund category chips · Apply-to-F3 handoff · advisor stub |
| `src/hooks/useWindowWidth.js` | Responsive width hook |

**localStorage keys:** `fundlens_pl_consent`, `fundlens_portfolios` (schema_version: "2.0" — portfolio is investor-level with raw.cams/kfin/holdings slots), `fundlens_alerts_v1` (schema_version: "1.0" — alert snooze map keyed by deterministic alert ID), `fundlens_rebalance_plan_v1` (free-form — last saved rebalance plan with redemption list + tax estimates), `fundlens_model_portfolio_v1` (version: "1.0" — 9-cell model grid with alloc/categories/returnRange per cell + selected profile), `fundlens_rebalance_target_v1` (transient handoff — F4 writes E/H/D/L targets; F3 reads + deletes on mount)
**SheetJS:** xlsx 0.18.5 added for .xls/.xlsx parsing

---

## Auth Fix — Role Detection ✅ (24 May 2026)

| Item | Status |
|---|---|
| `src/hooks/useAuth.jsx` — rewrite: `profiles` table (not `users`), `onIdTokenChanged` for token refresh, fresh `getIdToken()` in profile loader, retry SELECT on INSERT conflict, `refreshRole()` export | ✅ Done |
| `api/admin.js` — rewrite: `profiles` table (not `users`) for all admin role checks and user listings, extracted `requireAdmin()` helper | ✅ Done |
| `src/pages/AdminLayout.jsx` — rewrite: user email + role badge in sidebar footer, Sign Out button via `useAuth()`, "FundLens" branding | ✅ Done |
| `migrations/001_users_table.sql` — fix: table name `users` → `profiles`; all RLS policies renamed to `profiles_*` | ✅ Done |
| `migrations/002_advisor_profiles.sql` — fix: `REFERENCES public.profiles(id)` (was `users`); admin policy references `profiles` | ✅ Done |
| Vite build — 950 modules, no new errors | ✅ Done |

### Root cause
`useAuth.jsx` queried the `users` REST endpoint but the live Supabase table is `public.profiles`.
Every `sbFetch` call returned an error → `null` → code fell into the "create row" branch →
INSERT also failed (row already exists) → `setRole('individual')` fallback → admin/advisor
features never activated.

### Key fixes
- **Table name**: `users` → `profiles` in both `useAuth.jsx` and `api/admin.js`
- **Token freshness**: replaced `onAuthStateChanged` with `onIdTokenChanged` — fires on the ~1h automatic token refresh, keeping the stored JWT current
- **INSERT result**: changed `Prefer: return=minimal` → `return=representation` so the created row's role is read back directly (avoids a second SELECT on first sign-in)
- **Conflict safety**: added retry-SELECT after a failed INSERT (handles concurrent logins / row already exists)
- **`refreshRole()`**: new export — call after an admin changes another user's role so their session picks up the new role immediately

### Action required (manual)
- **Add `VITE_SUPABASE_ANON_KEY` to Vercel env vars** — missing from prod deployment (present in local `.env`)
  Without this, all `sbFetch` calls return 401 in production (apikey header is undefined)
- **Add `SUPABASE_SERVICE_KEY` to Vercel env vars** — `api/admin.js` uses `SUPABASE_SERVICE_KEY`;
  local `.env` has `SUPABASE_KEY` (different name). Set `SUPABASE_SERVICE_KEY` in Vercel to the service-role key.

---

## Immediate Next Session Priorities

| Priority | Task |
|---|---|
| P0 | **Set `VITE_SUPABASE_ANON_KEY` in Vercel** — missing from prod; without it role detection fails in production |
| P0 | **Set `SUPABASE_SERVICE_KEY` in Vercel** — `api/admin.js` uses this name; local `.env` has `SUPABASE_KEY` |
| P0 | Run `migrations/002_advisor_profiles.sql` in fundlens-prod SQL editor when Supabase IO recovers |
| P0 | Run `migrations/003_promo_messages.sql` in fundlens-prod SQL editor when Supabase IO recovers |
| P0 | Confirm Vercel deployment is live and green at fundlens-six.vercel.app |
| P1 | **PH3-S1** — Multi-client advisor dashboard (`/advisor/clients`, localStorage-based, Phase 3 start) |
| P1 | **PH1-S4** — Pipeline Cell 1 rebuild (today-only NAV fetch, replace pipeline_cell1.py) |
| P1 | **NAV REINDEX** — Run `REINDEX INDEX CONCURRENTLY nav_history_scheme_id_nav_date_idx;` in Supabase SQL editor to recover ~1–1.5 GB index bloat |
| P2 | **NAV top-up** — Run `--auto-resume` nightly to stay current (T-1) |

---

## Pending Manual Actions

| # | Action | Blocked by | Notes |
|---|---|---|---|
| 1 | Run `migrations/002_advisor_profiles.sql` in fundlens-prod | Supabase IO timeout | advisor_profiles table + admin RLS policies |
| 2 | Run `migrations/003_promo_messages.sql` in fundlens-prod | Supabase IO timeout | promo_messages table + public read RLS; populate with 3 STATIC_PROMOS rows |
| 3 | Vercel redeploy — promote commit `5543556` to Production | Manual trigger | Required for theme.css / useAdvisorTheme to go live |

---

## Resource Management Rules

| Rule | Detail |
|---|---|
| NAV backfill | Run only outside working hours (nights/weekends). Monitor IO budget at Supabase dashboard before starting. |
| Serverless function count | Always check `api/` count before adding functions — Vercel Hobby hard limit is 12. Currently at 5. |
| Supabase migrations | Run immediately after the session that writes them — never batch across sessions. |
| Supabase IO budget | Check dashboard before any large data operation. Backfill is the primary consumer. |

---

## Database State — Supabase fundlens-prod

| Table | Rows | Status | Notes |
|---|---|---|---|
| `amcs` | 51 | ✅ Complete | 104 name variations (51 canonical + 53 alternates) |
| `schemes` | 16,364 | ✅ Complete | All active schemes, 100% AMC linkage |
| `nav_history` | ~25.2M (gap repair complete — 11.66M new rows added 24 May 2026) | ✅ Gap repair complete | 2006-01-01 → 2026-04-30 · 0 windows failed · REINDEX recommended |
| `bse_index_data` | 264,628 | ✅ Complete | BSE index data |
| `scrip_master` | 5,158 | ✅ Complete | Securities master |

**Storage:** ~5–6 GB estimated (index bloated — run `REINDEX INDEX CONCURRENTLY nav_history_pkey` after gap repair)
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
| `backfill_nav_history.py` | v1.4.0 | ✅ Live | T-1 auto end-date fix · --from/--to aliases · BATCH_UPSERT_SIZE=400 · INTER_BATCH_SLEEP=0.0 |
| `gap_repair.sh` | v1.0 | ✅ Done | Year-by-year gap repair 2006-2026 — run once. Pre-2006 dry-run: AMFI returns 0 rows (no data before 2006). |
| `sync_amc_master.py` | v2.0 | ✅ Ready | Sync AMCs from FundInsight → amcs table. |
| `populate_schemes_table.py` | v2.0 | ✅ Ready | Load scheme master from AMFI. |
| `uti_fetch.py` | v1.0 | ⛔ Retired | Replaced by cell_a_fetcher. |
| `pipeline_cell1.py` | v4.3.1 | ⏸ Pending rebuild | Remove 5Y fetch, today-only NAV (Phase 1 S4) |
| `pipeline_cell2.py` | v4.3.1 | ⏸ Pending rebuild | Upload to Gist rebuild (Phase 1 S4) |

---

## NAV Backfill — Status ✅ Gap Repair Complete (24 May 2026)

Gap repair ran 23:28–00:48 IST (1h 20m). All 21 years 2006–2026 completed with 0 failures.

| Year | New rows | Year | New rows |
|---|---|---|---|
| 2006 | 146,236 | 2014 | 1,039,036 |
| 2007 | 225,516 | 2015 | 1,258,422 |
| 2008 | 274,098 | 2016 | 1,402,692 |
| 2009 | 311,951 | 2017 | 1,468,438 |
| 2010 | 355,066 | 2018 | 1,552,363 |
| 2011 | 378,096 | 2019 | 1,771,784 |
| 2012 | 405,655 | 2020–2025 | 270,135 |
| 2013 | 799,665 | 2026 | 0 (already current) |
| **Total new** | **11,659,153** | **Est. total** | **~25.2M rows** |

Pre-2006 dry-run: AMFI returns 0 rows — data starts from 2006. No backfill needed before 2006.

**Next nightly top-up (daily maintenance):**
```bash
cd ~/Documents/fundlens
set -a && source .env && set +a
python pipeline/backfill_nav_history.py --auto-resume
```

**REINDEX (run once in Supabase SQL editor — recovers ~1–1.5 GB of index bloat):**
```sql
REINDEX INDEX CONCURRENTLY nav_history_scheme_id_nav_date_idx;
```

**Verification SQL (run in Supabase SQL editor):**
```sql
SELECT EXTRACT(YEAR FROM nav_date) AS year, COUNT(*) AS rows
FROM nav_history GROUP BY year ORDER BY year;

SELECT COUNT(*) AS total_rows,
       MIN(nav_date) AS earliest,
       MAX(nav_date) AS latest
FROM nav_history;
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
