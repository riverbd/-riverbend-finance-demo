-- ============================================================================
-- RIVERBEND FINANCE — 001 initial schema
-- ============================================================================
-- Purpose: a Supabase/Postgres mirror of the data structures the existing
-- React app already keeps in localStorage.
--
-- Source of truth for this design (inspected, not assumed):
--   src/account/auth.tsx   -> Account, Card, Transaction types + defaultAccounts
--   src/admin/store.tsx    -> ContentState type + defaultContent
--   src/admin/AdminDashboard.tsx -> what the CMS can actually edit
--   src/account/{SendPage,MovePage,Cards}.tsx -> runtime writes
--
-- Scope: this migration ONLY creates the schema and demo seed. It does not
-- wire the app to the database and does not change any app behaviour.
--
-- Safety: no DROP TABLE, no TRUNCATE, no DELETE. Every seed statement is
-- idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Role guards
-- ----------------------------------------------------------------------------
-- Supabase provisions `anon` and `authenticated` automatically, but a plain
-- Postgres instance (CI, local `initdb`, a throwaway test database) does not.
-- Creating them conditionally makes this migration runnable in both, and is a
-- no-op on a real Supabase project.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- updated_at helper
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1. customers
-- ----------------------------------------------------------------------------
-- Mirrors the account-holder fields from `Account` in src/account/auth.tsx.
--
-- DELIBERATE OMISSIONS:
--   * No `password` column. The source app stores plaintext passwords in
--     localStorage; persisting those in a database would be a regression.
--     Credentials stay out of the database entirely until real Supabase Auth
--     is wired in a later, approved step.
--   * No `initials` derivation at write time — it is stored because the app
--     renders `user.initials` verbatim (Profile.tsx, Dashboard.tsx).
--   * `id` is kept as a uuid, while `client_ref` preserves the app's original
--     string id ("demo-1", "demo-2") so a future migration can map rows back.
-- ============================================================================
create table if not exists public.customers (
  id           uuid primary key default gen_random_uuid(),
  client_ref   text not null unique,
  full_name    text not null check (length(trim(full_name)) > 0),
  username     text not null unique check (length(trim(username)) > 0),
  email        text not null unique check (position('@' in email) > 1),
  member_since date not null,
  member_id    text not null unique,
  initials     text not null check (char_length(initials) between 1 and 4),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.customers is
  'Riverbend account holders. Mirrors Account in src/account/auth.tsx. Never stores passwords.';

-- ============================================================================
-- 2. bank_accounts
-- ----------------------------------------------------------------------------
-- The app models balances as a fixed pair: balance.checking / balance.savings
-- (see `setUserBalance` which takes account: "checking" | "savings").
-- Modelling them as two ROWS rather than two COLUMNS keeps transactions
-- joinable to a real account row and lets a third product be added later
-- without a schema change. A unique (customer_id, kind) constraint preserves
-- the app's "exactly one checking, one savings per customer" invariant.
-- numeric(14,2) — never float for money.
-- ============================================================================
create table if not exists public.bank_accounts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind        text not null check (kind in ('checking', 'savings')),
  balance     numeric(14, 2) not null default 0 check (balance >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (customer_id, kind)
);

comment on table public.bank_accounts is
  'One row per customer per product type. Mirrors Account.balance { checking, savings }.';

-- ============================================================================
-- 3. cards
-- ----------------------------------------------------------------------------
-- Mirrors the `Card` type. Note the source app stores only `last4` — there is
-- no PAN, CVV, or full number anywhere, and this schema intentionally keeps it
-- that way. `cardholder_name` is nullable because the source type declares it
-- optional and the UI falls back to user.fullName when unset.
-- ============================================================================
create table if not exists public.cards (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  client_ref      text not null,
  label           text not null,
  last4           text not null check (last4 ~ '^[0-9]{4}$'),
  network         text not null check (network in ('Visa', 'Mastercard')),
  expiry          text not null check (expiry ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'),
  frozen          boolean not null default false,
  cardholder_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (customer_id, client_ref)
);

comment on table public.cards is
  'Customer cards. Stores last4 only — never a full card number. Mirrors Card in src/account/auth.tsx.';

-- ============================================================================
-- 4. transactions
-- ----------------------------------------------------------------------------
-- Mirrors the `Transaction` type. Signed `amount` matches the app convention
-- (credits positive, debits negative) so balances can be reconciled by SUM.
-- `account_kind` ties a transaction to the checking/savings row it affects.
--
-- `client_ref` holds the app's original id ("t1", "tx-1720...", "mv-...").
-- It is nullable and unique-per-customer so seed rows are idempotent while
-- runtime-generated transactions are still free to insert.
-- ============================================================================
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  client_ref   text,
  merchant     text not null,
  category     text not null,
  amount       numeric(14, 2) not null,
  occurred_on  date not null,
  account_kind text not null check (account_kind in ('checking', 'savings')),
  created_at   timestamptz not null default now(),
  unique (customer_id, client_ref)
);

comment on table public.transactions is
  'Signed-amount ledger rows. Mirrors Transaction in src/account/auth.tsx.';

-- ============================================================================
-- 5. site_content
-- ----------------------------------------------------------------------------
-- Every editable string on the site lives in ContentState (src/admin/store.tsx)
-- and is saved/replaced wholesale by `setContent`, plus exported/imported as
-- one JSON blob in the admin "Data" tab. That is a single document, not
-- relational rows — so it is stored as one jsonb value per slug.
--
-- Storing it as jsonb keeps the exact shape the app already serialises, so a
-- later wiring step can read/write it with no transformation layer. A CHECK
-- on jsonb_typeof guards against accidentally storing a scalar.
-- ============================================================================
create table if not exists public.site_content (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique default 'default',
  content    jsonb not null check (jsonb_typeof(content) = 'object'),
  updated_at timestamptz not null default now()
);

comment on table public.site_content is
  'Single-row CMS document preserving the app''s ContentState JSON shape (src/admin/store.tsx).';

-- ============================================================================
-- Indexes
-- ----------------------------------------------------------------------------
-- Foreign keys are NOT automatically indexed in Postgres; these cover the
-- lookups the app already performs (activity lists, card lists, balance reads).
-- ============================================================================
create index if not exists bank_accounts_customer_id_idx
  on public.bank_accounts (customer_id);

create index if not exists cards_customer_id_idx
  on public.cards (customer_id);

create index if not exists transactions_customer_id_idx
  on public.transactions (customer_id);

-- Recent-activity queries: filter by customer, order by date desc.
create index if not exists transactions_customer_occurred_on_idx
  on public.transactions (customer_id, occurred_on desc);

-- Per-account activity filter (Accounts.tsx filters by account kind).
create index if not exists transactions_customer_account_kind_idx
  on public.transactions (customer_id, account_kind, occurred_on desc);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists bank_accounts_set_updated_at on public.bank_accounts;
create trigger bank_accounts_set_updated_at
  before update on public.bank_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at
  before update on public.site_content
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ----------------------------------------------------------------------------
-- RLS is enabled on every table so that nothing is world-readable by default.
--
-- IMPORTANT — read this before wiring the app:
-- The current app has no Supabase Auth session. Its login is a browser-local
-- localStorage check comparing a plaintext password against a client-side
-- array. There is therefore no `auth.uid()` to scope rows to, and NO policy
-- below can distinguish Alex from Jordan.
--
-- The policies in section 7 are therefore DEMO-ONLY and TEMPORARY: they allow
-- the publishable (anon) key to read and write. They are a placeholder that
-- lets a later step be tested end-to-end, NOT a security boundary for real
-- customer data. They must be replaced with auth.uid()-scoped policies when
-- real authentication lands.
-- ============================================================================
alter table public.customers     enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.cards         enable row level security;
alter table public.transactions  enable row level security;
alter table public.site_content  enable row level security;

-- DELIBERATELY NOT FORCEd. Do not add `force row level security` here.
--
-- FORCE makes RLS apply to the table OWNER as well as to everyone else. On a
-- Supabase project the tables are owned by `postgres`, and the atomic transfer
-- functions in migration 002 are SECURITY DEFINER, so they execute as that
-- owner. With FORCE on, those functions would be subject to RLS for their own
-- writes and would fail at runtime; without it, the definer keeps its own
-- privileges and the transfers work. (`no force` is re-asserted below so a
-- project that ran an earlier draft of this file is corrected.)
alter table public.customers     no force row level security;
alter table public.bank_accounts no force row level security;
alter table public.cards         no force row level security;
alter table public.transactions  no force row level security;
alter table public.site_content  no force row level security;

-- ============================================================================
-- 6b. Table privileges for the browser roles
-- ----------------------------------------------------------------------------
-- RLS POLICIES AND SQL PRIVILEGES ARE TWO SEPARATE CHECKS. A policy decides
-- WHICH ROWS a role may touch; a GRANT decides whether the role may touch the
-- table at all. A table with policies but no GRANT is still "permission denied
-- for table ..." (SQLSTATE 42501).
--
-- On a fresh Supabase project, schema `public` carries default privileges that
-- hand `anon`/`authenticated` full table access, which is why the app can work
-- without this section. But that default is a project setting, not something
-- this repo controls, and it does not exist on a plain Postgres instance.
-- Granting explicitly makes the migrations self-sufficient and removes the
-- dependency on a setting we cannot see from here.
--
-- Scope: exactly the operations the app performs, no more.
--   * customers     SELECT (sign-in lookup, account load), UPDATE (admin
--                   credential edits)
--   * bank_accounts SELECT (balances), UPDATE (admin balance edits)
--   * cards         SELECT (card list), UPDATE (freeze/unfreeze, admin
--                   cardholder-name edits)
--   * transactions  SELECT (activity), INSERT (Send/Move ledger rows written
--                   by the SECURITY DEFINER functions in migration 002)
--   * site_content  SELECT (every page render), INSERT + UPDATE (the admin
--                   saves the whole document with an upsert)
--   * no DELETE anywhere - the admin "reset" writes the seed values back
--     instead of deleting rows, so nothing in the app needs it.
--
-- These grants are intentionally paired with the demo policies below: they let
-- the publishable key do its job and are NOT a security boundary. They must be
-- narrowed when real authentication replaces the demo login.
-- ============================================================================
grant usage on schema public to anon, authenticated;

grant select, update         on public.customers     to anon, authenticated;
grant select, update         on public.bank_accounts to anon, authenticated;
grant select, update         on public.cards         to anon, authenticated;
grant select, insert         on public.transactions  to anon, authenticated;
grant select, insert, update on public.site_content  to anon, authenticated;

-- No sequence privileges are needed: every primary key is a uuid defaulted via
-- gen_random_uuid(), so no app insert ever touches a sequence.

-- Verify the grants actually landed. A GRANT issued by a role that does not own
-- the object can silently do nothing, which would surface later as a
-- "permission denied" in the browser with no clue where it came from. This
-- turns that into a visible message in the SQL Editor instead.
do $$
declare
  problems text[] := '{}';
  t text;
begin
  if not has_schema_privilege('anon', 'public', 'usage') then
    problems := array_append(problems, 'anon cannot USE schema public');
  end if;

  foreach t in array array['customers', 'bank_accounts', 'cards', 'transactions', 'site_content']
  loop
    if not has_table_privilege('anon', format('public.%I', t), 'select') then
      problems := array_append(problems, format('anon cannot SELECT %s', t));
    end if;
  end loop;

  if not has_table_privilege('anon', 'public.cards', 'update') then
    problems := array_append(problems, 'anon cannot UPDATE cards');
  end if;
  if not has_table_privilege('anon', 'public.site_content', 'insert') then
    problems := array_append(problems, 'anon cannot INSERT site_content');
  end if;

  if array_length(problems, 1) is null then
    raise notice 'RIVERBEND 001: anon/authenticated privileges verified';
  else
    raise warning 'RIVERBEND 001: privileges missing -> %', array_to_string(problems, '; ');
  end if;
end;
$$;

-- ============================================================================
-- 7. TEMPORARY demo-only policies
-- ----------------------------------------------------------------------------
-- Broad anon access. Explicitly marked so they are trivial to find and drop.
-- Naming convention: <table>_demo_<operation>.
-- ============================================================================

-- --- customers -------------------------------------------------------------
drop policy if exists customers_demo_select on public.customers;
create policy customers_demo_select on public.customers
  for select to anon, authenticated using (true);

drop policy if exists customers_demo_update on public.customers;
create policy customers_demo_update on public.customers
  for update to anon, authenticated using (true) with check (true);

-- Insert is allowed so the seed can run from a client if ever needed,
-- but there is no DELETE policy: removing customers is intentionally not
-- possible from the browser.
drop policy if exists customers_demo_insert on public.customers;
create policy customers_demo_insert on public.customers
  for insert to anon, authenticated with check (true);

-- --- bank_accounts ---------------------------------------------------------
drop policy if exists bank_accounts_demo_select on public.bank_accounts;
create policy bank_accounts_demo_select on public.bank_accounts
  for select to anon, authenticated using (true);

drop policy if exists bank_accounts_demo_update on public.bank_accounts;
create policy bank_accounts_demo_update on public.bank_accounts
  for update to anon, authenticated using (true) with check (true);

-- --- cards -----------------------------------------------------------------
drop policy if exists cards_demo_select on public.cards;
create policy cards_demo_select on public.cards
  for select to anon, authenticated using (true);

-- The UI freezes/unfreezes cards and edits the cardholder name.
drop policy if exists cards_demo_update on public.cards;
create policy cards_demo_update on public.cards
  for update to anon, authenticated using (true) with check (true);

-- --- transactions ----------------------------------------------------------
drop policy if exists transactions_demo_select on public.transactions;
create policy transactions_demo_select on public.transactions
  for select to anon, authenticated using (true);

-- Send/Move append new transactions.
drop policy if exists transactions_demo_insert on public.transactions;
create policy transactions_demo_insert on public.transactions
  for insert to anon, authenticated with check (true);

-- --- site_content ----------------------------------------------------------
-- The CMS saves the whole document and can reset it to defaults.
drop policy if exists site_content_demo_select on public.site_content;
create policy site_content_demo_select on public.site_content
  for select to anon, authenticated using (true);

drop policy if exists site_content_demo_update on public.site_content;
create policy site_content_demo_update on public.site_content
  for update to anon, authenticated using (true) with check (true);

drop policy if exists site_content_demo_insert on public.site_content;
create policy site_content_demo_insert on public.site_content
  for insert to anon, authenticated with check (true);

-- ============================================================================
-- 8. DEMO SEED (idempotent)
-- ----------------------------------------------------------------------------
-- Generated directly from defaultAccounts (src/account/auth.tsx) and
-- defaultContent (src/admin/store.tsx) so values cannot drift from the app.
--
-- Idempotency strategy: every insert targets the natural key that already has
-- a UNIQUE constraint, and uses ON CONFLICT ... DO NOTHING. Re-running this
-- migration will never duplicate rows and will never overwrite edits made
-- after the first run.
--
-- No passwords are seeded. No admin credentials are seeded.
-- ============================================================================

-- ============ CUSTOMERS (passwords intentionally omitted) ============

-- ============ CUSTOMERS (passwords intentionally omitted) ============
insert into public.customers (id, client_ref, full_name, username, email, member_since, member_id, initials)
values ('00000000-0000-4000-8000-000000000001', 'demo-1', 'Alex Morgan', 'alex', 'alex@riverbend.bank', '2019-04-12', 'MBR-DEMO-1-001', 'AM')
on conflict (client_ref) do nothing;
insert into public.customers (id, client_ref, full_name, username, email, member_since, member_id, initials)
values ('00000000-0000-4000-8000-000000000002', 'demo-2', 'Jordan Reyes', 'jordan', 'jordan@riverbend.bank', '2022-09-30', 'MBR-DEMO-2-001', 'JR')
on conflict (client_ref) do nothing;

-- ============ BANK ACCOUNTS ============
insert into public.bank_accounts (id, customer_id, kind, balance)
values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'checking', 12480.50)
on conflict (customer_id, kind) do nothing;
insert into public.bank_accounts (id, customer_id, kind, balance)
values ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'savings', 38250.00)
on conflict (customer_id, kind) do nothing;
insert into public.bank_accounts (id, customer_id, kind, balance)
values ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'checking', 4210.75)
on conflict (customer_id, kind) do nothing;
insert into public.bank_accounts (id, customer_id, kind, balance)
values ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'savings', 11800.00)
on conflict (customer_id, kind) do nothing;

