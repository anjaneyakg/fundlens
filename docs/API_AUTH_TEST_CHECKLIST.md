# API Auth Hardening — Test Checklist

Branch: `api-auth-hardening` (commit af2e03e)  
Purpose: Verify that every protected API route rejects missing and forged tokens, and that legitimate callers still work after the RS256 changes.

> **Test data rule:** Tests marked ⚠️ write to the database. Use the suggested test record. Never use a real client or a real advisor application.

---

## Pre-flight

Before running any test:

- [ ] Deploy the `api-auth-hardening` branch to a Vercel **Preview** deployment.
- [ ] Confirm all required environment variables are set for **Preview** (not only Production) — see the list at the bottom of this file.
- [ ] Have three accounts ready:
  - `admin-test@…` — role `admin` in `profiles`
  - `advisor-test@…` — role `advisor` in `profiles`, a row in `advisor_profiles` with `status = 'approved'`
  - `client-test@…` — a fresh individual account with no `profiles` row yet (for the Register flow), **or** an existing individual with no existing client link (for the AcceptInvite flow)
- [ ] One pending advisor application must exist in `advisor_profiles` for the approve/reject tests. Use a throwaway record with `user_id` of a test Firebase account; do not use a real applicant.
- [ ] Open DevTools → Console and Network tabs before every negative test.

---

## Section 1 — Negative tests (no token, or forged token)

These tests do not require sign-in. Run them with a signed-out browser.

### 1.1 holdings-csv — rejected without token

- Role: any (route requires authentication)
- [ ] Sign out of FundLens.
- [ ] In the browser console, run:
  ```
  fetch('/api/holdings-csv').then(r=>r.json()).then(console.log)
  ```
- **Correct result:** HTTP `401`, body `{"ok":false,"error":"Authentication required"}`. No CSV returned.

### 1.2 admin get-users — rejected without token

- Role: admin required
- [ ] Sign out. In console:
  ```
  fetch('/api/admin?action=get-users').then(r=>r.json()).then(console.log)
  ```
- **Correct result:** HTTP `403`, body `{"error":"Admin access required"}`.

### 1.3 admin set-flag — rejected without token

- [ ] Sign out. In console:
  ```
  fetch('/api/admin?action=set-flag',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flag:'test',value:true})}).then(r=>r.json()).then(console.log)
  ```
- **Correct result:** HTTP `403`. No row in `feature_flags` changed.

### 1.4 admin set-flag — rejected with forged RS256 signature

- [ ] Sign out. In console:
  ```
  const t='eyJhbGciOiJSUzI1NiIsImtpZCI6ImZha2UifQ.eyJzdWIiOiJhZG1pbi11aWQiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vZnVuZGxlbnMtcHJvZCIsImF1ZCI6ImZ1bmRsZW5zLXByb2QiLCJleHAiOjk5OTk5OTk5OTl9.AAAFAKE';
  fetch('/api/admin?action=set-flag',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({flag:'test',value:true})}).then(r=>r.json()).then(console.log)
  ```
- **Correct result:** HTTP `403`. `jose` must reject the token because the `kid` does not match any Google JWKS key. This is the core regression this branch fixes.

### 1.5 amfi write — rejected without token

- [ ] Sign out. In console:
  ```
  fetch('/api/amfi?action=scheme-code-map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mapping:{}})}).then(r=>r.json()).then(console.log)
  ```
- **Correct result:** HTTP `403`.

### 1.6 cell-c run-reconciler — rejected without token

- [ ] Sign out. In console:
  ```
  fetch('/api/cell-c?action=run-reconciler',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})}).then(r=>r.json()).then(console.log)
  ```
- **Correct result:** HTTP `403`.

### 1.7 advisor create-invite — rejected without token

- [ ] Sign out. In console:
  ```
  fetch('/api/advisor?action=create-invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_label:'Test'})}).then(r=>r.json()).then(console.log)
  ```
- **Correct result:** HTTP `403`.

### 1.8 advisor create-invite — rejected for individual (non-advisor) role

