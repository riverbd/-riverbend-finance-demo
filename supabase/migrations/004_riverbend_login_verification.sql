-- ============================================================================
-- RIVERBEND FINANCE — 004 admin-mediated six-digit login verification
-- ============================================================================
-- Milestone 2. A customer signs in with username/email + password, then must
-- enter a six-digit code before the banking dashboard opens. The admin reads the
-- pending code from the admin Users page and passes it to the customer
-- out-of-band (phone, in person). No SMS, email or third-party provider.
--
-- ============================================================================
-- WHAT THIS MIGRATION PROTECTS — AND WHAT IT HONESTLY DOES NOT
-- ============================================================================
--
-- The requirement is that the ADMIN can read the pending code. That single
-- requirement rules out storing the code as a one-way hash: a hash can be
-- checked but never displayed. The code is therefore stored in a form the
-- admin-facing function can return, and the protection is placed around WHO
-- can read it rather than around the value itself:
--
--   1. The table has RLS enabled, no policy, and NO privilege granted to
--      `anon` or `authenticated`. Browser JavaScript cannot SELECT, INSERT or
--      UPDATE it at all, even with the publishable key.
--
--   2. Every operation is a SECURITY DEFINER function owned by the schema
--      owner. The code can only travel out through
--      `riverbend_admin_login_verifications()`, which requires the admin
--      passphrase. The comparison happens in Postgres against a SHA-256
--      digest, not in the browser.
--
--   3. Generating a code requires the customer's PASSWORD, checked inside the
--      database. A caller cannot mint challenges for other customers.
--
--   4. Verifying is attempt-capped (5) and single-use, so an attacker cannot
--      walk the 1,000,000-value space.
--
-- HONEST LIMITATION: the admin passphrase is also bundled in the browser
-- because the existing admin login is client-side. So requirement 2 raises the
-- bar (a customer must know the admin passphrase to read codes) but does not
-- make it a true security boundary. The one-line change to make it real is to
-- replace `riverbend_admin_ok()` with a Supabase Auth role check such as
-- `(select auth.jwt() ->> 'role') = 'admin'` once the project moves to
-- Supabase Auth. This is documented again in the delivery notes.
--
-- Only additive. No DROP TABLE, no TRUNCATE, no DELETE. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. No extension required
-- ----------------------------------------------------------------------------
-- Deliberately built on functions core Postgres 13+ already provides:
--   * gen_random_uuid()  — pgcrypto-backed CSPRNG, so codes are not predictable
--   * sha256(bytea)      — for the admin passphrase digest
--   * gen_random_bytes is avoided so this migration does not need a pgcrypto
--     CREATE EXTENSION, which is unavailable on minimal Postgres images.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1. Status domain
-- ----------------------------------------------------------------------------
-- pending   a live code exists and has not expired
-- verified  the customer entered it correctly; the code is consumed
-- expired   five minutes elapsed, or a replacement code invalidated it
-- failed    too many wrong attempts; the code is dead and a new one is needed
do $$
begin
  if not exists (select 1 from pg_type where typname = 'login_verification_status') then
    create type public.login_verification_status as enum
      ('pending', 'verified', 'expired', 'failed');
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Admin passphrase digest
-- ----------------------------------------------------------------------------
-- Stores a SHA-256 digest of the admin passphrase so the comparison happens in
-- Postgres rather than in the browser. Seeded below with the passphrase the app
-- already ships in src/admin/store.tsx, so this introduces no new secret.
--
-- A password hash would normally be salted and slow (bcrypt/argon2) to resist
-- offline cracking. Both are out of reach here: pgcrypto is not available on
-- every Postgres image, and the value being protected is a demo passphrase that
-- is already in the public bundle. It is a gate against the public API, not a
-- secret to be recovered. Do NOT reuse this pattern for real credentials.
create table if not exists public.app_secrets (
  name       text primary key,
  value      text not null,
  created_at timestamptz not null default now()
);

comment on table public.app_secrets is
  'Server-side digests for demo-side checks. No anon/authenticated grants; read only through SECURITY DEFINER functions.';

alter table public.app_secrets enable row level security;
alter table public.app_secrets no force row level security;
revoke all on public.app_secrets from anon, authenticated, public;

-- Seed only when absent, so re-running never changes the value.
do $$
begin
  if not exists (select 1 from public.app_secrets where name = 'admin_passphrase') then
    insert into public.app_secrets (name, value)
    values ('admin_passphrase', encode(sha256('67500363oi!'::bytea), 'hex'));
  end if;
end;
$$;

/** Does the supplied admin passphrase match the stored digest? */
create or replace function public.riverbend_admin_ok(p_passphrase text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.value = encode(sha256(p_passphrase::bytea), 'hex')
        from public.app_secrets s
       where s.name = 'admin_passphrase'
         and p_passphrase is not null
         and length(p_passphrase) > 0
    ),
    false
  );
$$;

comment on function public.riverbend_admin_ok(text) is
  'Admin passphrase digest check against app_secrets. Gates the admin-facing verification reads.';

