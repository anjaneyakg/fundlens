# FundLens — Platform State (Design, Auth & Frontend Track)

**Owner:** Claude.ai (this session type)
**Last updated:** 24 May 2026 (PL-16 / F5 Send Report — Phase 2 complete)
**Companion file:** `CURRENT_STATE.md` — pipeline, data, Supabase, scripts

> At session start: fetch BOTH files from GitHub before doing anything.
> At session close: update this file and push to Git before ending.

---

## Architecture Decisions — Frozen

Do not revisit without explicit sign-off.

| Decision | Detail |
|---|---|
| **Auth** | Google Firebase Authentication. JWT passed to Supabase RLS. Free up to 50K MAU. Phone OTP for Indian users. Cost: ₹0 up to 50K MAU, then ~$0.0055/MAU. |
| **Frontend** | React + Vite + Vercel. No TypeScript. JSX only. vercel.json is fragile — read before touching. |
| **Navigation** | Plan \| Research \| Track \| Save & Invest \| Promote (advisor-only). Replaces A-D tool codes. |
| **Design** | FundLens v3 — long-page Apple-style. Approved 08 May 2026. |
| **Branding** | Platform branding only. No individual name anywhere on site or documents. |
| **Data sources** | AMFI direct only. No third-party MF data APIs. |
| **User roles** | Guest (pre-login, Plan only) \| Individual (Plan + Research + Track) \| Advisor/IFA (all + Promote + multi-client + white-label) |
| **DPDP** | Files parsed browser-side. PAN/name never sent to server. Folio numbers SHA-256 hashed. Explicit consent gate. Delete-all mandatory. |
| **Theming** | CSS custom properties in `src/theme.css`. White-label via `useAdvisorTheme` hook — injects `<style id="advisor-theme">` with sanitised hex overrides for `--color-primary` and `--color-primary-dark` only. Advisor logo in `advisor_profiles.logo_url`. Dark mode: system `@media (prefers-color-scheme: dark)` only — no JS toggle. |
| **SaaS** | Firebase Auth + Supabase RLS = clean multi-tenancy. Advisor white-label via per-advisor CSS + logo. Razorpay for billing (Phase 5). |

---

## Go-Live Plan — 5 Phases, Target August 2026

Full detail: `FundLens_GoLive_Plan_v1.docx` in repo.

### Phase 0 — Foundation & Design (Weeks 1–2)

| Session | Deliverable | Status |
|---|---|---|
| PH0-S1 | `bb220e0` — firebase.js, useAuth.jsx, supabaseClient.js, Login.jsx, ProtectedRoute.jsx; Supabase Third-Party Auth wired | ✅ Done — 09 May 2026 |
| PH0-S2 | `c89ddac` — useRole.jsx, advisor_profiles migration, UserManager rewrite, api/get-users.js, api/set-role.js, Upgrade.jsx, ProtectedRoute tier gates | ✅ Done — 09 May 2026 |
| PH0-S3 | `a28d312` — Nav.jsx full rewrite, Plan/Research/Track/Save & Invest/Promote, mobile drawer, AdvisorModeContext.jsx | ✅ Done — 09 May 2026 |
| PH0-S4 | `fc9a1db` — Home.jsx v3, carousel, hero toggle, feature sections, advisor strip, footer, migrations/003 | ✅ Done — 09 May 2026 |
| PH0-S5 | `5543556` — theme.css, useAdvisorTheme.jsx, index.css, logo swap, CSS vars audit on Nav/Home/Login/Upgrade | ✅ Done — 09 May 2026 |
| API fix | `6895c38` — 14 → 5 serverless functions; api/amfi.js (4 actions), api/admin.js (4 actions); dead auth fns deleted; CORS tightened | ✅ Done — 09 May 2026 |

### Phase 1 — Data Foundation (Weeks 2–3, parallel with Phase 0)

| Session | Deliverable | Status |
|---|---|---|
| PH1-S1 | 30-year NAV backfill | ⏳ Pending |
| PH1-S2 | Fix AMC parsers (Union, Zerodha, Shriram, Mahindra) | ⏳ Pending |
| PH1-S3 | Canara Robeco + stragglers | ⏳ Pending |
| PH1-S4 | Pipeline Cell 1 rebuild (today-only NAV fetch) | ⏳ Pending |
| PH1-S5 | Security S1+S2+S3 — GIST_PAT renewal ⚠ DEADLINE ~20 May | ✅ Done — 09 May 2026 |

### Phase 2 — PortfolioLens Core (Weeks 3–7)

| Session | Deliverable | Status |
|---|---|---|
| PH2-S1 | PL shell + F6 Data manager (DPDP consent, localStorage schema) | ✅ Done |
| PH2-S2 | Parser engine (CAMS + KFin + Holdings, portfolioEngine.js, XIRR) | ✅ Done |
| PH2-S3 | E1 Dashboard | ✅ Done |
| PH2-S4 | E2 Visual overview | ✅ Done |
| PH2-S5 | E3 Holdings & exposure | ✅ Done |
| PH2-S6 | E4 Overlap analysis | ✅ Done |
| PH2-S7 | E5 Performance matrix | ✅ Done |
| PH2-S8 | E6 + E7 + E8 (Cashflow, Capital gains, Transaction report) | ✅ Done |
| PH2-S9 | F1 Health check (8-rule engine) | ✅ Done — 24 May 2026 |
| PH2-S10 | F2–F5 (Alerts, Rebalance, Model portfolio, PDF report) | ✅ Done — 24 May 2026 (F2 ✅ F3 ✅ F4 ✅ F5 ✅) |

