# Recruiter X — Commercialization Plan
**Status:** Draft for review · **Owner:** TalentStack · **Last updated:** 2026-05-13

The current app is a single-tenant install: every authenticated user sees every
record. To sell licenses to other recruiting firms, we need a **multi-tenant
SaaS architecture** where each customer (an "Org") gets its own isolated
workspace inside a shared Supabase project, with seat-based licensing and
billing.

This document is the plan only — no code changes yet. Approve sections (or
push back) and I'll execute in order.

---

## 1 · Tenancy model

**One Supabase project, row-level isolation by `org_id`.** Standard B2B SaaS
pattern. The alternative — one Supabase project per customer — gives stronger
isolation but is 10× the operational cost and blocks shared analytics, both
non-starters for a CRM at this price point.

```
organizations          orgs that buy licenses
  id (uuid)
  name
  slug                 used as subdomain: acme.recruiterx.app
  plan                 free | starter | pro | enterprise
  status               trial | active | past_due | suspended | cancelled
  trial_ends_at
  seat_limit
  feature_flags        jsonb — per-plan capability bits
  stripe_customer_id
  stripe_subscription_id
  created_at

org_members            users ↔ orgs (many-to-many; supports consultants
  id                      who work for multiple firms)
  org_id     (fk → organizations)
  user_id    (fk → auth.users)
  role       owner | admin | member | viewer
  seat_type  core | bench | viewer        ← affects billing
  invited_by
  invited_at
  accepted_at
  status     invited | active | suspended | removed
  UNIQUE (org_id, user_id)

org_invitations        pending invites by email (user may not exist yet)
  id, org_id, email, role, seat_type, token, expires_at, status
```

**Every existing table gets a `org_id UUID NOT NULL REFERENCES organizations(id)`
column.** This is the only schema change to existing tables. ~30 tables.

---

## 2 · License & plan model

| Plan        | Monthly | Seats incl. | Records | AI calls/mo | Features                              |
|-------------|--------:|------------:|--------:|------------:|---------------------------------------|
| Free trial  |      $0 |           3 |     500 |         100 | All Pro features for 14 days          |
| Starter     |     $49 |           3 |   5,000 |       1,000 | Core CRM, no AI matching, no email blast |
| Pro         |    $149 |          10 |  50,000 |      10,000 | + AI, automation, email blast, API    |
| Enterprise  |  Custom |    ∞ (+seat)|       ∞ |           ∞ | + SSO, audit log export, custom RLS, SLA |

`feature_flags` JSONB on `organizations`:

```json
{
  "ai_matching": true,
  "automation": true,
  "email_blast": true,
  "api_access": false,
  "sso": false,
  "audit_export": false,
  "custom_branding": false,
  "max_records": 50000,
  "max_ai_calls_monthly": 10000
}
```

Each plan is a preset that hydrates `feature_flags`. Enterprise can override
individual flags from the admin console.

**License enforcement happens in 3 places:**

1. **Hard quotas** (records, seats) — enforced in RLS by a Postgres function:
   ```
   IF (SELECT count(*) FROM candidates WHERE org_id = X) >= flag.max_records THEN
     RAISE EXCEPTION 'record_limit_reached';
   END IF;
   ```
2. **Feature gates** (ai_matching, sso) — checked client-side AND server-side
   via a `PermissionGate` component + Edge Function preflight.
3. **Soft alerts** (80% of quota, trial expiring) — surfaced as banners in the
   shell + email notifications.

---

## 3 · Schema migrations needed

1. **`008_tenancy.sql`** — create `organizations`, `org_members`,
   `org_invitations`. Add `org_id` column to every existing table with a
   default UUID for the "legacy org" so existing data isn't orphaned.
2. **`009_rls_by_org.sql`** — replace every `authenticated_all` policy with
   `org_member_only` policy:
   ```sql
   CREATE POLICY "org_scoped" ON candidates USING (
     org_id IN (SELECT org_id FROM org_members
                WHERE user_id = auth.uid() AND status = 'active')
   );
   ```
3. **`010_license_quotas.sql`** — quota-enforcement functions + triggers that
   block inserts when over plan limits.
4. **`011_billing.sql`** — `billing_events` audit table (webhook from Stripe),
   `usage_records` (per-org monthly AI/storage/seat counters).

---

## 4 · Auth & onboarding flow

```
Anonymous → /signup → Stripe Checkout (or 14-day trial) → email verify
       ↓
Create org → user becomes owner → org slug auto-generated (editable)
       ↓
Invite teammates → /dashboard?org=acme
```

**Active org is held in:**
1. URL subdomain when using custom domain (acme.recruiterx.app)
2. Otherwise a cookie `recruiterx_active_org`
3. Settable via an org-switcher in the topbar (`AccountChip` already has the
   shape for this — extend the dropdown).

