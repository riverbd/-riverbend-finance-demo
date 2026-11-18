-- ============================================================================
-- RIVERBEND FINANCE — 005 contact messages
-- ============================================================================
-- Milestone 3, part D. The homepage "Send us a message" form previously did
-- nothing but log to the console and show a success panel, so messages were
-- never seen by anyone. This adds a real store the admin dashboard reads.
--
-- The visitor is anonymous, so INSERT has to be open to the `anon` role. That
-- makes this the one table in the project an untrusted caller can write to, and
-- the guard rails below are what keep that safe:
--
--   * No privilege of any kind for `anon` on the table itself. A visitor
--     submits through one SECURITY DEFINER function and can never read a
--     message back — neither their own nor anyone else's. Only the admin
--     surface (which runs with the passphrase check) reads them.
--   * Length and shape constraints run in Postgres, so a caller bypassing the
--     form cannot insert a 10 MB body or a non-email address.
--   * Insert only. There is no policy that lets an anonymous caller change a
--     row after the fact, and no way to delete one.
--   * The table is not readable through the public API at all, so no
--     `select *` from the browser can enumerate visitor email addresses.
--
-- Only additive. No DROP TABLE, no TRUNCATE, no DELETE of existing rows.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (char_length(btrim(full_name)) between 1 and 120),
  email      text not null check (position('@' in email) > 1 and char_length(email) <= 254),
  message    text not null check (char_length(btrim(message)) between 1 and 4000),
  -- Read/unread is what the admin toggles. A nullable timestamp would work too,
  -- but a boolean is unambiguous to query and easy to index for an "unread"
  -- badge.
  is_read    boolean not null default false,
  created_at timestamptz not null default now(),
  -- Set when the admin first marks it read; cleared if they mark it unread.
  read_at    timestamptz
);

comment on table public.contact_messages is
  'Messages submitted through the homepage contact form. Anonymous INSERT, admin-only read.';
comment on column public.contact_messages.is_read is
  'Admin-facing read/unread flag. Set independently of read_at so the UI can show when it was opened.';

-- The admin list is "newest first, unread first"; this covers both.
create index if not exists contact_messages_created_idx
  on public.contact_messages (created_at desc);

create index if not exists contact_messages_unread_idx
  on public.contact_messages (created_at desc)
  where is_read = false;

-- ----------------------------------------------------------------------------
-- 2. RLS and privileges
-- ----------------------------------------------------------------------------
alter table public.contact_messages enable row level security;
alter table public.contact_messages no force row level security;

revoke all on public.contact_messages from anon, authenticated, public;

-- NO grant of any kind to anon or authenticated, and no policy.
--
-- The obvious design is `grant insert` plus an INSERT policy, but the app asks
-- PostgREST to return the new row's id so it can tell the visitor the message
-- really saved. INSERT ... RETURNING requires SELECT privilege on the returned
-- column, so that design either leaks reads or cannot confirm the write.
--
-- Instead the visitor goes through one SECURITY DEFINER function (section 3),
-- which runs as the owner, inserts, and hands back only the new id. The table
-- itself stays completely closed to the browser roles: no read, no write, no
-- way to enumerate anything.

-- ----------------------------------------------------------------------------
-- 3. Visitor submission
-- ----------------------------------------------------------------------------
-- The single door an anonymous caller can use. Validates a second time (the
-- CHECK constraints are the backstop; these give a clean error message), then
-- inserts and returns the new id so the form can honestly report success.
create or replace function public.riverbend_submit_contact_message(
  p_full_name text,
  p_email     text,
  p_message   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text := btrim(coalesce(p_full_name, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_msg   text := btrim(coalesce(p_message, ''));
  v_id    uuid;
begin
  if v_name = '' then
    raise exception 'Please enter your full name.' using errcode = '22023';
  end if;
  if v_email = '' then
    raise exception 'Please enter your email address.' using errcode = '22023';
  end if;
  -- Deliberately permissive: one @, a dot in the domain, no whitespace. The
  -- form does the stricter check; this stops a caller bypassing the form.
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;
  if v_msg = '' then
    raise exception 'Please write a message.' using errcode = '22023';
  end if;

  insert into public.contact_messages (full_name, email, message)
  values (v_name, v_email, v_msg)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.riverbend_submit_contact_message(text, text, text) is
  'Anonymous contact-form submission. Returns the new message id; the only write an unauthenticated caller can make.';

revoke all on function public.riverbend_submit_contact_message(text, text, text) from anon, authenticated, public;
grant execute on function public.riverbend_submit_contact_message(text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Admin read / mutate surface
-- ----------------------------------------------------------------------------
-- Everything below is SECURITY DEFINER so it can read the table the browser
-- roles cannot, and each one checks the admin passphrase first. Returning an
-- empty set (or zero rows) on a bad passphrase keeps "wrong password" from
-- being distinguishable from "no messages".

/** Every message, newest first, with the unread count for the badge. */
create or replace function public.riverbend_admin_contact_messages(
  p_passphrase text
)
returns table (
  id          uuid,
  full_name   text,
  email       text,
  message     text,
  is_read     boolean,
  created_at  timestamptz,
  read_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.riverbend_admin_ok(p_passphrase) then
    return;
  end if;

  return query
    select m.id, m.full_name, m.email, m.message, m.is_read, m.created_at, m.read_at
      from public.contact_messages m
     order by m.created_at desc;
end;
$$;

comment on function public.riverbend_admin_contact_messages(text) is
  'Admin-only read of contact form submissions. Requires the admin passphrase.';

revoke all on function public.riverbend_admin_contact_messages(text) from anon, authenticated, public;
grant execute on function public.riverbend_admin_contact_messages(text) to anon, authenticated;

/** Flip the read/unread flag. Returns the number of rows changed (0 or 1). */
create or replace function public.riverbend_admin_set_message_read(
  p_passphrase text,
  p_id         uuid,
  p_is_read    boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.riverbend_admin_ok(p_passphrase) then
    return 0;
  end if;

  update public.contact_messages
     set is_read = coalesce(p_is_read, false),
         read_at = case when coalesce(p_is_read, false) then coalesce(read_at, now()) else null end
   where id = p_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.riverbend_admin_set_message_read(text, uuid, boolean) is
  'Admin-only read/unread toggle for a contact message.';

revoke all on function public.riverbend_admin_set_message_read(text, uuid, boolean) from anon, authenticated, public;
grant execute on function public.riverbend_admin_set_message_read(text, uuid, boolean) to anon, authenticated;

/** Delete one message. Returns the number of rows removed (0 or 1). */
create or replace function public.riverbend_admin_delete_message(
  p_passphrase text,
  p_id         uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.riverbend_admin_ok(p_passphrase) then
    return 0;
  end if;

  delete from public.contact_messages m where m.id = p_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.riverbend_admin_delete_message(text, uuid) is
  'Admin-only delete of a contact message. Deletion is only reachable through this gated function.';

revoke all on function public.riverbend_admin_delete_message(text, uuid) from anon, authenticated, public;
grant execute on function public.riverbend_admin_delete_message(text, uuid) to anon, authenticated;