- [ ] Sign in as `client-test@…` (individual role).
- [ ] In console:
  ```
  const {getIdToken}=await import('https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js');
  ```
  *(Or open the page and use the token from the app.)* Alternatively, navigate to `/advisor/clients/invite` — `ProtectedRoute` should redirect away before reaching the API.
- **Correct result:** `ProtectedRoute` redirects to `/` or `/login`. If the API is called directly with an individual-role token, it returns HTTP `403`.

---

## Section 2 — Admin (positive tests)

Sign in as `admin-test@…` before these tests.

### 2.1 View users

- [ ] Open `/admin/users`.
- **Correct result:** User list loads, total count shown. No 403 in the Network tab.

### 2.2 Change a user's role ⚠️

> Use `client-test@…` as the target. Revert after the test.

- [ ] On `/admin/users`, find `client-test@…`. Change the role dropdown to `advisor`.
- **Correct result:** Toast "Role updated → advisor". Refresh — dropdown still shows `advisor`.
- [ ] Change it back to `individual`.
- **Correct result:** Toast "Role updated → individual". Row reverted.

### 2.3 Toggle a feature flag ⚠️

> Use `client-test@…` as the target. Revert after the test.

- [ ] Open `/admin/tools` (Tool Access Matrix).
- [ ] Toggle any feature flag for `client-test@…`.
- **Correct result:** Toggle saves without a 403.
- [ ] Toggle it back.
- **Correct result:** Reverted. No error.

### 2.4 Approve an advisor application ⚠️

> Use the throwaway pending application created in pre-flight.

- [ ] Open `/admin/advisor-applications`.
- [ ] Click **Approve** on the throwaway application.
- **Correct result:** Row disappears from the list. In Supabase: `advisor_profiles.status = 'approved'` and `profiles.role = 'advisor'` for that UID.

### 2.5 Reject an advisor application ⚠️

> Create a second throwaway pending application if only one was prepared.

- [ ] On `/admin/advisor-applications`, click **Reject** on the throwaway application.
- [ ] Enter any rejection reason and click **Confirm Reject**.
- **Correct result:** Row disappears. In Supabase: `advisor_profiles.status = 'rejected'` with the reason stored.

### 2.6 Market cap upload ⚠️

> Use a small valid market cap CSV (a few rows is enough).

- [ ] Open `/admin/market-cap`.
- [ ] Select the test CSV and click **Upload**.
- **Correct result:** Success message. No 403 in Network tab. `marketcap` table updated.

### 2.7 Scheme mapping — save ⚠️

> Make a trivial, reversible edit (e.g. map a code to the same scheme it already maps to).

- [ ] Open `/admin/scheme-mapping`. Select any AMC.
- [ ] Edit one scheme code mapping. Click **Save Mappings**.
- **Correct result:** Toast "✓ Saved — N mappings to Supabase". No 403.
- [ ] Revert the mapping and save again.

### 2.8 Scheme mapping — accept a proposal ⚠️

> Fuzzy-match proposals are read-only to generate; accepting them writes to `scheme_code_map`.

- [ ] On `/admin/scheme-mapping`, find a row with a fuzzy-match proposal badge. Click **Accept**.
- **Correct result:** Toast "✓ Proposal accepted". Row changes status in the UI. No 403.

### 2.9 Scheme mapping — reject a proposal ⚠️

- [ ] Click **Reject** on a different fuzzy-match proposal.
- **Correct result:** Toast "Proposal rejected — code reverted to unmapped". No 403.

### 2.10 Portfolio upload (CoverageDashboard) ⚠️

> Upload a small sample holdings CSV.

- [ ] Open `/portfolio` (Coverage Dashboard).
- [ ] Upload a holdings CSV via the upload button.
- **Correct result:** Holdings table populates. `/api/holdings-csv` returns `200 text/plain` (not `401 JSON`). No errors in console.

---

## Section 3 — Advisor (positive tests)

Sign in as `advisor-test@…` before these tests.

### 3.1 Create an invite link ⚠️

> This writes a row to `advisor_invites`. Note the invite URL — you will need it for Section 4.

