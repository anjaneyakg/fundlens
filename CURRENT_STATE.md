# FundLens — Current State (Pipeline, Data & Build Track)

**Owner:** Claude Code
**Last updated:** 02 Jun 2026 · v45.0
**Companion file:** `PLATFORM_STATE.md` — design, auth decisions, go-live plan

> **Session protocol:**
> Fetch BOTH files at session start:
> - `https://raw.githubusercontent.com/anjaneyakg/fundlens/main/CURRENT_STATE.md`
> - `https://raw.githubusercontent.com/anjaneyakg/fundlens/main/PLATFORM_STATE.md`
>
> Update ONLY `CURRENT_STATE.md` at session close. Never touch `PLATFORM_STATE.md`.
> Always: update file → `git add` → `git commit` → `git push` before ending session.

---

## Dues Tab Bug Fix ✅ (02 Jun 2026)

**Root cause:** `RecurringSection.handleSave()` never included `due_date_next` in the insert payload. The database row stored NULL for `due_date_next`. The Dues filter at line `r.is_active && r.due_date_next && ...` excluded all items with a null due date, so nothing appeared in the Dues tab — even though the item was correctly saved and visible in Analytics.

| Fix | Change |
|---|---|
| FIX A — `due_date_next` on save | Added `computeInitialDueDate(frequency, dueDay)` helper. Computes the next occurrence: monthly uses `due_day` to pick this-month or next-month date; weekly = +7 days; daily = +1 day; yearly = +1 year. Called on form init, on frequency/due_day field change, and in `handleSave` payload. |
| FIX A — "First due date" field | Added visible `<input type="date">` in the Add Recurring Item form, auto-populated by `computeInitialDueDate`, user-overrideable. Save button disabled until this field is filled. |
| FIX B — Dues filter uses local time | Replaced `d.toISOString().slice(0,10)` (UTC) with `dateToDStr(d)` (local). All date comparisons now use `new Date(str + 'T00:00:00')` to force local parsing. `is_active === false` check (not truthy check) — items with undefined/null `is_active` are included. |
| FIX C — Context already correct | `ExpenseContext.addRecurringItem` already includes `is_active: true` on insert — no change needed. |
| FIX D — Debug logging | `console.log('Dues debug:')` fires when `recurringItems.length > 0` but `allDues.length === 0`, printing `name/due_date_next/is_active/frequency` for each item to help diagnose residual issues. |
| Build | 966 modules, 0 errors, 0 new warnings. |

### Impact on existing items (items saved before this fix)
Items saved before this fix have `due_date_next = NULL` in the database. They still won't appear in the Dues tab until `due_date_next` is set. To fix existing items: go to Setup → Recurring Items → delete and re-add each item (new save flow will compute the date). Or update `due_date_next` directly in Supabase SQL editor.

---

## EB-S2 — Analytics + Dues Full Implementation ✅ (02 Jun 2026)