-- ============ CARDS ============
insert into public.cards (id, customer_id, client_ref, label, last4, network, expiry, frozen, cardholder_name)
values ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'c1', 'Everyday checking', '4218', 'Visa', '09/28', false, null)
on conflict (customer_id, client_ref) do nothing;
insert into public.cards (id, customer_id, client_ref, label, last4, network, expiry, frozen, cardholder_name)
values ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'c2', 'Travel rewards', '8830', 'Mastercard', '02/27', false, null)
on conflict (customer_id, client_ref) do nothing;
insert into public.cards (id, customer_id, client_ref, label, last4, network, expiry, frozen, cardholder_name)
values ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'c3', 'Joint savings', '1147', 'Visa', '11/26', true, null)
on conflict (customer_id, client_ref) do nothing;
insert into public.cards (id, customer_id, client_ref, label, last4, network, expiry, frozen, cardholder_name)
values ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'c4', 'Daily debit', '0092', 'Visa', '05/29', false, null)
on conflict (customer_id, client_ref) do nothing;
insert into public.cards (id, customer_id, client_ref, label, last4, network, expiry, frozen, cardholder_name)
values ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', 'c5', 'Backup credit', '5533', 'Mastercard', '08/27', false, null)
on conflict (customer_id, client_ref) do nothing;

