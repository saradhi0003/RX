# Supabase Auth MFA primitives + the gotchas

The exact `supabase.auth` surface used by this pattern, and the non-obvious parts
that cost debugging time the first time through. Verify against current
`@supabase/supabase-js` docs when you adopt — this reflects the API as used in the
FinTracker build.

## First factor — email OTP (passwordless)

```ts
// send a 6-digit code to the email
await supabase.auth.signInWithOtp({ email });
// verify it → creates the session
await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
```

No passwords are stored. `type: 'email'` (not `'magiclink'`) because this is a
code the user types, and the client sets `detectSessionInUrl: false`.

## The AAL step-up signal

```ts
const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
const needsMfa = data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
```

- `currentLevel` = what this session has satisfied; `nextLevel` = what the account
  *requires*. The pair `aal1 / aal2` means "a verified TOTP factor exists but this
  session hasn't cleared it" — i.e. show the challenge. This is server-derived
  state, not a client flag: it's the real lock.

## Enroll → confirm → list → unenroll

```ts
// enroll: returns a QR (SVG data-URI) + the shared secret
const { data } = await supabase.auth.mfa.enroll({
  factorType: 'totp', friendlyName: 'MyApp',
});
// data.totp.qr_code  → SVG data-URI (see QR gotcha below)
// data.totp.secret   → base32 secret (offer as manual-entry fallback)
// data.id            → factorId

// confirm: challenge + verify in ONE call
await supabase.auth.mfa.challengeAndVerify({ factorId: data.id, code });

// remove
await supabase.auth.mfa.unenroll({ factorId });
```

## Gotcha 1 — `listFactors()`: `.totp` is verified-only

```ts
const { data } = await supabase.auth.mfa.listFactors();
data.totp   // ONLY verified factors
data.all    // everything, including half-enrolled `status: 'unverified'` ones
```

If you read `data.totp` to decide "is MFA on?", a half-finished enrollment is
invisible there — which is what you want for the on/off check, but means you must
look at `.all` to clean up abandoned enrollments (next gotcha).

## Gotcha 2 — garbage-collect half-enrollments before a new enroll

Supabase **rejects** `mfa.enroll` if an unverified factor already exists (a user
who opened the enroll screen and bailed leaves one behind). Before enrolling,
sweep them:

```ts
const { data } = await supabase.auth.mfa.listFactors();
for (const f of data.all) {
  if (f.factor_type === 'totp' && f.status === 'unverified') {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
}
// now enroll cleanly
```

## Gotcha 3 — `challengeAndVerify` vs separate `challenge` + `verify`

Supabase exposes both `mfa.challenge` and `mfa.verify` as separate calls, *and*
the combined `mfa.challengeAndVerify`. For a synchronous TOTP prompt (user types
the code right now), the combined call is simpler and is what this pattern uses in
both places (enrollment confirm and the AAL2 gate). Reach for the separate calls
only if you need a challenge id to live across an async boundary.

## Gotcha 4 — the QR is an SVG data-URI

`data.totp.qr_code` comes back as a `data:image/svg+xml,...` URI. To render it as
inline SVG (e.g. React Native's `<SvgXml>`), strip the `data:` prefix and
URL-decode the payload:

```ts
let qr = data.totp.qr_code ?? '';
if (qr.startsWith('data:')) qr = decodeURIComponent(qr.slice(qr.indexOf(',') + 1));
// qr now starts with "<svg ..."; render it, and show data.totp.secret as fallback
```

## Client config that matters

```ts
createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,       // persists session across restarts (web + native)
    persistSession: true,
    autoRefreshToken: true,      // ← keeps JWT alive forever; pair with idle-logout
    detectSessionInUrl: false,   // OTP, not magic-link redirect
  },
});
```

Use the **anon key** on the client, never the service role — RLS is what scopes
the client to the signed-in user's rows. `autoRefreshToken: true` is why you need
a separate idle-logout hook for a finance-grade session lifetime (see the SKILL).

## Summary table

| Primitive | Use |
|---|---|
| `signInWithOtp` / `verifyOtp` | passwordless first factor |
| `getAuthenticatorAssuranceLevel()` | detect `aal1→aal2` step-up need |
| `mfa.enroll({ factorType: 'totp' })` | start enrollment → QR + secret |
| `mfa.challengeAndVerify({ factorId, code })` | confirm enrollment AND satisfy the gate |
| `mfa.listFactors()` | `.totp` = verified, `.all` = incl. unverified |
| `mfa.unenroll({ factorId })` | disable / clean up half-enrollments |