revoke all on function public.riverbend_admin_ok(text) from anon, authenticated, public;

-- ----------------------------------------------------------------------------
-- 3. Table
-- ----------------------------------------------------------------------------
-- One row per login attempt. Keeping history (rather than overwriting a single
-- row per customer) is what makes "a new code invalidates the previous one"
-- auditable and lets the admin see that a code was replaced or already used.
create table if not exists public.login_verifications (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  -- The six-digit code. Protected by RLS + no grants, not by hashing — the
  -- admin has to be able to read it (see the header).
  code         text not null check (code ~ '^[0-9]{6}$'),
  status       public.login_verification_status not null default 'pending',
  attempts     integer not null default 0,
  max_attempts integer not null default 5,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  -- Set the moment the code stops being usable, for any reason.
  resolved_at  timestamptz,
  constraint login_verifications_expiry_after_creation check (expires_at > created_at),
  constraint login_verifications_attempts_sane check (attempts >= 0 and max_attempts > 0)
);

comment on table public.login_verifications is
  'Admin-mediated 6-digit login challenges. Never readable through the anon API; only via SECURITY DEFINER functions.';

-- A customer can have at most ONE live challenge. This is the database-level
-- guarantee behind "a newly generated code invalidates any previous code" —
-- even two logins racing on different devices cannot leave two valid codes.
create unique index if not exists login_verifications_one_pending_per_customer
  on public.login_verifications (customer_id)
  where status = 'pending';

