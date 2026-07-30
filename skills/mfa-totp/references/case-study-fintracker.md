# Case study: MFA / approval auth in FinTracker

The pattern as built in a real Expo app (iOS/Android/web) on Supabase. File:line
references are to the FinTracker repo. The whole auth flow lives as a cascade of
early returns in one root component, each backed by a database-enforced twin.

## The gate cascade — `app/App.tsx`

State lives at the top of the `App` component (`app/App.tsx:30-77`); the render
cascade is the sequence of early returns (`app/App.tsx:88-176`).

**Gate 0 — session bootstrap** (`app/App.tsx:37-41`): `getSession()` seeds the
initial `session` state and `onAuthStateChange` keeps it live across login,
logout, and token refresh. `active = !!session || sampleMode` (`:80`); if not
active → `<Login/>` (`:88-95`). A `?demo` query param sets a read-only sample
mode (`:8-11`).

**Gate 1 — MFA / AAL2 step-up** (`app/App.tsx:49-59`): a `useEffect` calls
`mfa.getAuthenticatorAssuranceLevel()` and sets `needsMfa` exactly when
`currentLevel === 'aal1' && nextLevel === 'aal2'` — the canonical "account has a
verified TOTP factor but this session hasn't satisfied it" signal. Render:
`session && needsMfa` → `<MfaChallenge onVerified={() => setNeedsMfa(false)} />`
(`:97-104`). `onVerified` only flips the local flag; the real AAL2 upgrade already
happened server-side inside the challenge.

**Gate 2 — admin approval** (`app/App.tsx:63-77`): queries
`profiles.select('status,role')` for the current user; sets `approval` to
`approved`/`pending` and `isAdmin` from the role. Render: `session &&
approval === 'pending'` → `<PendingApproval onRecheck={...} />` (`:106-113`),
where re-check is a nonce bump that re-runs the effect (manual poll, no realtime
subscription). Graceful default: if the `profiles` table is absent (pre-migration
DB), treat as approved.

**Gate 3 — the app** (`app/App.tsx:115-176`): wrapped in a `SafeAreaView` whose
`onStartShouldSetResponderCapture` feeds every native touch into the idle-logout
`touch()` (`:118-121`). `isAdmin` is threaded into `<Settings>` to conditionally
render the admin panel (`:164-172`).

Ordering is deliberate: **MFA before approval**, and every gate depends on
`session`, so a logout collapses the whole cascade back to `<Login/>`.

## First factor — `app/screens/Login.tsx`

Passwordless, two-step email OTP: `signInWithOtp({ email })` (`:32-38`) then
`verifyOtp({ email, token, type: 'email' })` (`:40-45`). No passwords anywhere.
The screen also renders the idle-logout notice banner (`:80-84`).

## TOTP enrollment — `app/screens/Settings.tsx`

`MfaSection` (`:151-280`) is a small state machine —
`MfaPhase = loading | off | enrolling | on` (`:145-149`):

- **status** (`refresh`, `:156-161`): `mfa.listFactors()`; a factor in
  `data.totp[0]` means enrolled-and-verified (`.totp` holds verified factors
  only — see the primitives reference).
- **enroll** (`startEnroll`, `:165-195`): first garbage-collect abandoned
  half-enrollments by scanning `.all` for `factor_type==='totp' &&
  status==='unverified'` and `mfa.unenroll`-ing each (`:170-175`) — Supabase
  rejects a new enroll while an unverified one exists. Then
  `mfa.enroll({ factorType: 'totp', friendlyName })` (`:176`) returns
  `data.totp.qr_code` (an SVG data-URI, URL-decoded and rendered via
  `react-native-svg`'s `<SvgXml>`, `:245-249`) and `data.totp.secret` (shown as
  selectable text fallback, `:250`).
- **confirm** (`confirmEnroll`, `:197-213`): `mfa.challengeAndVerify({ factorId,
  code })` (`:201`) — challenge + verify in one call → `phase: 'on'`.
- **disable** (`:215-222`): `mfa.unenroll({ factorId })`.

## AAL2 challenge — `app/screens/MfaChallenge.tsx`

Looks up the verified factor from `listFactors().totp[0]` (`:19`), then
`mfa.challengeAndVerify({ factorId, code })` (`:23`) upgrades the session to
AAL2 server-side; `onVerified()` clears the gate. Offers `signOut()` as an escape
(`:60`).

## Idle logout — `app/lib/useIdleLogout.ts`

20-minute inactivity sign-out (`IDLE_LOGOUT_MS`, `:7`), enabled only while a
session exists (`useIdleLogout(!!session, ...)` at `app/App.tsx:45`):

- Tracks `last = useRef(Date.now())` with a `fired` ref to prevent double-fire
  (`:14-15`, `:24`).
- **Resets** on real input: web listens to `pointerdown/keydown/wheel/touchstart/
  mousemove` on `window` (`:35-36`); native uses the root view's touch-capture
  calling the returned `touch()` (`:52-53`, wired at `App.tsx:120`).
- **Two independent checkers:** a `setInterval(check, 30_000)` (`:41`) **and** an
  `AppState` `change→active` listener (`:38-40`, `:29-31`) so time spent
  backgrounded counts as idle. Both funnel through the `fired` guard because they
  can race.
- **Expiry** (`:25-28`): `supabase.auth.signOut()` then `onTimeout()`, which sets
  the inline "signed out after 20 minutes" notice on `<Login>` (no popup).
- Exists because Supabase `autoRefreshToken` would otherwise keep the JWT alive
  forever on an open tab (`:5-6`).

## The client — `app/lib/supabase.ts`

One shared client (`:9-16`): anon key + RLS (so the client can only ever see the
signed-in user's rows, `:8`), `AsyncStorage` for `persistSession` (works web +
native), `autoRefreshToken: true`, `detectSessionInUrl: false` (auth is OTP, not
magic-link). Config from build-time `EXPO_PUBLIC_*` env vars (`:5-6`). Also
exports a sanitized `WORKER_URL` (`:20-27`).

## Server-side twins — `worker/app/db.py`

The worker holds the service-role key, so RLS is bypassed and it must check
everything explicitly:
- `get_user_id(authorization)` (`:21-33`): parses the `Bearer` token and resolves
  it via `auth.get_user(token)` — verifies the app's JWT on every request.
- `require_approved(user_id)` (`:36-44`): reads `profiles.status`, raises if not
  `approved` — the server twin of the `is_approved()` RLS predicate. Both degrade
  gracefully if `profiles` is absent.

## Approval gate — `supabase/migrations/0004_approvals.sql`

The full mechanism is in `references/approval-gate.md`; in this app it's a
`profiles` table, `is_approved()`/`is_admin()` SECURITY DEFINER predicates, an
`on_auth_user_created` trigger that provisions each signup (auto-approving one
seeded admin email, everyone else `pending`), and a rewrite of every data table's
RLS policy to `user_id = auth.uid() and is_approved()`. The admin panel
(`Settings.tsx:88-141`, gated by `isAdmin`) is just a mirror that updates
`profiles.status`. A pending user POSTs once to the worker `/signup-notice` so the
admin gets an email (`app/screens/PendingApproval.tsx`), with failure swallowed
because the admin panel lists the request anyway.

## The lesson to carry over

Nothing here trusts the client. Each React gate is a convenience over a
database-enforced rule — AAL on the session, `is_approved()` in every policy,
JWT verification + approval re-check in the worker. That's what makes it safe to
ship the whole client as open source with only the anon key.
