---
name: mfa-totp
description: >-
  Build finance-grade auth on Supabase — passwordless email-OTP login, optional
  TOTP second factor with an AAL2 step-up gate, an admin-approval gate that locks
  new signups out of all data until approved, and a short idle-logout session
  lifetime. The load-bearing idea: UI gates are UX, the real locks live in the
  database (Supabase AAL enforcement + an is_approved() predicate compiled into
  every RLS policy), each with a server-side twin. Use when adding sign-in, MFA,
  or an approval workflow to any Supabase-backed app (web, React Native/Expo,
  mobile). Covers the gate cascade, the exact Supabase MFA primitives and their
  gotchas, and the SQL for the approval gate.
---

# Supabase MFA / TOTP + Approval Gate

A portable pattern for auth that has to actually protect data, not just gate a
UI. Extracted from FinTracker (a finance app shipping to iOS/Android/web via
Expo); the concrete implementation with file:line references is in
`references/case-study-fintracker.md`.

## The one invariant — UI gates are UX, not security

Every gate in this pattern exists twice: once as a React early-return (so the
user sees the right screen), and once as a database-enforced rule (so the data is
actually protected). **Delete all the React and the data is still safe.** The
real locks are:

- **Supabase AAL enforcement** — a session that hasn't satisfied a verified TOTP
  factor is `aal1`; Supabase knows the account *should* be `aal2`. The client
  reads this to decide whether to show the challenge, but the assurance level is
  server state, not a React flag.
- **`is_approved()` compiled into RLS** — every table policy requires
  `user_id = auth.uid() AND is_approved()`. An unapproved user is authenticated
  but reads zero rows and can write nothing, even via direct API calls that never
  touch your UI.
- **Server-side twins** — any backend that uses a service-role key (bypassing
  RLS) must re-check ownership and approval explicitly, because RLS won't do it
  for the service role.

Hold this invariant when porting: if a gate exists only in the client, it isn't a
security control, it's a suggestion.

## The building blocks (Supabase primitives)

- **First factor:** passwordless email OTP — `signInWithOtp({ email })` then
  `verifyOtp({ email, token, type: 'email' })`. No passwords stored anywhere.
- **Second factor:** TOTP MFA — `mfa.enroll` (returns a QR + secret),
  `mfa.challengeAndVerify` (confirm a code), `mfa.listFactors`, `mfa.unenroll`.
- **Step-up detection:** `mfa.getAuthenticatorAssuranceLevel()` → challenge when
  `currentLevel === 'aal1' && nextLevel === 'aal2'`.
- **Approval + roles:** a `profiles` table plus `is_approved()` / `is_admin()`
  SECURITY DEFINER predicates, auto-provisioned by an `on_auth_user_created`
  trigger.

The exact call shapes and the gotchas that cost real debugging time are in
`references/supabase-primitives.md`. The approval-gate SQL is in
`references/approval-gate.md`.

## The gate cascade (client shape)

Model the whole auth flow as an **ordered list of early returns in one root
component**, each guarded by a boolean that a `useEffect` populates from a
Supabase call. Order matters:

```
session?          — getSession() + onAuthStateChange   → no  → <Login/>
needs AAL2?        — getAuthenticatorAssuranceLevel()   → yes → <MfaChallenge/>
approved?          — select status from profiles        → no  → <PendingApproval/>
otherwise                                                      → <App/>
```

Key properties to preserve:
- **All gates depend on `session`.** A logout collapses the whole cascade back to
  `<Login/>` in one step.
- **MFA is checked before approval** — an unapproved user still clears TOTP first.
- **Advancement is local, the upgrade is remote.** When the challenge succeeds,
  the client just flips a flag — the real AAL2 upgrade already happened
  server-side inside `challengeAndVerify`.
- **Graceful degradation.** If the `profiles` table doesn't exist yet (pre-
  migration), treat the user as approved so the app still runs.

## Idle logout — session lifetime Supabase won't enforce for you

Supabase `autoRefreshToken` keeps a JWT alive indefinitely on an open tab — fine
for a to-do app, wrong for finance. Add a small hook that signs out after N
minutes of inactivity:

- Track last-activity; reset it on real user input (pointer/key/touch events on
  web, the root view's touch-capture on native).
- Two independent checkers: a periodic timer, **and** an app-foreground listener
  so time spent backgrounded counts as idle. Guard against the two racing.
- On expiry: `signOut()` + a callback that surfaces an inline "signed out"
  notice (no popup).

## Mobile biometric lock — a platform-split session policy

On a phone, "sign out after 20 minutes" is the wrong UX — people expect a finance
app to *stay signed in* and re-open with a fingerprint. Split the policy by
platform:

- **Web** keeps the idle sign-out (above) + MFA.
- **Mobile** keeps the session alive (`persistSession`) and adds a **local lock**
  cleared with device biometrics (`expo-local-authentication`): re-lock on
  background/inactivity, unlock with Face ID / fingerprint (device-passcode
  fallback), and never hard-lock a phone that has no biometrics enrolled.

Same invariant as everything else here: the biometric lock is a **UX privacy
gate, not a security boundary** — the session token (AAL2) + RLS are the real
access control, so a bypassed lock still reads nothing. Implement it as one more
early return in the cascade (session → AAL2 → **biometric (native only)** →
approval → app), with lock state in a small hook that re-arms on `AppState`
background/active plus an inactivity timer, and a lock screen that auto-prompts
`LocalAuthentication.authenticateAsync`.

## Server-side twins (defense in depth)

Any service-role backend must re-implement the client gates because RLS doesn't
apply to the service role:
- Verify the caller's JWT on **every** request (resolve the bearer token to a
  user id) and stamp every written row with that verified id.
- Re-check approval server-side (the twin of the `is_approved()` RLS predicate)
  before doing privileged work.

## Adopting this in a new app — the skeleton

1. One RLS-scoped Supabase client (anon key, `persistSession`,
   `autoRefreshToken`), used everywhere.
2. `session` as the root signal (`getSession` + `onAuthStateChange`).
3. The gate cascade as ordered early returns (session → AAL2 → approval → app).
4. TOTP enroll/verify/step-up screens using the primitives reference.
5. The approval-gate migration (`profiles` + predicates + trigger + policy
   rewrite) from the approval-gate reference.
6. The idle-logout hook.
7. Server-side JWT verification + approval re-check in any service-role backend.

Read the three references before porting — the gotchas (verified vs unverified
factor lists, half-enrollment cleanup, SECURITY DEFINER to avoid RLS recursion)
are exactly the parts that are non-obvious the first time.