### Phase 3 — Advisor Layer (Weeks 7–9)

| Session | Deliverable | Status |
|---|---|---|
| PH3-S1 | Multi-client dashboard | ⏳ Pending |
| PH3-S2 | White-label system (logo + firm name on nav, PDFs, emails) | ⏳ Pending |
| PH3-S3 | Promote module (leaflets, email drafts, WhatsApp templates) | ⏳ Pending |
| PH3-S4 | Advisor onboarding flow | ⏳ Pending |
| PH3-S5 | Client invitation flow | ⏳ Pending |

### Phase 4 — Polish & Pre-launch (Weeks 9–11)

| Session | Deliverable | Status |
|---|---|---|
| PH4-S1 | Online assistant — pre-login | ⏳ Pending |
| PH4-S2 | Online assistant — post-login | ⏳ Pending |
| PH4-S3 | Admin module upgrades (carousel mgmt, role mgmt, advisor approval) | ⏳ Pending |
| PH4-S4 | Node.js 24 upgrade ⚠ DEADLINE June 2026 | ⚠ Urgent |
| PH4-S5 | Bug fixes (SchemeMapping autocomplete, SchemeBasket slug, SIPCalculator) | ⏳ Pending |
| PH4-S6 | Mobile responsive audit (375px, useWindowWidth() everywhere) | ⏳ Pending |
| PH4-S7 | Performance & SEO (lazy loading, code splitting, meta tags, sitemap) | ⏳ Pending |

### Phase 5 — Monetisation & Go-Live (Weeks 11–13)

| Session | Deliverable | Status |
|---|---|---|
| PH5-S1 | Subscription tiers design + pricing page | ⏳ Pending |
| PH5-S2 | Razorpay billing integration | ⏳ Pending |
| PH5-S3 | GIST_PAT final renewal | ⏳ Pending |
| PH5-S4 | UAT — investor flows (10 test users) | ⏳ Pending |
| PH5-S5 | UAT — advisor flows (3 test advisors) | ⏳ Pending |
| PH5-S6 | Go-live — DNS to fundlens.in, prod env vars, monitoring | ⏳ Pending |

---

## Homepage Design — v3 Approved

### What's approved
- Long-page Apple-style. Large vertical padding between sections. No crowding.
- **Sticky nav** always visible on scroll: Logo | tool nav | Investor/Advisor toggle | Sign in | Get started
- **Online assistant button** — always visible on scroll (pre and post login). Planned for Phase 4.
- **Investor/Advisor toggle** — refined pill with icons (not raw buttons). Switches entire hero + shows/hides Promote tab.
- **Carousel/promo banner** — below nav, auto-scrolls every 4s, dot navigation, admin-controlled (text + image). Managed via `promo_messages` Supabase table.
- **Hero** — centered, large headline, switches content when Advisor mode selected. No data counts on homepage.
- **Data indicators strip** — plain language only: "Rich NAV history" | "Updated monthly scheme portfolios" | "Latest market index values"
- **Feature sections** — Plan / Research / Track, alternating layout, each with live preview panel
- **IFD/MFD vs RIA strip** — separate segment with distinct messaging, CTAs, colour treatment (green for MFD, blue for RIA)
- **Save & Invest** — in nav, marked "coming soon"
- **Promote** — advisor-only, hidden in investor mode
- **Footer** — platform branding only, data sources as disclaimers

### Navigation structure (final)
```
Plan | Research | Track | Save & Invest | [Promote — advisor only]
```
- Plan: calculators, projections (free, pre-login)
- Research: fund explorer, overlap, risk ratios, NAV charts (registered)
- Track: PortfolioLens health check, alerts, capital gains, rebalance (registered)
- Save & Invest: future transaction capability (coming soon)
- Promote: co-branded leaflets, email drafts, WhatsApp templates (advisor only)

---

## Firebase Auth — Integration Design

### Flow
1. Firebase Auth issues JWT on login (email/password or phone OTP)
2. React app holds JWT in memory (never localStorage)
3. Every Supabase query passes JWT in `Authorization` header
4. Supabase RLS verifies JWT using Firebase's public key (one-time config in Supabase dashboard)
5. RLS policies use `auth.uid()` — each user sees only their own data

### Supabase Tables — Live & Pending

| Table | Status | Migration | Notes |
|---|---|---|---|
| `profiles` | ✅ RLS live | `migrations/001_users_table.sql` | id TEXT (Firebase UID), email, role, plan_tier; RLS on SELECT/INSERT/UPDATE by sub claim |
| `advisor_profiles` | ⚠ Pending run | `migrations/002_advisor_profiles.sql` | user_id → profiles.id; logo_url, css_override, max_clients; admin RLS policies |
| `promo_messages` | ⚠ Pending run | `migrations/003_promo_messages.sql` | id UUID, text, is_active, display_order; public RLS read policy |