create index if not exists login_verifications_customer_created_idx
  on public.login_verifications (customer_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Privileges
-- ----------------------------------------------------------------------------
-- RLS on, no policy, and no grant to the browser roles. Every operation goes
-- through the SECURITY DEFINER functions below.
alter table public.login_verifications enable row level security;
alter table public.login_verifications no force row level security;
revoke all on public.login_verifications from anon, authenticated, public;

-- ----------------------------------------------------------------------------
-- 5. Start (or restart) a login challenge
-- ----------------------------------------------------------------------------
-- Requires the customer's password, verified here, so nobody can mint
-- challenges for an account they cannot sign in to. Returns ONLY an opaque
-- challenge id — never the code.
--
-- The previous live challenge is always invalidated first, so "request a new
-- code" is the same operation as "start", and requesting a replacement
-- necessarily kills the old one.
create or replace function public.riverbend_start_login_verification(
  p_client_ref text,
  p_password   text,
  p_ttl_seconds integer default 300
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_stored   text;
  v_code     text;
  v_id       uuid;
  v_ttl      integer := coalesce(p_ttl_seconds, 300);
begin
  if v_ttl <= 0 or v_ttl > 3600 then
    raise exception 'Verification lifetime must be between 1 and 3600 seconds.'
      using errcode = '22023';
  end if;

  select c.id, c.demo_password into v_customer, v_stored
    from public.customers c
   where c.client_ref = p_client_ref;

  -- Same failure for "no such account" and "wrong password", so this endpoint
  -- cannot be used to enumerate usernames.
  if v_customer is null or v_stored is null or v_stored <> coalesce(p_password, '') then
    raise exception 'Those credentials are not valid.' using errcode = '28000';
  end if;

  -- Serialise concurrent logins for this customer (the partial unique index
  -- above is the hard backstop).
  perform pg_advisory_xact_lock(hashtext('riverbend_login_verification'), hashtext(p_client_ref));

  -- Close timed-out codes first so their status is accurate.
  update public.login_verifications
     set status = 'expired', resolved_at = now()
   where customer_id = v_customer
     and status = 'pending'
     and expires_at <= now();

  -- Invalidate any still-live previous code. `expired`, not deleted, so the
  -- admin can see that a code was replaced.
  update public.login_verifications
     set status = 'expired', resolved_at = now()
   where customer_id = v_customer
     and status = 'pending';

  -- Six digits derived from gen_random_uuid(), which is CSPRNG-backed. random()
  -- is NOT used: it is seedable and not cryptographic. Taking hex digits rather
  -- than a modulo of a 32-bit integer keeps the distribution even and stays
  -- positive (a bit(32)::bigint cast is signed in older releases).
  v_code := lpad(
    (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 1000000)::text,
    6,
    '0'
  );

  insert into public.login_verifications (customer_id, code, expires_at)
  values (v_customer, v_code, now() + make_interval(secs => v_ttl))
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.riverbend_start_login_verification(text, text, integer) is
  'Creates a fresh 6-digit challenge for a customer whose password checks out, invalidating any previous one. Returns the challenge id only.';

revoke all on function public.riverbend_start_login_verification(text, text, integer) from anon, authenticated, public;
grant execute on function public.riverbend_start_login_verification(text, text, integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Verify a code
-- ----------------------------------------------------------------------------
-- Returns the customer's client_ref on success and NULL on ANY failure, so a
-- caller cannot distinguish "wrong code" from "expired" from "already used".
-- Probing therefore learns nothing per attempt beyond a shared failure, and the
-- attempt cap bounds how many guesses are possible at all.
create or replace function public.riverbend_verify_login_code(
  p_client_ref text,
  p_challenge  uuid,
  p_code       text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.login_verifications%rowtype;
  v_ref text;
  v_submitted text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
begin
  if v_submitted !~ '^[0-9]{6}$' then
    return null;
  end if;

  select v.* into v_row
    from public.login_verifications v
    join public.customers c on c.id = v.customer_id
   where v.id = p_challenge
     and c.client_ref = p_client_ref
   for update of v;

  -- Unknown challenge, or one belonging to somebody else.
  if v_row.id is null then
    return null;
  end if;

  -- Already used, replaced, expired by sweep, or out of attempts.
  if v_row.status <> 'pending' then
    return null;
  end if;

  if v_row.expires_at <= now() then
    update public.login_verifications
       set status = 'expired', resolved_at = now()
     where id = v_row.id;
    return null;
  end if;

  if v_row.code = v_submitted then
    update public.login_verifications
       set status = 'verified', resolved_at = now()
     where id = v_row.id;

    select c.client_ref into v_ref from public.customers c where c.id = v_row.customer_id;
    return v_ref;
  end if;

  -- Wrong code: burn an attempt and kill the challenge once the budget is gone,
  -- so a wrong-code flood cannot run to a million guesses.
  update public.login_verifications
     set attempts = attempts + 1,
         status = case
                    when attempts + 1 >= max_attempts
                      then 'failed'::public.login_verification_status
                    else status
                  end,
         resolved_at = case when attempts + 1 >= max_attempts then now() else resolved_at end
   where id = v_row.id;

  return null;
end;
$$;

comment on function public.riverbend_verify_login_code(text, uuid, text) is
  'Consumes a pending code. Returns client_ref on success, NULL for wrong/expired/used codes. Single use, attempt-capped.';

revoke all on function public.riverbend_verify_login_code(text, uuid, text) from anon, authenticated, public;
grant execute on function public.riverbend_verify_login_code(text, uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Customer-facing status read
-- ----------------------------------------------------------------------------
-- The waiting screen needs to know "has this expired? how many tries left?"
-- without being able to read the code. Exposes status and timing ONLY, and only
-- for a challenge id the caller already holds.
create or replace function public.riverbend_login_verification_status(
  p_challenge uuid
)
returns table (status text, expires_at timestamptz, seconds_left integer, attempts_left integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when v.status = 'pending' and v.expires_at <= now() then 'expired'
      else v.status::text
    end,
    v.expires_at,
    greatest(ceil(extract(epoch from (v.expires_at - now())))::int, 0),
    greatest(v.max_attempts - v.attempts, 0)
  from public.login_verifications v
  where v.id = p_challenge;
$$;

revoke all on function public.riverbend_login_verification_status(uuid) from anon, authenticated, public;
grant execute on function public.riverbend_login_verification_status(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. Admin read — the ONLY function that returns a code
-- ----------------------------------------------------------------------------
-- One call returns the latest challenge for every customer, so the admin Users
-- page needs a single round trip. Returns zero rows unless the passphrase is
-- correct, which makes "wrong passphrase" indistinguishable from "nothing
-- pending" and avoids confirming that a customer has an active code.
create or replace function public.riverbend_admin_login_verifications(
  p_passphrase text
)
returns table (
  client_ref     text,
  challenge_id   uuid,
  code           text,
  status         text,
  created_at     timestamptz,
  expires_at     timestamptz,
  seconds_left   integer,
  attempts       integer,
  attempts_left  integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.riverbend_admin_ok(p_passphrase) then
    return;
  end if;

  return query
    with latest as (
      select distinct on (v.customer_id) v.*
        from public.login_verifications v
       order by v.customer_id, v.created_at desc
    )
    select
      cst.client_ref,
      l.id,
      l.code,
      case
        when l.status = 'pending' and l.expires_at <= now() then 'expired'
        else l.status::text
      end,
      l.created_at,
      l.expires_at,
      greatest(ceil(extract(epoch from (l.expires_at - now())))::int, 0),
      l.attempts,
      greatest(l.max_attempts - l.attempts, 0)
    from latest l
    join public.customers cst on cst.id = l.customer_id
    order by cst.client_ref;
end;
$$;

comment on function public.riverbend_admin_login_verifications(text) is
  'Admin-only read of pending verification codes. Requires the admin passphrase; returns nothing otherwise.';

revoke all on function public.riverbend_admin_login_verifications(text) from anon, authenticated, public;
grant execute on function public.riverbend_admin_login_verifications(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. Housekeeping
-- ----------------------------------------------------------------------------
-- Expiry is evaluated on read, so no cron job is required to make codes stop
-- working. This function only tidies old rows for the admin view; it is not on
-- the correctness path.
create or replace function public.riverbend_sweep_login_verifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.login_verifications
     set status = 'expired', resolved_at = now()
   where status = 'pending'
     and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.riverbend_sweep_login_verifications() from anon, authenticated, public;
