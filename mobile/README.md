# TalentStack Mobile (Expo)

A second client for Recruiter X — **same Supabase project, same Edge Functions,
same RLS**. No backend was duplicated to build this. Ported from FinTracker's
`app/` per the migration guide; the security pattern it implements is documented
in [../skills/mfa-totp/](../skills/mfa-totp/).

> **Expo has changed.** Read the versioned docs at
> <https://docs.expo.dev/versions/v57.0.0/> before editing native config.

## What it does

Two screens behind the full gate cascade:

- **Candidates** — search/browse. No client-side tenant filter: visibility is
  RLS's job (`auth_is_approved()`, migration 020).
- **Add** — pick a resume with `expo-document-picker`, upload it to the private
  `uploads` bucket under `<user-id>/…`, and create the candidate row holding the
  storage **path**.

Parsing stays on the web on purpose: `parseResumeFile` takes extracted
`resume_text`, and a phone has no PDF text extractor. Inventing one here would
create candidate records that look parsed but are empty.

## The gate cascade (`App.tsx`)

```
session → MFA (AAL1→AAL2) → biometric lock (native only) → approval → app
```

Every gate is **UX**. The real locks are in the database — migration 020
compiles `auth_is_approved()` into every policy, so deleting this entire app
would not expose one candidate row to an unapproved account. Two deliberate
choices:

- **Approval fails closed.** An unreadable or missing `user_profiles` row is
  treated as pending, not approved.
- **A device with no biometrics enrolled is let straight in.** Hard-locking
  there would strand someone out of their own account for no security gain —
  the session and RLS are the boundary, not the lock screen.

Mobile keeps the session and re-locks behind biometrics rather than inheriting
the web's 20-minute idle **sign-out** (`src/hooks/useIdleLogout.js`) — retyping
a password and a TOTP code every time you pocket the phone is unusable.

## Setup

```bash
cd mobile
npm install
cp .env.example .env.local          # fill in the web app's VITE_SUPABASE_* values
npm start                           # Expo dev server
```

Then, once per project (not yet done — these need your Expo account):

```bash
export EXPO_TOKEN=...               # expo.dev → Access Tokens
npx eas-cli@latest init             # creates the EAS project + writes projectId
npx eas-cli@latest update:configure # adds updates.url for OTA
```

`eas init` writes `extra.eas.projectId` into `app.json`; `update:configure` adds
`updates.url`. Both are intentionally absent from the committed `app.json`
because they identify a specific EAS project.

Set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS
environment variables per profile (Expo dashboard → Project → Environment
variables) — `eas.json` maps each build profile to an environment.

## Build & ship

```bash
npm run build:apk        # eas build --profile preview --platform android → installable APK
npm run update:preview   # eas update --branch preview → OTA, no reinstall
npm run build:web        # expo export --platform web (CI parity check)
```

**The one distinction worth internalising:** JS and asset changes ship over the
air with `eas update`. **Native** changes — a new native dependency, the app
icon, anything under `ios`/`android`/`plugins` in `app.json` — need a full
`eas build` and a reinstall. Shipping a native change as an OTA update silently
does nothing.

`EXPO_PUBLIC_*` vars are **baked in at build time**. An APK built without them
is permanently broken and no OTA update can repair it (`App.tsx` renders an
explicit "Not configured" screen for that case rather than failing obscurely).

## Gotchas already handled

- **`SafeAreaView` is a no-op on Android.** `Shell.tsx` pads by
  `StatusBar.currentHeight` at the top and adds bottom clearance for the gesture
  pill. Don't rely on RN's `SafeAreaView` for Android insets.
- **React Native has no `File` object.** `lib/upload.ts` reads the picked
  `content://`/`file://` URI through `fetch(...).arrayBuffer()`; passing the URI
  string to supabase-js uploads the literal path as the file body.
- **Storage caps are enforced twice.** `lib/upload.ts` pre-checks extension and
  size for a friendly error; the bucket's own `file_size_limit` /
  `allowed_mime_types` (migration 023) are the actual control.
- **Native-only modules still web-export.** `expo-local-authentication` is
  reached only behind a `Platform.OS !== 'web'` branch — verify with
  `npm run build:web` after touching the cascade.

## Verification checklist

- [ ] Approved user signs in → candidate list loads.
- [ ] Unapproved user signs in → "Waiting for approval", and a raw `curl` to
      `/rest/v1/candidates` with their token returns `[]` (the real test).
- [ ] TOTP-enrolled user → challenge appears; a wrong code fails cleanly.
- [ ] Cold start and returning from background → biometric prompt.
- [ ] A device with no biometrics enrolled → still gets in.
- [ ] Upload a resume → lands under `uploads/<uid>/…`, candidate row appears.
- [ ] Oversized (>20 MB) or wrong-extension file → rejected with a clear message.
- [ ] `eas update --branch preview` → a trivial JS change appears with no reinstall.