```sql
-- profiles (Firebase UID as primary key) — RLS live in fundlens-prod
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,           -- Firebase UID
  email TEXT,
  role TEXT DEFAULT 'individual', -- 'guest' | 'individual' | 'advisor' | 'admin'
  plan_tier TEXT DEFAULT 'free',  -- 'free' | 'individual' | 'advisor_mfd' | 'advisor_ria'
  created_at TIMESTAMP DEFAULT now()
);

-- advisor_profiles — migration written, pending run (002)
CREATE TABLE advisor_profiles (
  user_id TEXT PRIMARY KEY REFERENCES profiles(id),
  firm_name TEXT,
  logo_url TEXT,
  css_override TEXT,
  approved_at TIMESTAMP,
  max_clients INTEGER DEFAULT 50
);

-- promo_messages — migration written, pending run (003)
CREATE TABLE promo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT now()
);
```

### Firebase Auth cost
| MAU | Monthly cost |
|---|---|
| 0–50,000 | ₹0 (free tier) |
| 50K–100K | ~₹4,600/mo |
| 100K+ | ~$0.0055/MAU linear |
| Phone OTP (India) | ~₹0.08/SMS |

---

## PortfolioLens — Scope Summary

**Menu E — Analysis:** E1 Dashboard · E2 Visual overview · E3 Holdings & exposure · E4 Overlap analysis · E5 Performance matrix · E6 Cashflow & returns · E7 Capital gains · E8 Transaction report

**Menu F — Health:** F1 Health check (8-rule engine) · F2 Alerts · F3 Rebalance planner · F4 Model portfolio · F5 Send report · F6 Data manager

**Data sources:** CAMS transaction export · KFin transaction export · CAMS current valuation snapshot
**Storage:** localStorage now → Supabase migration in later phase (re-consent required)
**DPDP:** PAN/name local only · folio numbers SHA-256 hashed · explicit consent gate · delete-all button

Full spec: `FundLens_Master_Reference_v23.docx`

---

## Pricing Tiers (to validate in Phase 5)

| Tier | Who | Suggested price |
|---|---|---|
| Guest | Any visitor | Free, no registration |
| Individual | Retail investor | ₹199/mo or ₹1,799/yr |
| Advisor — MFD/IFD | Distributor, up to 50 clients | ₹999/mo or ₹8,999/yr |
| Advisor — RIA | SEBI RIA, unlimited clients | ₹2,499/mo or ₹21,999/yr |

---

## Platform Open Issues

| # | Issue | Detail | Status |
|---|---|---|---|
| 1 | Firebase + Supabase JWT wiring | Third-Party Auth configured in Supabase dashboard. | ✅ Complete |
| 2 | Supabase RLS policies | profiles table RLS live. advisor_profiles migration pending (002). | ⚠ 002 pending |
| 3 | SchemeMapping autocomplete | Axis and others showing wrong AMC schemes in dropdown. | ⚠ Pending |
| 4 | SchemeBasket slug bug | "Children's" → children_s not childrens | ⚠ Pending |
| 5 | SIPCalculator mfapi migration | Migrate away from api.mfapi.in | ⚠ Pending |
| 6 | Online assistant scope | Pre-login: promotional/helpful. Post-login individual: portfolio Q&A. Post-login advisor: premium. | 🔲 Phase 4 |

---

## Mandatory Coding Rules — Frontend (Never Deviate)

| Rule | Detail |
|---|---|
| No TypeScript | JSX only, no .tsx files |
| Dates | All dates via `fmtDate()` — never `toLocaleDateString()` or `toISOString()` |
| Dark themes | No dark themes. System-default dark mode via CSS only. |
| Rewrites | Full file rewrites — never incremental find-and-replace |
| vercel.json | Read before touching — has broken deployment twice |
| service_role | Never in any frontend file or VITE_ env var |
| Currency | `toLocaleString('en-IN')` with ₹ prefix |
| Responsive | `useWindowWidth()` hook for all responsive behaviour |
| Error handling | No silent `catch(()=>{})` — always `console.error` with context |
| AMC identity | `amc_map.json` is source of truth — never guess from filename |
| Date arithmetic | `localDateStr()` / `parseLocalDate()` — never `toISOString()` |
| CORS | Restrict `Allow-Origin` to `fundlens-six.vercel.app` — never wildcard `*` (except market-gauge.js) |

---

## Key Coordinates

| Item | Value |
|---|---|
| FundLens repo | github.com/anjaneyakg/fundlens (PUBLIC) |
| Live URL | fundlens-six.vercel.app / fundlens.in |
| Stack | React + Vite + Vercel |
| VITE_GITHUB_PAT | Renewed Apr 2026 in Vercel |
| GIST_PAT | ✅ Renewed 09 May 2026 |
| Health endpoint | https://fundlens-six.vercel.app/api/v1/health |
