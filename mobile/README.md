# TalentStack Mobile (Expo)

A second client for Recruiter X — **same Supabase project, same Edge Functions,
same RLS**. No backend was duplicated to build this. Ported from FinTracker's
`app/` per the migration guide; the security pattern it implements is documented
in [../skills/mfa-totp/](../skills/mfa-totp/).

> **Expo has changed.** Read the versioned docs at
> <https://docs.expo.dev/versions/v57.0.0/> before editing native config.

## What it does

The core recruiter workflow, behind the full gate cascade. Five bottom tabs —
**Home, Candidates, Jobs, Tasks, More** — plus one level of pushed detail
screens.

- **Home** — counts (candidates, open jobs, submissions, open tasks) and the
  five most recent candidates. Counts are `head: true` COUNT queries, so the
  phone pulls integers rather than rows it will never render.
- **Candidates** — search/browse → **candidate detail** (contact, profile,
  skills, submissions; tap-to-call/email, and resume opening that signs the
  private storage path).
- **Jobs** — search + status filter → **job detail** (details, skills,
  description, requirements, and the submissions against that job).
- **Tasks** — filter by state and **tick tasks done**. The one screen that
  writes: completing a task is what a recruiter actually does on a phone.
- **More** — Submissions (pipeline with status filter), Companies, and Add.
- **Add** — pick a resume with `expo-document-picker`, upload it to the private
  `uploads` bucket under `<user-id>/…`, and create the candidate row holding the
  storage **path**.

No client-side tenant filter anywhere: visibility is RLS's job
(`auth_is_approved()`, migration 020). An unapproved account running any of
these queries gets `[]`, which is the behaviour we inherit rather than
reimplement.

**Everything except completing a task is read-only.** Creating and editing
candidates, jobs and invoices stays on the web app — porting those forms would
mean duplicating validation that RLS and the web already enforce.

Parsing stays on the web on purpose: `parseResumeFile` takes extracted
`resume_text`, and a phone has no PDF text extractor. Inventing one here would
create candidate records that look parsed but are empty.

### Navigation

Still hand-rolled (`components/Shell.tsx` + the `tab`/`detail` state in
`App.tsx`). One level of depth does not justify react-navigation: it is a
**native** dependency, so adopting it would turn every future JS-only change
from an OTA `eas update` into a full rebuild and reinstall. Android's hardware
back is wired to pop the detail screen in `App.tsx`.

### Shared pieces

- `lib/useRows.ts` — the list-screen state machine (debounced search,
  pull-to-refresh, first-load spinner, stale-response guard). Also exports
  `asRows()`, which documents why supabase-js's array type for a many-to-one
  PostgREST embed is wrong, and `humanize()`, which turns a fetch failure into
  "You're offline" without a NetInfo dependency.
- `components/ui.tsx` — `Card`, `Pill` (status→colour for the CHECK-constrained
  vocabularies in 001), `EmptyState`, `ErrorNotice`, `Field`, date/money
  formatters.

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

- **Metro's cache will bake in an EMPTY `EXPO_PUBLIC_*` and say nothing**
  (hit 2026-08-07). `EXPO_PUBLIC_*` are inlined at bundle time, and a cached
  bundle keeps whatever they were on the previous run — a build made before
  `.env.local` existed inlines `process.env.EXPO_PUBLIC_SUPABASE_URL` as `''`
  and every later build reuses it. The symptom is the "Not configured" screen
  with a perfectly correct `.env.local` sitting right there. `rm -rf dist .expo`
  is **not** enough; Metro's cache lives outside the project. Use:

  ```bash
  npx expo export --platform web --clear      # --clear is the fix
  ```

  Confirm the value actually landed rather than trusting the build log:

  ```bash
  grep -c "<your-project-ref>" dist/_expo/static/js/web/*.js   # must be ≥ 1
  ```

  Same trap applies to `eas build`; an APK built from a cached empty value is
  permanently broken and no OTA update can repair it.

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
