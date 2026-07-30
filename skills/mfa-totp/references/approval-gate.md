# The admin-approval gate (SQL)

An approval gate where **new signups can access nothing until an admin approves
them** — enforced by the database, not the app. This is the part that makes the
UI gate real: even a fully authenticated user with direct API access reads zero
rows and writes nothing until approved. Adapted from
`supabase/migrations/0004_approvals.sql`; the migration is idempotent (safe to
re-run).

The mechanism is four pieces: a `profiles` table, two SECURITY DEFINER
predicates, a signup trigger, and a rewrite of every table's RLS policy to
require approval.

## 1. The `profiles` table — one row per auth user

```sql
create table if not exists profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  role        text not null default 'member' check (role in ('admin', 'member')),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  created_at  timestamptz not null default now(),
  approved_at timestamptz,
  notified_at timestamptz   -- when the admin was emailed (optional)
);
alter table profiles enable row level security;
```

## 2. The predicates — SECURITY DEFINER to avoid RLS recursion

```sql
create or replace function is_approved() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and status = 'approved') $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles
                  where id = auth.uid() and status = 'approved' and role = 'admin') $$;
```

**Why SECURITY DEFINER matters:** these functions read `profiles`, and they're
called *inside* `profiles`' own policies (and every other table's). Without
DEFINER they'd trigger recursive policy evaluation. DEFINER runs them with the
function owner's rights, breaking the loop. Always pin `search_path` on DEFINER
functions.

## 3. Profiles' own policies — self-read, admin-manage

```sql
create policy profiles_self_read on profiles for select using (id = auth.uid());
create policy profiles_admin_read on profiles for select using (is_admin());
create policy profiles_admin_update on profiles for update
  using (is_admin()) with check (is_admin());
```

A member can read only their own row (to learn their status); only an admin can
change statuses. (The real migration wraps each in
`drop policy if exists ...` first, for idempotency.)

## 4. Auto-provision on signup — a trigger on `auth.users`

```sql
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, role, status, approved_at)
  values (
    new.id,
    coalesce(new.email, ''),
    case when lower(new.email) = 'ADMIN@EXAMPLE.COM' then 'admin' else 'member' end,
    case when lower(new.email) = 'ADMIN@EXAMPLE.COM' then 'approved' else 'pending' end,
    case when lower(new.email) = 'ADMIN@EXAMPLE.COM' then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

Replace `ADMIN@EXAMPLE.COM` with your seed admin. Everyone else lands `pending`.
Run a one-time backfill with the same `case` logic over existing `auth.users` so
current accounts get profiles too (see the migration's backfill block).

## 5. The actual lockout — approval baked into every table's policy

This is the load-bearing step. Rewrite each data table's policy so it requires
**ownership AND approval**:

```sql
do $$
declare t text;
begin
  foreach t in array array['accounts','statements','transactions', /* ...your tables... */]
  loop
    execute format('drop policy if exists "%1$s_owner" on %1$s', t);
    execute format(
      'create policy "%1$s_owner" on %1$s for all
         using (user_id = auth.uid() and is_approved())
         with check (user_id = auth.uid() and is_approved())', t);
  end loop;
end $$;
```

And the storage bucket, if you have one:

```sql
create policy "files_owner_rw" on storage.objects for all
  using (bucket_id = 'YOUR_BUCKET'
         and (storage.foldername(name))[1] = auth.uid()::text
         and is_approved())
  with check (bucket_id = 'YOUR_BUCKET'
              and (storage.foldername(name))[1] = auth.uid()::text
              and is_approved());
```

Because views declared `security_invoker` and any read-only SQL RPC run with the
caller's rights, they inherit `is_approved()` automatically — you don't have to
touch them.

## Porting checklist

- [ ] Create `profiles` + enable RLS.
- [ ] Add `is_approved()` / `is_admin()` as SECURITY DEFINER with a pinned
      `search_path`.
- [ ] Add self-read / admin-read / admin-update policies on `profiles`.
- [ ] Add the `on_auth_user_created` trigger with your seed admin email; backfill
      existing users.
- [ ] **Rewrite every data table's policy** to `user_id = auth.uid() and
      is_approved()` — this is the step that actually locks pending users out.
      Missing one table leaves a hole.
- [ ] Mirror it server-side: any service-role backend must re-check approval
      explicitly (RLS doesn't apply to the service role).
- [ ] Build the admin UI as a thin mirror that updates `profiles.status` — it's
      convenience, the policies are the enforcement.