**Existing AuthContext additions** ([src/lib/AuthContext.jsx](src/lib/AuthContext.jsx)):
```
{
  user,
  activeOrg,           // the org this session is acting on
  myOrgs,              // all orgs the user belongs to
  setActiveOrg(orgId)  // updates cookie + reloads queries
}
```

Every Supabase query needs `.eq('org_id', activeOrg.id)` — but RLS makes this
**automatic** as long as the user belongs to exactly one org per session.

---

## 5 · Billing integration

**Stripe** is the only reasonable choice for B2B SaaS subscriptions.

Components:
- Stripe **Products** = plans (Starter/Pro/Enterprise).
- Stripe **Prices** = monthly + annual.
- Stripe **Customer Portal** for plan changes / cancellation / card updates.
- Webhooks → Supabase Edge Function (`stripe-webhook`) → updates
  `organizations.status`, `seat_limit`, `feature_flags`.
- Seat-based: per-seat add-on price; quantity = `count(org_members WHERE seat_type='core' AND status='active')`.

**Edge functions to add:**
- `create-checkout-session` — generates Stripe Checkout URL on signup/upgrade.
- `create-portal-session` — redirects user to Stripe Customer Portal.
- `stripe-webhook` — receives Stripe events, syncs to DB.
- `seat-sync` — nightly cron, reconciles `seat_limit` with actual count.

---

## 6 · Admin (SaaS-operator) console

A separate sub-app at `/admin` accessible only to `is_superadmin = true` users
(new column on `user_profiles`). Lets TalentStack ops:

- See every org, plan, seat count, MRR
- Suspend / reinstate orgs
- Override `feature_flags` for Enterprise
- View Stripe → DB sync status
- Pull org-level audit logs

Built on the existing admin pages but scoped to *cross-org* views.

---

## 7 · Existing data — what happens to it?

The 1,180 companies + 445 candidates + 138 jobs + ... currently in Supabase
are owned by **TalentStack** (you). On migration day:

1. Create org `talentstack` with plan `enterprise`.
2. Backfill every existing row's `org_id` = `talentstack.id`.
3. Make all current users (you, hr@talentstack.org, etc.) members of that org
   with role `owner` or `admin`.

This is a one-shot migration in `008_tenancy.sql`. Zero data loss.

---

## 8 · Public website + signup funnel

Currently [src/pages/Landing.jsx](src/pages/Landing.jsx) is a single landing
page. For commercialization it needs:

- **Pricing page** (Landing → `/pricing`) — plan comparison table, "Start free trial" CTA → Stripe Checkout.
- **Signup page** (`/signup`) — email, org name, password → creates org + user + sends verification email.
- **Billing page** (in-app at `/settings/billing`) — current plan, usage, invoices, upgrade/downgrade, payment method.
- **Public-status page** (optional, `/status`) — Supabase + Vercel uptime.

---

## 9 · Phased rollout (8 weeks)

| Week | Milestone                                                          |
|-----:|--------------------------------------------------------------------|
|    1 | Migrations 008/009 (tenancy + RLS) on staging. Backfill local data.|
|    2 | AuthContext + org-switcher; every entity query verified org-scoped.|
|    3 | Stripe Products + Checkout + webhook. Enforce seat & record quotas.|
|    4 | Pricing page + signup funnel + email verification.                 |
|    5 | Customer Portal + plan upgrade/downgrade flow.                     |
|    6 | Admin console (cross-org view, suspend/reinstate).                 |
|    7 | Trial expiration emails, soft alerts, usage dashboards.            |
|    8 | Production cutover: migrate prod data → enable signups → marketing.|

Each week is its own PR; staging is exercised before merging.

---

## 10 · Open questions for you

Before I start migration 008, confirm these:

1. **Plan/price points** — Are the Starter/Pro/Enterprise tiers above
   reasonable, or do you have different price points in mind?
2. **Custom domain or subdomains?** acme.recruiterx.app vs
   recruiterx.app/acme — first needs wildcard DNS + a Vercel domain
   wildcard; second is simpler.
3. **Self-serve or sales-led?** Should Enterprise also be self-serve via
   Stripe, or sales-quoted only ("Contact us")?
4. **Stripe account** — Do you have an existing Stripe account or do I assume
   we create a new one under TalentStack?
5. **Trial without card?** 14-day trial requiring no card up front, or
   card-required trial?
6. **Existing data ownership** — Confirm the 1,180/445/138 rows already in
   Supabase are TalentStack's prod data and should become org=`talentstack`
   (not deleted, not redistributed). Earlier sweep showed two cohorts —
   legacy_id-null rows (older) and legacy_id-set rows (today's CSV import).
   Both end up under `talentstack`.

Once you answer these, the plan is ready to execute. Migration 008 is ~150
lines of SQL and is the highest-risk step — it's destructive in the sense
that wrong RLS could lock you out of your own data, so it'll go through
staging first.
