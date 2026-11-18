-- ============================================================================
-- RIVERBEND FINANCE — 003 admin CMS support
-- ============================================================================
-- Makes Supabase the shared source of truth for the admin dashboard:
--
--   * website content  -> public.site_content   (already created in 001)
--   * customer profile -> public.customers
--   * balances         -> public.bank_accounts
--   * cardholder names -> public.cards
--   * credentials      -> public.customers (incl. password, see the note below)
--
-- Only additive. No DROP TABLE, no TRUNCATE, no DELETE.
-- ============================================================================

-- ============================================================================
-- 1. Demo password storage
-- ----------------------------------------------------------------------------
-- SECURITY NOTE — READ BEFORE USING REAL DATA
-- The admin dashboard's "Credentials" tab edits a per-customer password, and
-- requirement says that capability is preserved. Postgres therefore has to hold
-- it. It is stored as PLAINTEXT in a column named `demo_password` so that it can
-- never be mistaken for a hashed credential.
--
-- This is acceptable only because these are synthetic demo accounts. Before any
-- real customer data is loaded, this column must be removed and sign-in moved
-- to Supabase Auth (bcrypt/argon2 handled by GoTrue, never by this table).
--
-- The column is deliberately NOT selected by the customer-facing reads; only
-- the admin dashboard and the demo sign-in path read it.
-- ============================================================================
alter table public.customers
  add column if not exists demo_password text;

comment on column public.customers.demo_password is
  'PLAINTEXT demo-only password. Must be dropped before real customer data; replace with Supabase Auth.';

-- Seed the two demo accounts so sign-in keeps working before an admin edit.
update public.customers
set demo_password = 'demo1234'
where demo_password is null
  and client_ref in ('demo-1', 'demo-2');

-- ============================================================================
-- 2. Content read/write surface
-- ----------------------------------------------------------------------------
-- site_content already has slug-keyed rows with insert/select/update policies
-- from migration 001, which is exactly what the admin's full-document save
-- needs. This migration only adds a guard so a content row can never be stored
-- as a non-object, and a uniqueness guarantee on the slug the upsert targets.
-- ============================================================================
create unique index if not exists site_content_slug_key
  on public.site_content (slug);

comment on table public.site_content is
  'Single-document CMS store. The `content` jsonb mirrors ContentState from src/admin/store.tsx exactly.';

-- Constraint: the document must carry the seven top-level sections the app
-- renders. This catches a truncated or malformed import at write time rather
-- than letting it reach a customer page.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_content_has_all_sections'
  ) then
    alter table public.site_content
      add constraint site_content_has_all_sections check (
        content ?& array['brand','hero','contact','about','signup','login','account']
      );
  end if;
end;
$$;

-- ============================================================================
-- 3. Admin write policies
-- ----------------------------------------------------------------------------
-- No additional policies or grants are needed here.
--
-- Migration 001 section 6b grants the browser roles exactly the privileges the
-- admin dashboard uses:
--   * customers     select, update   -> credential / profile edits
--   * bank_accounts select, update   -> balance edits
--   * cards         select, update   -> cardholder-name edits
--   * site_content  select, insert, update -> the wholesale content upsert
-- and section 7 adds the matching demo policies.
--
-- No DELETE is granted anywhere - and none is needed: "Reset all data" writes
-- the seeded values back rather than dropping rows, so the dashboard never
-- requires a delete privilege.
--
-- These remain the SAME temporary demo-only policies: they do not distinguish
-- an admin from a customer, because there is no real auth session yet.
-- ============================================================================

-- ============================================================================
-- 4. Verification (read-only, informational)
-- ============================================================================
do $$
declare
  n_pwd    int;
  n_sect   int;
begin
  select count(*) into n_pwd from public.customers where demo_password is not null;
  select count(*) into n_sect from public.site_content
    where content ?& array['brand','hero','contact','about','signup','login','account'];

  raise notice 'RIVERBEND 003: % customer(s) with demo password, % content row(s) with all 7 sections',
    n_pwd, n_sect;
end;
$$;