| Item | Status |
|---|---|
| `src/components/expenses/ExpenseAnalytics.jsx` — new 400-line component, 8 sections (A–H), recharts 2.12.7 | ✅ Done |
| Section A: Mask/unmask pill toggle — all ₹ values show as "₹ ••••" when masked; charts render grey | ✅ Done |
| Section B: Period selector — This Month / Last Month / Last 3M / Last 6M / This Year / Custom Range | ✅ Done |
| Section C: Summary tiles — Income, Expense, Net with txn counts | ✅ Done |
| Section D: Category breakdown — donut (PieChart, top 5, grey when masked) + budget utilisation list (green/amber/red progress bars) | ✅ Done |
| Section E: Monthly trend — BarChart, always last 6 months, Income (#10b981) / Expense (#dc2626) | ✅ Done |
| Section F: Payment source split — PieChart by source_type + legend with ₹ and % | ✅ Done |
| Section G: CC reconciliation — billing cycle detection, manual bill input, diff calculation, Log Untracked button (addTransaction), Mark Resolved (session state) | ✅ Done |
| Section H: 12-month cash outflow projection — ComposedChart (stacked bars: committed #1A3C6E + variable #93c5fd + total line #dc2626), projection table below | ✅ Done |
| `src/pages/ExpenseManager.jsx` — Analytics tab replaced with ExpenseAnalytics component; Dues tab full implementation | ✅ Done |
| Dues tab: overdue section (red) + upcoming grouped by This Week / Next Week / Later | ✅ Done |
| Mark Paid: addTransaction + computeNextDue (daily/weekly/monthly/yearly) + updateRecurringItem + toast | ✅ Done |
| Snooze 3d: updateRecurringItem (due_date_next +3 days) + toast | ✅ Done |
| Empty state: "🎉 All clear! No payments due in the next 30 days" | ✅ Done |
| Vite build — 966 modules, 0 errors, 0 new warnings | ✅ Done |

### EB-S2 Architecture Notes

- ExpenseAnalytics receives `{ transactions, categories, paymentSources, recurringItems, addTransaction }` as props from ExpenseManager. Does NOT import useExpense — addTransaction passed down so the analytics component stays pure.
- Monthly trend (Section E) always uses ALL transactions (last 6 calendar months), ignoring the period selector — intentional, gives stable 6-month view regardless of filter.
- CC billing cycle: if `billing_cycle_date = N`, cycle starts on day N of the month containing today (or prior month if today < N). Logged CC spend is filtered to this cycle date range.
- 12-month projection: committed = recurring items scaled to monthly equivalent. Variable = last 3-month average spend per category excluding categories already covered by a recurring item (to avoid double-counting). Yearly items only appear in their due month.
- Dues tab badge count = all items with `due_date_next <= today+30` (includes overdue). Both `handleMarkPaid` and `handleSnooze` use `dueProcessing` state (item id) to disable all buttons while one operation is running.
- `computeNextDue` advances due_date_next by one cycle after Mark Paid — item will reappear in the next cycle.
- Toast in ExpenseManager uses `Date.now()` in key to force remount if two rapid actions fire.

---

## EB-S1 Visual Fixes ✅ (02 Jun 2026)

| Item | Status |
|---|---|
| `src/components/common/Toast.jsx` — new reusable toast component, slide-down from top, success (#1A3C6E) / error (#dc2626), auto-dismiss | ✅ Done |
| `src/components/expenses/ExpenseEntryPanel.jsx` — full rewrite: explicit light theme (#ffffff panel, #f8faff amount bg), 36px amount input, decimal inputMode, selected chips navy (#1A3C6E/white), save button states (loading spinner, ✓ Saved!, ✗ Try again), panel closes 1200ms after success, toast on save | ✅ Done |
| `src/components/expenses/ExpenseFAB.jsx` — rewrite: background #1A3C6E (navy), safe-area bottom `calc(16px + env(safe-area-inset-bottom))` | ✅ Done |
| `src/components/expenses/ExpenseDashboardWidget.jsx` — rewrite: explicit light theme, Log Expense button #1A3C6E, fixed masked bar widths (no Math.random re-render), progress bar green/amber/red | ✅ Done |
| `src/pages/ExpenseManager.jsx` — rewrite: #f8f9fa page bg, tabs #1A3C6E active, filter chips #1A3C6E, budget alert banner (amber ≥75%, red ≥100%), dismissible, badge count on Log tab, Mark Paid button #1A3C6E, all amounts #dc2626/#16a34a | ✅ Done |
| `src/components/Nav.jsx` — budget badge: `useExpense` imported, `budgetAlertCount` computed (categories ≥75% budget this month), red badge on Expenses tab (desktop + mobile drawer) | ✅ Done |
| Vite build — 965 modules, 0 errors, 0 new warnings | ✅ Done |

### EB-S1 Fixes — Architecture Notes

- Toast is managed as local state in ExpenseEntryPanel (`toastState = { message, type } | null`). Renders above panel (z-index 9999) via fixed position — no portal needed.
- Save button FSM: `idle → loading → success | error → idle`. On success: closes panel after 1200ms. On error: resets after 2000ms.
- Budget alert banner in Log tab uses current month transactions always (independent of the filter range). `alertDismissed` is session-only (useState, not persisted).
- Nav badge: `budgetAlertCount` computed in Nav via `useMemo` from ExpenseContext. Passed as `budgetAlertCount` prop into MobileDrawer. `DrawerSection` and `NavTab` both accept `badge` prop.
- FAB color is now distinctly navy (#1A3C6E) vs green (#16a34a save/income) — FundLens primary brand color.
- Dark mode: all Expense components now use hardcoded light values — no CSS var that could resolve to dark. System dark mode will NOT affect these components (intentional: financial data screen should always be light and legible).

---

## EB-S1 — Expense Manager Foundation ✅ (01 Jun 2026)

| Item | Status |
|---|---|
| `migrations/005_expense_manager.sql` — 4 tables + RLS (expense_payment_sources, expense_categories, expense_recurring, expense_transactions) | ✅ Written — ⚠ Run manually in Supabase SQL editor |
| `src/context/ExpenseContext.jsx` — loads all 4 tables on mount, auto-inserts 17 default categories + 1 Cash source, exposes full CRUD | ✅ Done |
| `src/components/expenses/ExpenseEntryPanel.jsx` — slide-up panel, amount + type toggle + category/source/member/date/note, pre-selects last-used | ✅ Done |
| `src/components/expenses/ExpenseFAB.jsx` — fixed bottom-right FAB, opens EntryPanel, visible on all post-login screens | ✅ Done |
| `src/components/expenses/ExpenseDashboardWidget.jsx` — compact widget, masked/unmasked, budget progress bar, Log Expense + View Details | ✅ Done |
| `src/pages/ExpenseManager.jsx` — /expenses, 4 tabs: Log + Setup + Analytics (stub) + Dues | ✅ Done |
| `src/App.jsx` — /expenses route (individual-protected), ExpenseProvider wrapper, FAB conditionally shown | ✅ Done |
| `src/components/Nav.jsx` — "Expenses" as first tab (desktop + mobile drawer), authenticated users only | ✅ Done |
| Vite build — 964 modules, 0 errors, 0 new warnings | ✅ Done |

### EB-S1 New Files

| File | Purpose |
|---|---|
| `migrations/005_expense_manager.sql` | 4 Supabase tables + RLS |
| `src/context/ExpenseContext.jsx` | Data layer + CRUD |
| `src/components/expenses/ExpenseEntryPanel.jsx` | Floating entry panel |
| `src/components/expenses/ExpenseFAB.jsx` | Fixed FAB button |
| `src/components/expenses/ExpenseDashboardWidget.jsx` | Dashboard embed widget |
| `src/pages/ExpenseManager.jsx` | Main /expenses page |

### EB-S1 Pending Manual Action

**Run `migrations/005_expense_manager.sql` in Supabase fundlens-prod SQL editor before testing.**
Creates: expense_payment_sources, expense_categories, expense_recurring, expense_transactions (all with RLS).

### EB-S1 Architecture Notes

- ExpenseContext wraps AppInner (inside ExpenseProvider in App.jsx); ExpenseFAB renders at app level — only when `user && !isGuest`.
- Auto-default seeding: if user has 0 categories on first open, ExpenseContext inserts the 17 default categories + 1 Cash source in one transaction. Idempotent: only fires if count === 0.
- RLS policy on all 4 tables: `auth.jwt() ->> 'sub' = user_id` — each user sees only their own rows.
- Last-used category + source persisted in `localStorage` keys `eep_last_cat` / `eep_last_src` — pre-selected on every panel open.
- Dues tab: lists recurring items where `due_date_next ≤ today + 30 days`. Mark Paid auto-logs a transaction with `recurring_id` FK set.
- Family members: stored as text on transactions (`family_member` column) — not a FK table yet. FamilyMembersSection in Setup tab manages a local state list (pre-populated from transaction history). FK table planned for EB-S3.
- Analytics tab: stub only ("coming soon"). Full charts in EB-S2.

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

## PH3-S1 — Advisor Dashboard ✅ (30 May 2026)

| Item | Status |
|---|---|
| `src/advisor/AdvisorDashboard.jsx` — widget-based dashboard at `/advisor`: 5 widgets, per-uid localStorage prefs, slide-out Manage Widgets drawer, greeting header, auth gate, upgrade prompt | ✅ Done |
| `src/advisor/AdvisorClientView.jsx` — stub placeholder at `/advisor/client/:id` (PH3-S5 scope) | ✅ Done |
| `src/App.jsx` — added `/advisor` and `/advisor/client/:id` routes (ProtectedRoute requiredRole="advisor") | ✅ Done |
| `src/components/Nav.jsx` — "📊 Advisor Dashboard" link in user dropdown for advisor + admin roles | ✅ Done |
| Vite build — 952 modules, 0 new errors | ✅ Done |

### Widgets delivered

| Widget ID | Display name | Data source |
|---|---|---|
| `my_assets` | My Assets | advisor_client_links COUNT + AUM placeholder |
| `client_list` | Client List | advisor_client_links JOIN profiles!client_id — sortable table, row click → /advisor/client/:id |
| `health_snapshot` | Health Snapshot | same links query — green/amber/red tiles, clicking filters client_list |
| `alerts` | Alerts | empty state only — TODO PH4: per-client alerts |
| `market_indicators` | Market Indicators | bse_index_data (latest per index) + airrow_sentiment_archive (latest row) |

### Design decisions

- **Widget prefs** — `advisor_widget_prefs_[uid]` in localStorage; default all visible; eye-off icon hides; Manage Widgets drawer toggles; Reset to defaults restores all
- **Auth gate** — loading → Navigate to /login → upgrade prompt (not advisor/admin) → dashboard
- **Client join** — `profiles!client_id(id, email)` FK hint for disambiguation (both advisor_id and client_id FK to profiles); graceful fallback to client_label → client_id prefix if profiles RLS blocks
- **Market Indicators** — anon client used for bse_index_data and airrow_sentiment_archive (no RLS on those tables); authenticated client for advisor_client_links
- **HealthFilter** — state shared between HealthSnapshotWidget (sets) and ClientListWidget (reads); clear-filter button on snapshot widget

### Supabase tables queried (all live in fundlens-prod)

| Table | Query | Notes |
|---|---|---|
| `advisor_client_links` | SELECT client_id, client_label, relationship_since, updated_at, profiles!client_id(id, email) WHERE advisor_id = uid AND status = 'active' | Firebase JWT client |
| `bse_index_data` | SELECT index_name, date, close, points_change, change_pct IN ('NIFTY 50', 'SENSEX', 'NIFTY MID 150') ORDER BY date DESC LIMIT 15 | Anon client |
| `airrow_sentiment_archive` | SELECT archive_date, large_cap_score, mid_cap_score, gold_score ORDER BY archive_date DESC LIMIT 1 | Anon client |

---

## PH3-S5 — Client Invitation Flow ✅ (31 May 2026)

| Item | Status |
|---|---|
| `api/advisor.js` — new serverless function: create-invite, get-my-clients, accept-invite, add-client-direct | ✅ Done |
| `src/advisor/AdvisorInviteClient.jsx` — /advisor/clients/invite: invite form, share panel (email/WhatsApp/copy), placeholder client, recent invites table | ✅ Done |
| `src/pages/AcceptInvite.jsx` — /accept-invite: public landing for invite links; handles both unauth (create/sign in) and auth (auto-accept) states | ✅ Done |
| `src/pages/Register.jsx` — modified: reads ?invite= param, calls accept-invite after registration | ✅ Done |
| `src/advisor/AdvisorDashboard.jsx` — surgical: `headerExtra` prop added to WidgetCard; "Invite Client" button added to ClientListWidget header | ✅ Done |
| `src/App.jsx` — added /advisor/clients/invite (advisor-protected) and /accept-invite (public) routes | ✅ Done |
| Vite build — 960 modules, 0 new errors | ✅ Done |

### Client invitation flow

| Step | Flow |
|---|---|
| Advisor creates invite | /advisor/clients/invite → form → api/advisor?action=create-invite → invite_url returned |
| Invite shared | Copy link / mailto: / WhatsApp wa.me link with invite_url |
| Client clicks link | /accept-invite?token=TOKEN |
| Not logged in | Shows landing card → "Create account" → /register?invite=TOKEN or "Sign in" → /login with redirect back |
| Register with invite | /register?invite=TOKEN → completes 4-step wizard → accept-invite called automatically → advisor linked |
| Already logged in | /accept-invite → auto-calls accept-invite API → success/expired/error card |
| Token accepted | advisor_client_links: client_id set, status=active, consent recorded |

### api/advisor.js actions

| Action | Auth | Description |
|---|---|---|
| `create-invite` | Advisor | INSERT advisor_client_links: status=invited, invite_token=UUID, expires 30 days. Returns invite_url |
| `get-my-clients` | Advisor | SELECT advisor_client_links for advisor_id, with profiles join for client email |
| `accept-invite` | Any auth'd | Find row by invite_token, check expiry, UPDATE with client_id+consent, INSERT admin_notifications |
| `add-client-direct` | Advisor | INSERT placeholder client (status=placeholder, no client_id, no invite) |

### Design decisions

- **`requireAdvisor()`**: checks `profiles.role IN ('advisor', 'admin')` — same JWT decode pattern as admin.js
- **Invite URL**: hardcoded to `https://fundlens.in/accept-invite?token=TOKEN` (production domain)
- **Resend**: no new row — re-populates share panel with existing token; no API call needed
- **Expiry**: checked in the API (not client-side) during accept-invite for security
- **Consent fields**: consent_given_at, consent_ip (x-forwarded-for), consent_user_agent recorded on acceptance
- **Admin notifications**: `client_linked` notification inserted (non-fatal if it fails)
- **Register + invite**: accept-invite called after refreshRole() — non-blocking (failure shows note, doesn't block registration)
- **WidgetCard headerExtra**: minimal prop addition, not a full rewrite of AdvisorDashboard

### New/modified files

| File | Action |
|---|---|
| `api/advisor.js` | Created |
| `src/advisor/AdvisorInviteClient.jsx` | Created |
| `src/pages/AcceptInvite.jsx` | Created |
| `src/pages/Register.jsx` | Modified — ?invite= handling |
| `src/advisor/AdvisorDashboard.jsx` | Surgical edit — WidgetCard headerExtra, ClientListWidget invite button |
| `src/App.jsx` | Modified — 2 new routes |

---

## PH3-S4 — Advisor Onboarding Flow ✅ (31 May 2026)

| Item | Status |
|---|---|
| `migrations/004_registration.sql` — promo_codes, regulatory_debarred, admin_notifications tables; ALTER advisor_profiles with registration/application fields; tighten advisor_profiles RLS | ✅ Written — run manually in Supabase fundlens-prod |
| `src/pages/Register.jsx` — 4-step registration wizard: choose path, details, promo code, declaration + submit | ✅ Done |
| `src/hooks/useAuth.jsx` — added `profileExists` state; removed auto-create of profiles row; `loadProfile` sets profileExists true/false | ✅ Done |
| `src/components/ProtectedRoute.jsx` — added profileExists check; redirects to /register when authenticated user has no profile row | ✅ Done |
| `src/pages/admin/AdvisorApplications.jsx` — pending applications table, approve/reject actions, admin-direct registration form | ✅ Done |
| `src/pages/AdminLayout.jsx` — notification bell with unread badge, dropdown with last 10 notifications, mark read, mark all read, 60s polling; Advisor Applications nav item | ✅ Done |
| `api/admin.js` — 6 new actions: notify-registration, approve-advisor, reject-advisor, get-notifications, mark-notification-read, admin-register-advisor | ✅ Done |
| `src/App.jsx` — /register route (public), /admin/applications route (admin) | ✅ Done |
| `src/pages/Upgrade.jsx` — "Are you a financial advisor?" CTA → /register?type=advisor | ✅ Done |
| `src/components/Nav.jsx` — shows "Complete registration →" button when user has no profile row | ✅ Done |
| Vite build — 958 modules, 0 new errors | ✅ Done |

### Registration wizard flow

| Step | Content |
|---|---|
| 1 — Choose path | Investor card vs Advisor / Distributor card; URL param `?type=advisor` or `?type=investor` auto-selects and advances |
| 2 — Details | Investor: just name. Advisor: sub-type (MFD/IFD or SEBI RIA), ARN/SEBI# (required), EUIN (optional + pending checkbox), firm name, applicant name, phone, city |
| 3 — Promo code | Optional; validates against `promo_codes` table (used_count < max_uses, not expired, registration_type matches); skip button always visible |
| 4 — Declaration + submit | Review summary, mandatory checkboxes, debarred check, profiles row creation, advisor_profiles row creation, admin notification |

### Key design decisions

- **No auto-create**: `useAuth.jsx` no longer creates a profiles row on first sign-in. `profileExists` (true/false/null) is exported from auth context. Registration wizard creates the row.
- **ProtectedRoute gate**: Any authenticated user without a profiles row is redirected to /register before accessing any protected route.
- **Debarred check**: Client-side via anon Supabase client on `regulatory_debarred` table; blocks gracefully without specifying the reason.
- **Admin notifications**: Created via `api/admin.js?action=notify-registration` (non-admin auth required) using service role — bypasses RLS on `admin_notifications`.
- **Promo code**: Validated client-side (anon client); used_count increment via API (service role) — non-fatal if it fails.
- **Advisor approval flow**: Advisors get `role=individual` at registration; `role=advisor` is set only after admin approves via AdvisorApplications page.
- **advisor_profiles RLS tightened**: Migration 004 drops the open `USING true` policy and replaces with self-only + admin-read/update/insert policies.
- **Notification bell**: Uses `createSupabaseClient(token)` directly (no API round-trip); polls every 60 seconds; unread count badge.

### New/modified files

| File | Action |
|---|---|
| `migrations/004_registration.sql` | Created |
| `src/pages/Register.jsx` | Created |
| `src/hooks/useAuth.jsx` | Modified — profileExists, no auto-create |
| `src/components/ProtectedRoute.jsx` | Modified — profileExists redirect |
| `src/pages/admin/AdvisorApplications.jsx` | Created |
| `src/pages/AdminLayout.jsx` | Modified — notification bell, Advisor Applications nav |
| `api/admin.js` | Modified — 6 new actions |
| `src/App.jsx` | Modified — /register, /admin/applications |
| `src/pages/Upgrade.jsx` | Modified — advisor CTA |
| `src/components/Nav.jsx` | Modified — profileExists banner |

### Supabase tables added / altered (run migration 004 before testing)

| Table | Change |
|---|---|
| `promo_codes` | New — promo code validation |
| `regulatory_debarred` | New — debarred list for registration blocking |
| `admin_notifications` | New — bell notifications for admin |
| `advisor_profiles` | Altered — 12 new application fields + status + RLS tightened |

### api/admin.js new actions

| Action | Auth required | Purpose |
|---|---|---|
| `notify-registration` | Any authenticated user | Insert admin_notifications + increment promo code |
| `approve-advisor` | Admin only | Set role=advisor, plan_tier, update advisor_profiles status |
| `reject-advisor` | Admin only | Update advisor_profiles status=rejected, save reason |
| `get-notifications` | Admin only | Fetch last N admin_notifications |
| `mark-notification-read` | Admin only | Mark one or all notifications as read |
| `admin-register-advisor` | Admin only | Admin-direct registration with debarred check |

---

## PH3-S3 — Promote Module ✅ (30 May 2026)

| Item | Status |
|---|---|
| `src/advisor/AdvisorPromote.jsx` — /advisor/promote: 3 section stacks (Leaflets/Email/WhatsApp), TemplateCard with MiniPreview, LeafletModal with 3 layout templates, JPEG export via html2canvas (dynamic import), email copy-to-clipboard, WhatsApp Web Share API | ✅ Done |
| `src/advisor/AdvisorDashboard.jsx` — `promote_shortcut` widget added (6th widget): shows active template counts, "Open Promote module" button | ✅ Done |
| `src/App.jsx` — /advisor/promote route added | ✅ Done |
| `src/components/Nav.jsx` — "📣 Promote" link in UserMenu for advisor/admin; desktop Promote NavTab now routes to /advisor/promote; mobile drawer Promote routes correctly | ✅ Done |
| `html2canvas@1.4.1` installed; Vite splits it as a separate 201KB chunk via dynamic import | ✅ Done |
| Vite build — 956 modules, 0 new errors | ✅ Done |

### Leaflet templates

| Layout constant | Description |
|---|---|
| `header_split` | Coloured top bar (logo + firm name), hero zone, content zone, footer (reg numbers + disclaimer) |
| `corner_badge` | Hero at top, floating firm identity badge positioned by `corner_position` field, content zone + footer |
| `footer_only` | Hero + content zone + coloured footer with "DISTRIBUTED BY ADVISOR / DISTRIBUTOR" label + logo + firm name + reg numbers |

All three templates share: `CTABlock` (card or strip style), 1080×1080px canvas, brand_colour_hex + brand_font from advisor_firm_profiles.

### Key design decisions

- **html2canvas dynamic import**: `await import('html2canvas')` in `handleDownload()` — keeps it out of the main bundle (201KB split chunk).
- **Canvas scale 2**: `html2canvas({ scale: 2 })` for retina-quality JPEG output at `quality: 0.92`.
- **MiniPreview (CSS-only)**: 160×100px visual representation of each template layout using just CSS and branding colours — no html2canvas at preview time.
- **Branding banner**: if `advisor_firm_profiles` returns no row, a warning banner links to /advisor/settings.
- **REGULATORY LANGUAGE**: all UI labels, template text, and code say "Advisor / Distributor" — never "Advisor" alone.
- **promo_messages fetch**: uses anon `supabase` client (public table); `advisor_firm_profiles` uses authenticated `createSupabaseClient(token)`.

### Supabase tables used

| Table | Client | Select |
|---|---|---|
| `promo_messages` | Anon | All columns WHERE is_active=true ORDER BY display_order ASC |
| `advisor_firm_profiles` | Auth | All columns WHERE advisor_id = uid .maybeSingle() |
| `promo_messages` (Dashboard) | Anon | category column only WHERE is_active=true (for promote_shortcut widget) |

---

## PH3-S2 — White-label Branding System ✅ (30 May 2026)

| Item | Status |
|---|---|
| `src/advisor/AdvisorSettings.jsx` — /advisor/settings with 4 tabs; Branding tab has 6 sections + 3-panel live preview | ✅ Done |
| `src/pages/PortfolioLens/F5SendReport.jsx` — advisor branding injected into print CSS, report header/footer | ✅ Done |
| `src/App.jsx` — /advisor/settings route added | ✅ Done |
| `src/components/Nav.jsx` — "⚙ Advisor Settings" link in user dropdown | ✅ Done |
| Vite build — 953 modules, 0 new errors | ✅ Done |

### Branding tab sections

| Section | Details |
|---|---|
| Firm Identity | firm_name (required), tagline (100-char counter), website_url, helpdesk_phone, helpdesk_email, registered_address |
| Logo Upload | Drag-drop or click; PNG/JPG/WEBP/SVG ≤ 2MB; uploads to `advisor-logos` Storage bucket as `[uid]_logo.[ext]` with upsert; thumbnail + Replace/Remove buttons when logo set |
| Brand Colour | HTML color picker + hex text input synced; live swatch; default #1A3C6E |
| Brand Font | Custom dropdown with 16 Google Fonts rendered in own face; single @import; Source Sans Pro mapped to Source Sans 3 in API |
| Registration Numbers | Repeatable rows; type/number/display_label/expiry_date; amber badge ≤90 days; red badge if expired; fmtDate() for all display |
| Disclaimer | 5-row textarea; char counter; shown in PDF footer |

### Live preview panels (update as you type, no save needed)

| Panel | Content |
|---|---|
| Nav bar mock | brand_colour_hex background, logo, firm_name in brand_font, 3 placeholder links |
| PDF header mock | 4px colour top strip, logo, firm_name (coloured), tagline, "Powered by FundLens" |
| PDF footer mock | 1px colour top strip, reg numbers · separated, disclaimer (2-line truncate), contact info |

### F5SendReport branding changes

- `buildPrintCSS(branding)` generates dynamic `@media print` block with brand colour on headings, borders, score circle; brand font as font-family
- `ReportHeader` — shows logo (max 48px height), firm_name in brand colour + font, tagline; "Powered by FundLens" replaces "fundlens.in" when advisor branding exists
- `ReportFooter` — reg numbers line, disclaimer line (2-line truncate), contact line; "Powered by FundLens" added
- Google Font `<link>` injected into document.head on mount when brand_font is set; Source Sans Pro → Source Sans 3 API mapping
- Individual users (role !== 'advisor'/'admin'): no Supabase fetch, FundLens defaults unchanged

### Supabase interaction

| Operation | Details |
|---|---|
| Fetch | `advisor_firm_profiles` .maybeSingle() via authenticated client; no error on empty row (PGRST116) |
| Save | `.upsert(payload, { onConflict: 'advisor_id' })` — inserts first row or updates existing |
| Logo upload | `storage.from('advisor-logos').upload(fileName, file, { upsert: true })` then `.getPublicUrl()` |
| Logo removal | `storage.from('advisor-logos').remove([fileName])` + null in logo_url payload |

---

## Nav Admin Link Fix ✅ (24 May 2026)

| Item | Status |
|---|---|
| `src/components/Nav.jsx` — 3 surgical edits: add `isAdmin` to `useRole()` destructure; add `isAdmin` prop to `UserMenu`; render "⚙ Admin Console" link in user dropdown when `isAdmin` is true | ✅ Done |
| `useRole.jsx` — already exports `isAdmin: effectiveRole === 'admin'`; no change needed | ✅ Confirmed |
| Vite build — 950 modules, no new errors | ✅ Done |

### Root cause
`useRole()` already exported `isAdmin` correctly, but `Nav.jsx` only destructured `{ isGuest, isAdvisor }` — `isAdmin` was never pulled out. The `UserMenu` component also never received `isAdmin` as a prop, so no Admin Console link was ever rendered. Three targeted edits (no full rewrite) fixed it.

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
- ✅ **`VITE_SUPABASE_ANON_KEY`** — added to Vercel env vars (24 May 2026)
- ✅ **`SUPABASE_SERVICE_KEY`** — added to Vercel env vars (24 May 2026)
- ✅ **`SUPABASE_SERVICE_ROLE_KEY`** — added to Vercel env vars (24 May 2026)

---

## PH4-S5 — Bug Fixes ✅ (31 May 2026)

| Item | Status |
|---|---|
| Fix 1: `CompareSchemes.jsx` — removed duplicate `border` key in P2P period pills and Year pills (build warning) | ✅ Done |
| Fix 2: `FDvsMF.jsx` line 531 — merged duplicate `style` props on tenure range input → `style={{ ...S.input, width:'100%', accentColor:'#a0522d' }}` (build warning) | ✅ Done |
| Fix 3: `SchemeMapping.jsx` — fixed AMC autocomplete fallback from `Object.values(amfiMap).flat()` → `[]`; wrong AMC schemes no longer bleed into other AMC dropdowns | ✅ Done |
| Fix 4: `CompareSchemes.jsx` `categorySlug()` — strip apostrophes before replacing non-alphanumeric; "Children's" now slugifies to `childrens` not `children_s` (also verified SchemeBasket.jsx `slugify()` was already correct) | ✅ Done |
| Fix 5: `SIPCalculator.jsx` — migrated `loadNavHistory` from `api.mfapi.in` to Supabase `nav_history` table (primary) with mfapi.in fallback; added `supabase` import | ✅ Done |
| Vite build — 960 modules, 0 errors, duplicate-key build warnings resolved | ✅ Done |

---

## Immediate Next Session Priorities

| Priority | Task |
|---|---|
| P0 | **Run migrations/004_registration.sql** in Supabase fundlens-prod SQL editor before testing PH3-S4/S5 |
| P0 | **Phase 3 + PH4-S5 complete** — Next: PH4-S6 Mobile responsive audit (375px, useWindowWidth() everywhere) |
| P0 | **Node.js 24 upgrade** ✅ DONE (30 May 2026) |
| P0 | **advisor_profiles RLS** ✅ DONE (migration 004 includes tightened policies) |
| P1 | **NAV REINDEX** — Run `REINDEX INDEX CONCURRENTLY nav_history_scheme_id_nav_date_idx;` in Supabase SQL editor to recover ~1–1.5 GB index bloat |
| P0 | **GitHub Actions secrets** — Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to FundLens repo secrets to activate daily_nav_sync cron |
| P1 | **PH1-S4** ✅ Done — daily_nav_sync.py replaces pipeline_cell1.py + pipeline_cell2.py (Gist pipeline retired) |
| P2 | **Test advisor_client_links** — Run manual test INSERT to verify ClientListWidget populates |

---

## Pending Manual Actions

| # | Action | Blocked by | Notes |
|---|---|---|---|
| 1 | ✅ Run `migrations/002_advisor_profiles.sql` in fundlens-prod | ~~Supabase IO timeout~~ | Done 24 May 2026 |
| 2 | ✅ Run `migrations/003_promo_messages.sql` in fundlens-prod | ~~Supabase IO timeout~~ | Done 24 May 2026; populate STATIC_PROMOS rows when content is ready |
| 3 | ✅ Vercel env vars (`VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) | ~~Missing~~ | All three set 24 May 2026 |
| 4 | Tighten `advisor_profiles` RLS policies (currently `USING true`) | Phase 3 scope | Do in PH3-S1 or PH3-S2 |
| 5 | Get DB password from Supabase dashboard → Settings → Database → Connection string, add `SUPABASE_DB_PASSWORD=<pw>` to FundInsight/.env | None | Required to run download_nav_local.py and reindex_nav.py |
| 6 | Run `python pipeline/download_nav_local.py` from FundInsight/ after adding SUPABASE_DB_PASSWORD | After #5 | ~45-90 min. Downloads 25M rows to FundInsight/data/nav_local/. Then run nav_gap_analysis.py. |
| 7 | Run `python pipeline/reindex_nav.py` from FundInsight/ (can run in parallel with download) | After #5 | ~20-60 min. REINDEX CONCURRENTLY all nav_history indexes. Recovers ~1–1.5 GB bloat. |
| 8 | Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to FundLens repo GitHub Actions secrets | None | Required to activate daily_nav_sync.yml cron (Mon–Fri 11:30PM IST) |

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

**Storage:** 12 GB autoscaled · ~6.3 GB used · Supabase key migrated to sb_secret format (legacy JWT disabled)
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
| `daily_nav_sync.py` | v1.0 | ✅ Live | Daily NAV → Supabase. Runs Mon–Fri 11:30PM IST via GitHub Actions. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY secrets. |
| `pipeline_cell1.py` | v4.3.1 | ⛔ Retired | Superseded by daily_nav_sync.py (31 May 2026). Raises SystemExit on import. |
| `pipeline_cell2.py` | v4.3.1 | ⛔ Retired | Superseded by daily_nav_sync.py (31 May 2026). Gist pipeline discontinued. |
| `db_connect.py` *(FI)* | v1.0 | ✅ Ready | FundInsight/pipeline/ — shared psycopg2 helper. Requires SUPABASE_DB_PASSWORD in .env. |
| `download_nav_local.py` *(FI)* | v1.0 | ⏳ Pending credentials | FundInsight/pipeline/ — downloads nav_history year-by-year to data/nav_local/. ~45-90 min full run. |
| `reindex_nav.py` *(FI)* | v1.0 | ⏳ Pending credentials | FundInsight/pipeline/ — REINDEX CONCURRENTLY all nav_history indexes. ~20-60 min. |
| `nav_gap_analysis.py` *(FI)* | v1.0 | ⏳ Needs local CSVs | FundInsight/pipeline/ — reads local CSVs, writes nav_gap_analysis.xlsx. Run after download. |

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