- [ ] Open `/advisor/clients/invite`.
- [ ] Enter a client label, e.g. `"Test Client — auth hardening"`. Click **Generate Invite Link**.
- **Correct result:** An invite URL appears (format: `/accept-invite?token=…`). The new invite also appears in the Recent Invites list with status `invited`. No 403.
- [ ] **Copy the invite URL** for use in Section 4.

### 3.2 Add a placeholder client ⚠️

> Writes a row to `advisor_clients` with `status = 'placeholder'`.

- [ ] On `/advisor/clients/invite`, scroll to the **Add without invite** section.
- [ ] Enter label `"Placeholder — auth hardening test"`. Click **Add Client**.
- **Correct result:** Success message. Row appears in Recent list with status `Placeholder`. No 403.

### 3.3 Advisor clients list loads

- [ ] Open `/advisor/clients`.
- **Correct result:** Client list loads (fetched via Supabase directly). The placeholder from 3.2 appears. No errors.

---

## Section 4 — Client (invite acceptance)

Use a fresh incognito / private window for this section.

### 4.1 accept-invite rejected without token

- [ ] In the incognito window, open DevTools → Console. Run:
  ```
  fetch('/api/advisor?action=accept-invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite_token:'fake-token-000'})}).then(r=>r.json()).then(console.log)
  ```
- **Correct result:** HTTP `403`. No row written to `advisor_clients`.

### 4.2 Invite landing card — not logged in

- [ ] In the incognito window, open the invite URL from Section 3.1.
- **Correct result:** Page shows a card with the advisor's name and two buttons: **Create account** and **Sign in**. No error, no blank screen.

### 4.3 Accept via Register (new user) ⚠️

> This creates a real `profiles` row and an `advisor_clients` row. Use a throwaway email address.

- [ ] Click **Create account** on the invite landing card.
- [ ] Complete the registration wizard as an individual user with the throwaway email.
- **Correct result:** Wizard shows a success screen. In Supabase: `advisor_clients` has a row linking the new UID to `advisor-test`'s UID, `status = 'active'`. `notify-registration` fires without a 403 (check Vercel function logs: look for no error on the `notify-registration` invocation).

### 4.4 Accept via AcceptInvite page (existing user) ⚠️

> Requires a second invite URL (generate another one from Section 3.1 with a different label).

- [ ] Sign in as `client-test@…` in a private window (this account must already have a `profiles` row).
- [ ] Open the second invite URL.
- **Correct result:** Page auto-calls `accept-invite`, then shows a success card ("You're all set"). New `advisor_clients` row in Supabase. No 403.

### 4.5 Advisor sees the linked client

- [ ] Switch back to the advisor account. Open `/advisor/clients`.
- **Correct result:** The client from 4.3 or 4.4 appears with status `active`.

---

## Environment variables required for Vercel Preview

The following must be set under **Preview** (not only Production) in Vercel → Project Settings → Environment Variables:

**Server-side (serverless functions — not exposed to the browser):**

| Variable | Used by |
|---|---|
| `SUPABASE_URL` | `verifyFirebaseToken.js`, `admin.js`, `advisor.js`, `amfi.js`, `cell-c.js`, `github-upload.js` |
| `SUPABASE_SERVICE_KEY` | same (also accepts `SUPABASE_SERVICE_ROLE_KEY` as a fallback) |
| `SUPABASE_ANON_KEY` | `market-gauge.js` |
| `GITHUB_PAT` | `holdings-csv.js`, `github-upload.js` |

**Client-side (baked into the Vite bundle at build time — must be set before the build runs):**

| Variable | Used by |
|---|---|
| `VITE_FIREBASE_API_KEY` | `src/firebase.js` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `src/firebase.js` |
| `VITE_FIREBASE_PROJECT_ID` | `src/firebase.js` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `src/firebase.js` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `src/firebase.js` |
| `VITE_FIREBASE_APP_ID` | `src/firebase.js` |
| `VITE_SUPABASE_URL` | `src/lib/supabaseClient.js`, `src/hooks/useAuth.jsx`, others |
| `VITE_SUPABASE_ANON_KEY` | same |

`VITE_` variables are baked into `dist/` at build time. If any are missing when Vercel builds the preview, the frontend will boot with `undefined` values and Firebase/Supabase calls will fail before a token is even acquired.