-- ============ TRANSACTIONS ============
insert into public.transactions (id, customer_id, client_ref, merchant, category, amount, occurred_on, account_kind)
values ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 't1', 'Payroll · Northwind Group', 'Income', 3200.00, '2026-02-01', 'checking')
on conflict (customer_id, client_ref) do nothing;
insert into public.transactions (id, customer_id, client_ref, merchant, category, amount, occurred_on, account_kind)
values ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 't2', 'Coffee & Co.', 'Food', -4.80, '2026-02-02', 'checking')
on conflict (customer_id, client_ref) do nothing;
insert into public.transactions (id, customer_id, client_ref, merchant, category, amount, occurred_on, account_kind)
values ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 't3', 'Whole Foods', 'Groceries', -62.30, '2026-02-03', 'checking')
on conflict (customer_id, client_ref) do nothing;
insert into public.transactions (id, customer_id, client_ref, merchant, category, amount, occurred_on, account_kind)
values ('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 't4', 'Transfer to savings', 'Transfer', -500.00, '2026-02-04', 'checking')
on conflict (customer_id, client_ref) do nothing;
insert into public.transactions (id, customer_id, client_ref, merchant, category, amount, occurred_on, account_kind)
values ('30000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 't5', 'Spotify', 'Subscriptions', -11.99, '2026-02-05', 'checking')
on conflict (customer_id, client_ref) do nothing;
insert into public.transactions (id, customer_id, client_ref, merchant, category, amount, occurred_on, account_kind)
values ('30000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 't6', 'Vilnius → Riga train', 'Travel', -29.00, '2026-02-06', 'checking')
on conflict (customer_id, client_ref) do nothing;
insert into public.transactions (id, customer_id, client_ref, merchant, category, amount, occurred_on, account_kind)
values ('30000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 't7', 'Interest', 'Income', 84.12, '2026-02-07', 'savings')
on conflict (customer_id, client_ref) do nothing;
insert into public.transactions (id, customer_id, client_ref, merchant, category, amount, occurred_on, account_kind)
values ('30000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 't8', 'Gym membership', 'Health', -38.00, '2026-02-08', 'checking')
on conflict (customer_id, client_ref) do nothing;
insert into public.transactions (id, customer_id, client_ref, merchant, category, amount, occurred_on, account_kind)
values ('30000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002', 't9', 'Payroll · Freelance', 'Income', 1850.00, '2026-02-02', 'checking')
on conflict (customer_id, client_ref) do nothing;
insert into public.transactions (id, customer_id, client_ref, merchant, category, amount, occurred_on, account_kind)
values ('30000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000002', 't10', 'AWS', 'Software', -42.00, '2026-02-03', 'checking')
on conflict (customer_id, client_ref) do nothing;
insert into public.transactions (id, customer_id, client_ref, merchant, category, amount, occurred_on, account_kind)
values ('30000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002', 't11', 'Lunch', 'Food', -13.50, '2026-02-04', 'checking')
on conflict (customer_id, client_ref) do nothing;

-- ============ SITE CONTENT (single row, mirrors ContentState) ============
insert into public.site_content (slug, content)
values ('default', $rbjson${
  "brand": {
    "name": "RIVERBEND",
    "tagline": "A family financial business, globally rooted"
  },
  "hero": {
    "badge": "A family financial business, globally rooted",
    "headline": "Finance that flows",
    "headlineAccent": "with you.",
    "body": "RIVERBEND is a family-led financial group with a global footprint. We're building banking that listens first — and bends with the lives of the people we serve.",
    "primaryCta": "Contact us",
    "secondaryCta": "About RIVERBEND",
    "trustBadges": [
      "Headquartered in Vilnius",
      "Operating across 4 continents",
      "Family-led since day 1"
    ]
  },
  "contact": {
    "address": "Gedimino pr. 24, LT-01103 Vilnius, Lithuania",
    "phone": "+370 5 210 4500",
    "email": "support@riverbend.bank",
    "hours": "Mon – Fri · 8:00 – 20:00 (EET) · Sat 9:00 – 14:00",
    "reasons": [
      "Open a new account",
      "Account support",
      "Loans & credit",
      "Report an issue",
      "Partnership inquiry",
      "Other"
    ],
    "formIntro": "Fill in your details and tell us how we can help."
  },
  "about": {
    "eyebrow": "About RIVERBEND",
    "headline": "A family business, with the reach of a continent.",
    "intro": "RIVERBEND began as a single family office in Vilnius — a quiet promise to look after the people we love. Three generations later, that promise has grown into a global financial group, but the family values remain the same.",
    "storyEyebrow": "Our story",
    "storyHeadline": "Built on trust. Grown with care.",
    "storyParagraphs": [
      "What started as a family helping family — parents guiding children through their first savings account, siblings pooling resources for a first home — became a quiet revolution. We realized the best banking is the kind that listens before it speaks.",
      "Today, RIVERBEND operates across multiple continents, holding companies and partner institutions from the Baltics to Southeast Asia, Western Europe, and North America. Our conglomerate spans retail banking, wealth management, family-office services, and community development finance.",
      "Despite our scale, we remain family-led and family-hearted. Every account is opened with a handshake, every decision passes through a council that includes voices from the communities we serve, and every product is built to bend with the lives of real people."
    ],
    "values": [
      {
        "title": "Family first",
        "body": "Every product starts with the question: would we put our own family in this?"
      },
      {
        "title": "Global reach, local care",
        "body": "Our footprint spans continents, but every branch knows its neighbors by name."
      },
      {
        "title": "Quiet excellence",
        "body": "We measure success not in headlines, but in the lives we quietly improve."
      }
    ],
    "footprintEyebrow": "Our footprint",
    "footprintStats": [
      {
        "label": "Continents",
        "value": "4"
      },
      {
        "label": "Countries",
        "value": "23"
      },
      {
        "label": "Family offices",
        "value": "11"
      },
      {
        "label": "Members served",
        "value": "1.2M+"
      }
    ]
  },
  "signup": {
    "headline": "Become a RIVERBEND member.",
    "body": "Membership with RIVERBEND is opened in person — it's part of how we know our members and protect your account from day one."
  },
  "login": {
    "headline": "Welcome back.",
    "body": "Sign in to access your accounts."
  },
  "account": {
    "dashboard": {
      "welcomeEyebrow": "Welcome back",
      "quickActions": [
        {
          "label": "Send",
          "target": "send"
        },
        {
          "label": "Freeze",
          "target": "cards"
        },
        {
          "label": "Cards",
          "target": "cards"
        },
        {
          "label": "Profile",
          "target": "profile"
        }
      ],
      "recentHeading": "Recent activity",
      "recentSeeAll": "See all"
    },
    "accounts": {
      "heading": "Accounts",
      "sub": "Tap an account to see its activity.",
      "checkingLabel": "Checking",
      "savingsLabel": "Fixed savings",
      "activityHeading": "{account} activity",
      "emptyMessage": "No activity yet."
    },
    "cards": {
      "heading": "Cards",
      "sub": "Manage your debit and credit cards. Freeze anytime if misplaced.",
      "frozenBadge": "Frozen",
      "freezeButton": "Freeze",
      "unfreezeButton": "Unfreeze",
      "securityNote": "Freezing a card blocks new purchases and online transactions instantly. Recurring payments and ATM access are paused until you unfreeze.",
      "expiresLabel": "Expires"
    },
    "profile": {
      "netWorthLabel": "Net worth",
      "cardsLabel": "Cards",
      "memberSinceLabel": "Member since",
      "accountGroup": "Account",
      "securityGroup": "Security",
      "preferencesGroup": "Preferences",
      "usernameLabel": "Username",
      "emailLabel": "Email",
      "memberIdLabel": "Member ID",
      "twoFactorLabel": "Two-factor auth",
      "twoFactorEnabled": "Enabled",
      "lastSignInLabel": "Last sign-in",
      "changePasswordLabel": "Change password",
      "notificationsLabel": "Notifications",
      "languageLabel": "Language",
      "currencyLabel": "Currency",
      "signOutLabel": "Sign out of RIVERBEND",
      "sampleNote": "Sample account · Not a real financial institution"
    },
    "send": {
      "heading": "Send money",
      "sub": "Move funds to anyone, anywhere.",
      "fromLabel": "From",
      "toLabel": "To",
      "recipientNameLabel": "Recipient name",
      "recipientAccountLabel": "Recipient account number",
      "recipientBankLabel": "Recipient bank",
      "amountLabel": "Amount",
      "noteLabel": "Note (optional)",
      "submitLabel": "Send",
      "successHeadline": "Transfer sent.",
      "successBody": "Your transfer is on its way. We'll notify the recipient and update both accounts right away.",
      "fixedSavingsWarning": "Fixed savings cannot be sent from directly. Funds in your fixed savings are locked until maturity and can only be moved internally to your Checking account via the Move flow, where the term-break rules apply."
    },
    "move": {
      "heading": "Move money",
      "sub": "Transfer between your own accounts.",
      "fromLabel": "From",
      "toLabel": "To",
      "amountLabel": "Amount",
      "submitLabel": "Move funds",
      "successHeadline": "Funds moved.",
      "successBody": "Your transfer between accounts is complete and reflected in both balances.",
      "restrictionWarning": "Fixed savings funds are locked until maturity. Moving from Fixed savings to Checking will break the term and may incur a penalty. This action cannot be undone."
    },
    "login": {
      "submittingLabel": "Signing you in…",
      "successLabel": "Welcome back"
    }
  }
}$rbjson$::jsonb)
on conflict (slug) do nothing;
-- ============================================================================
-- 9. Post-seed verification (read-only, informational)
-- ----------------------------------------------------------------------------
-- Uses RAISE NOTICE so this migration never fails on a row count. Expected:
--   customers 2 | bank_accounts 4 | cards 5 | transactions 11 | site_content 1
-- ============================================================================
do $$
declare
  n_customers int;
  n_accounts  int;
  n_cards     int;
  n_txns      int;
  n_content   int;
begin
  select count(*) into n_customers from public.customers;
  select count(*) into n_accounts  from public.bank_accounts;
  select count(*) into n_cards     from public.cards;
  select count(*) into n_txns      from public.transactions;
  select count(*) into n_content   from public.site_content;

  raise notice 'RIVERBEND seed: % customers, % bank_accounts, % cards, % transactions, % site_content rows',
    n_customers, n_accounts, n_cards, n_txns, n_content;
end;
$$;
