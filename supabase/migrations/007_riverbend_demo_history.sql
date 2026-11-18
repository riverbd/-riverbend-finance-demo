-- ============================================================================
-- RIVERBEND FINANCE — 007 historical demonstration activity
-- ============================================================================
-- Purpose: the demo accounts have been open since 2019-04-12 (Alex) and
-- 2022-09-30 (Jordan), but their ledgers only start in February 2026. This
-- migration generates plausible demonstration activity from each customer's
-- real member_since month up to a per-customer cut-off month, and removes the
-- eight obsolete seeded rows that sit outside Alex's history window.
--
-- HISTORY WINDOWS
--   demo-1 (Alex)    2019-04-12 .. 2022-06-30  (cut-off: 2022-07-01)
--   demo-2 (Jordan)  2022-09-30 .. 2026-01-31  (cut-off: 2026-02-01)
--
--   The cut-off is the first date a customer must not have activity on. The
--   generated range stops the month before it, so a generated row can never sit
--   next to — or be mistaken for — a seeded or user-made one.
--
-- WHAT THIS MIGRATION DOES NOT DO
--   * It never updates or rewrites a transaction.
--   * It never touches bank_accounts. Balances are left exactly as they are.
--   * It deletes exactly eight rows, listed by id and client_ref below.
--   * It does not depend on "today": the newest generated month comes from the
--     per-customer cut-off, so re-running later cannot produce future rows.
--
-- HOW BALANCES AND HISTORY STAY CONSISTENT
--   bank_accounts.balance is a stored balance that the transfer functions move
--   when money actually moves (see 002/006). It was never the SUM of the
--   ledger, and this migration deliberately keeps that true: generated rows
--   carry historical dates only and the current balance is untouched, so no
--   balance changes by a single cent. Within the generated window the running
--   total never goes negative and the generated legs of an internal transfer
--   agree with each other.
--
-- FIXED SAVINGS
--   Generated rows are written to both accounts — checking and fixed savings —
--   because an internal move between a customer's own accounts is genuinely two
--   legs. Fixed Savings is nevertheless presented as locked in the customer
--   interface: src/account/Accounts.tsx renders its locked card before any list
--   is built, so no savings activity is ever displayed. That behaviour is
--   unchanged by this migration.
--
-- HOW DEMONSTRATION DATA IS IDENTIFIED
--   Every generated row sets is_demo = true and is labelled in the Checking
--   activity list. Rows written by the transfer functions keep the default of
--   false.
--
-- IDEMPOTENCE
--   Each generated row has a deterministic client_ref of
--   'hist-checking-<YYYY-MM>-<slot>' (or 'hist-savings-…'), which the existing
--   unique (customer_id, client_ref) constraint plus ON CONFLICT DO NOTHING
--   turns into a no-op on a second run. The deletion names all eight rows
--   individually and matches nothing once they are gone, so a re-run deletes
--   zero rows. Generation is additionally skipped when demonstration history is
--   already present.
--
-- TRANSACTIONALITY
--   The file opens with an explicit BEGIN and closes with COMMIT, so every
--   statement — the delete and all inserts included — is one unit: if anything
--   fails, nothing is applied. The generation also runs inside a single
--   PL/pgSQL DO block, which Postgres treats as one atomic statement on its own,
--   so the delete and the inserts can never be split even if a runner strips the
--   BEGIN/COMMIT. The temporary tables are ON COMMIT PRESERVE ROWS and are
--   written and read only inside that block; they fall back to session scope if
--   a runner wraps this file in a transaction of its own (an ON COMMIT DROP
--   table would be destroyed at the first statement boundary in that case).
--
--   The BEGIN/COMMIT lines exist for the SQL Editor. DDL here is transactional
--   in Postgres, so nothing in this file needs to run outside a transaction. If
--   you apply it with a CLI that manages transactions itself (e.g. `supabase db
--   push`), drop those two lines — the BEGIN then just "nests" and the COMMIT
--   closes the outer transaction early, which is undesirable.
--
-- Safety: no TRUNCATE, no DROP TABLE, no UPDATE of transaction or balance data,
-- and a single narrowly-scoped DELETE. Safe to re-run.
--
-- IF THIS FILE ABORTS
--   It aborts rather than committing anything it could not verify, so a failed
--   run leaves the database exactly as it was. Run this to see why:
--
--     select c.client_ref                       as customer,
--            t.client_ref                       as ref,
--            t.id                               as id,
--            t.occurred_on,
--            t.amount,
--            t.account_kind,
--            t.merchant,
--            t.is_demo
--       from public.transactions t
--       join public.customers c on c.id = t.customer_id
--      where c.client_ref = 'demo-1'
--      order by t.occurred_on, t.client_ref;
--
--   Send its output along with the error message. Nothing needs fixing by hand:
--   the file can be corrected and re-run, because it never applies a partial
--   change.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Mark generated history
-- ----------------------------------------------------------------------------
-- DEFAULT false means every row that already exists — and every row the
-- transfer functions insert later — is correctly classified as not-demo
-- without a backfill UPDATE touching a single row.
-- ----------------------------------------------------------------------------
alter table public.transactions
  add column if not exists is_demo boolean not null default false;

comment on column public.transactions.is_demo is
  'True only for generated demonstration history (migration 007). Never presented as a real financial record.';

-- The activity page reads one account, one month at a time, newest first.
create index if not exists transactions_activity_idx
  on public.transactions (customer_id, account_kind, occurred_on desc);

-- ----------------------------------------------------------------------------
-- 2. Retire Alex's eight obsolete seeded rows
-- ----------------------------------------------------------------------------
-- Alex's history is required to end on 2022-06-30, but the original seed gave
-- Alex eight rows dated 2026-02-01 .. 2026-02-08 (client_ref t1..t8, including
-- one interest row on fixed savings). They are removed here.
--
-- Three steps, each enforced rather than asserted:
--   2a. identify the eight rows and prove they are the rows this file expects,
--       aborting before any change if they are not;
--   2b. delete exactly the verified set;
--   2c. prove Alex has nothing left after 2022-06-30.
--
-- The deletion stays deliberately narrow: demo-1 only, an exact seeded
-- client_ref, a February 2026 date, not generated history, and every other
-- column equal to what the seed wrote. Generated history is excluded by
-- is_demo, Jordan's t9..t11 belong to a different customer, and a row the
-- customer creates later carries a null or user-supplied client_ref.

-- ----------------------------------------------------------------------------
-- 2a. Identify the eight rows, and prove they are the rows we think they are
-- ----------------------------------------------------------------------------
-- The eight seeded rows are identified by ALL of: Alex's customer id, the seeded
-- client_ref (t1..t8), a February 2026 date, the account kind, the amount and
-- the description the original seed wrote, and the seeded primary key. Every
-- one of those is checked, and a row must match all of them to be retired.
--
-- This is checked rather than assumed because a mismatch has two very different
-- causes that must not be treated the same way:
--
--   * the live database simply does not contain the rows this file was written
--     for (different ids, different amounts, a different seed run, a restore);
--   * the live database does, but something has altered them.
--
-- Either way the right response is to stop before changing anything and say
-- precisely which row is wrong and how, rather than to delete whatever happened
-- to match and carry on. A run that deletes nothing but still commits is the
-- exact failure this step exists to prevent.
--
-- rb_expected describes what the seed wrote; rb_candidate holds the rows that
-- match it on every column, and is the only thing the DELETE is allowed to
-- touch. If the two do not line up one-for-one, the migration aborts here.
-- ----------------------------------------------------------------------------
drop table if exists rb_expected;
create temporary table rb_expected on commit preserve rows as
select v.id::uuid  as id,
       v.client_ref,
       v.occurred_on,
       v.amount,
       v.account_kind,
       v.merchant
  from (values
    ('30000000-0000-4000-8000-000000000001', 't1', date '2026-02-01',  3200.00, 'checking', 'Payroll · Northwind Group'),
    ('30000000-0000-4000-8000-000000000002', 't2', date '2026-02-02',    -4.80, 'checking', 'Coffee & Co.'),
    ('30000000-0000-4000-8000-000000000003', 't3', date '2026-02-03',   -62.30, 'checking', 'Whole Foods'),
    ('30000000-0000-4000-8000-000000000004', 't4', date '2026-02-04',  -500.00, 'checking', 'Transfer to savings'),
    ('30000000-0000-4000-8000-000000000005', 't5', date '2026-02-05',   -11.99, 'checking', 'Spotify'),
    ('30000000-0000-4000-8000-000000000006', 't6', date '2026-02-06',   -29.00, 'checking', 'Vilnius → Riga train'),
    ('30000000-0000-4000-8000-000000000007', 't7', date '2026-02-07',    84.12, 'savings',  'Interest'),
    ('30000000-0000-4000-8000-000000000008', 't8', date '2026-02-08',   -38.00, 'checking', 'Gym membership')
  ) as v(id, client_ref, occurred_on, amount, account_kind, merchant);

-- Every non-generated row on Alex's account that carries a seeded reference.
-- These are the only rows under consideration; the DELETE cannot reach outside
-- this set, and this set is what the expectations are checked against.
drop table if exists rb_found;
create temporary table rb_found on commit preserve rows as
select t.id, t.client_ref, t.occurred_on, t.amount, t.account_kind, t.merchant
  from public.transactions t
  join public.customers c on c.id = t.customer_id
 where c.client_ref = 'demo-1'
   and t.is_demo = false
   and t.client_ref in (select client_ref from rb_expected);

-- The rows that match the seed exactly, on every column including the id. This
-- is precisely what the DELETE will remove.
drop table if exists rb_candidate;
create temporary table rb_candidate on commit preserve rows as
select f.id, f.client_ref
  from rb_found f
  join rb_expected e
    on e.id           = f.id
   and e.client_ref   = f.client_ref
   and e.occurred_on  = f.occurred_on
   and e.amount       = f.amount
   and e.account_kind = f.account_kind
   and e.merchant     = f.merchant;

-- Record every row that already exists, before this file changes anything.
-- The verification gate uses it to prove that no row was removed and none was
-- invented.
drop table if exists rb_preexisting;
create temporary table rb_preexisting on commit preserve rows as
select t.id, t.customer_id, t.client_ref, t.account_kind, t.occurred_on, t.amount
  from public.transactions t;

do $$
declare
  v_detail   text;
  v_total    int;
  v_feb      int;
  v_problems text[] := '{}';
begin
  -- A re-run on a database that already has the generated history is not a
  -- failure: an earlier run retired these eight rows and verified the result.
  -- Nothing is left to identify or delete, so this step is skipped rather than
  -- demanded — re-running must delete nothing and must not error. Step 2c still
  -- runs unconditionally, so Alex having nothing after 2022-06-30 is proven
  -- again on every run.
  if exists (select 1 from public.transactions where is_demo) then
    raise notice 'RIVERBEND 007: seeded rows already retired, nothing to delete';
    return;
  end if;

  -- (1) The exact expected set must be present. This is the check that catches
  --     "the live rows are not the rows this file was written for".
  select string_agg(e.client_ref, ', ' order by e.client_ref) into v_detail
    from rb_expected e
   where not exists (select 1 from rb_candidate k where k.id = e.id);
  if v_detail is not null then
    v_problems := v_problems || format(
      'seeded rows not found exactly as expected: %s', v_detail);
  end if;

  -- (2) For anything still unmatched, say how it differs. A row carrying the
  --     right client_ref but a different id is a different row; a row carrying
  --     the right id but a different amount has been altered. Both stop the
  --     migration, but the distinction is what makes the abort actionable.
  select string_agg(
           format('%s (%s)', f.client_ref,
                  case
                    when f.id <> e.id then 'id differs'
                    when f.occurred_on <> e.occurred_on then 'date differs'
                    when f.amount <> e.amount then 'amount differs'
                    when f.account_kind <> e.account_kind then 'account kind differs'
                    else 'description differs'
                  end),
           '; ' order by f.client_ref)
    into v_detail
    from rb_found f
    join rb_expected e on e.client_ref = f.client_ref
   where not exists (select 1 from rb_candidate k where k.id = f.id);
  if v_detail is not null then
    v_problems := v_problems || format('rows differ from the seed as follows: %s', v_detail);
  end if;

  -- (3) A seeded reference must appear at most once. Two matches would mean the
  --     delete is ambiguous.
  select string_agg(client_ref, ', ' order by client_ref) into v_detail
    from (select client_ref from rb_found group by client_ref having count(*) > 1) d;
  if v_detail is not null then
    v_problems := v_problems || format('more than one row matches each of: %s', v_detail);
  end if;

  -- (4) Alex's February 2026 rows must be exactly the eight. Anything else there
  --     is activity this file has no instruction for.
  select count(*) into v_feb
    from public.transactions t
    join public.customers c on c.id = t.customer_id
   where c.client_ref = 'demo-1'
     and t.is_demo = false
     and t.occurred_on >= date '2026-02-01'
     and t.occurred_on <  date '2026-03-01';
  if v_feb <> 8 then
    v_problems := v_problems || format(
      'demo-1 has %s non-generated row(s) in February 2026, expected 8', v_feb);
  end if;

  -- (5) The eight must be all that is left of Alex after 2022-06-30. Anything
  --     else dated later means Alex's history is not what this file assumes.
  select count(*) into v_total
    from public.transactions t
    join public.customers c on c.id = t.customer_id
   where c.client_ref = 'demo-1'
     and t.is_demo = false
     and t.occurred_on > date '2022-06-30'
     and not exists (select 1 from rb_candidate k where k.id = t.id);
  if v_total > 0 then
    v_problems := v_problems || format(
      '%s unexpected transaction(s) on demo-1 are dated after 2022-06-30', v_total);
  end if;

  -- A database with nothing left to retire is not a failure. If none of the
  -- eight are present AND Alex has no non-generated activity at all after
  -- 2022-06-30, there is demonstrably nothing here to delete, so step 2b is
  -- skipped and step 2c proves the result. This is what makes a re-run after
  -- the generated history has been cleared safe instead of an error.
  --
  -- The distinction matters: rows that are genuinely absent are quite different
  -- from rows that are present but wrong. The latter is a mismatch, reported
  -- below, and must stop the migration.
  if array_length(v_problems, 1) is not null then
    select count(*) into v_total
      from public.transactions t
      join public.customers c on c.id = t.customer_id
     where c.client_ref = 'demo-1'
       and t.is_demo = false
       and t.occurred_on > date '2022-06-30';

    if v_total = 0 then
      raise notice 'RIVERBEND 007: no seeded rows to retire, nothing to delete';
      return;
    end if;

    raise exception
      'RIVERBEND 007 aborted before deleting anything: %', array_to_string(v_problems, '; ');
  end if;

  raise notice 'RIVERBEND 007: all 8 seeded rows identified and verified';
end;
$$;

-- ----------------------------------------------------------------------------
-- 2b. Retire them
-- ----------------------------------------------------------------------------
-- Same narrow predicates as rb_candidate, plus the id: this deletes exactly the
-- rows just verified, no more. It cannot widen, because it selects from the
-- verified set rather than re-deriving one.
delete from public.transactions t
 using rb_candidate k
 where t.id = k.id;

-- ----------------------------------------------------------------------------
-- 2c. Prove the retirement was total
-- ----------------------------------------------------------------------------
-- Independent of the checks above: whatever identification happened to do,
-- Alex must have nothing left after 2022-06-30. This is the assertion that
-- makes a mis-identified deletion impossible to commit — including the failure
-- mode of the previous revision, where a different uuid meant the DELETE
-- matched nothing and the gate still passed.
do $$
declare
  v_late int;
begin
  select count(*) into v_late
    from public.transactions t
    join public.customers c on c.id = t.customer_id
   where c.client_ref = 'demo-1'
     and t.occurred_on > date '2022-06-30';

  if v_late > 0 then
    raise exception
      'RIVERBEND 007 aborted, nothing was committed: demo-1 still has % transaction(s) dated after 2022-06-30',
      v_late;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Generate the history
-- ----------------------------------------------------------------------------
-- Deterministic pseudo-randomness: md5 of a stable seed string, reduced to a
-- number in [0,1). Same database in, same history out — nothing here depends on
-- random(), so a re-run or a second environment cannot disagree.
-- ----------------------------------------------------------------------------
create or replace function public.riverbend_demo_unit(seed text)
returns numeric
language sql
immutable
as $$
  select ((('x' || substr(md5(seed), 1, 8))::bit(32)::bigint) % 1000)::numeric / 1000
$$;

comment on function public.riverbend_demo_unit(text) is
  'Deterministic [0,1) pseudo-random value used only to build demonstration history (migration 007).';

-- This helper computes values but reads and writes no data of its own. Revoking
-- the default PUBLIC grant keeps it off the anon/authenticated API surface.
revoke all on function public.riverbend_demo_unit(text) from public;

-- ----------------------------------------------------------------------------
-- 3a. The history windows (shared by generation and verification)
-- ----------------------------------------------------------------------------
-- `cutoff` is the first date that must have no activity; generation stops the
-- month before it. Both windows are explicit statements of product intent
-- rather than inferences from the current contents of the ledger, so the result
-- is the same in every environment and does not drift as real rows are added.
--
-- Defined once, here, so the verification block in step 4 asserts against the
-- same dates the generator was given rather than a second copy that could
-- drift from it.
--
-- These are session-scoped (ON COMMIT PRESERVE ROWS) and dropped first, so
-- re-running the file on the same connection — which is what the SQL Editor
-- does — cannot trip over "relation already exists".
-- ----------------------------------------------------------------------------
drop table if exists rb_window;
drop table if exists rb_range;
drop table if exists rb_income;
drop table if exists rb_tpl;

create temporary table rb_window on commit preserve rows as
with w as (
  select * from (values
    ('demo-1', 'Alex Morgan',   date '2022-07-01'),
    ('demo-2', 'Jordan Reyes',  date '2026-02-01')
  ) as v(client_ref, label, cutoff)
)
select c.id,
       c.client_ref,
       c.member_since,
       date_trunc('month', c.member_since)::date as open_month,
       date_trunc('month', w.cutoff)::date          as cutoff_month
  from public.customers c
  join w on w.client_ref = c.client_ref
 where date_trunc('month', w.cutoff) > date_trunc('month', c.member_since);


create temporary table rb_range on commit preserve rows as
select m.*, row_number() over (partition by m.id order by m.mon) as n
  from (
    select w.id, w.client_ref, w.member_since, w.open_month,
           g.mon::date as mon,
           (g.mon::date > w.open_month) as after_opening
      from rb_window w
     cross join lateral generate_series(
                w.open_month::timestamp,
                (w.cutoff_month - interval '1 month')::timestamp,
                interval '1 month') as g(mon)
  ) m;

-- Each customer's payroll, already present in their seeded rows, plus the
-- factor that scales every spending pattern to that income so the freelancer
-- on 1,850 is not charged the 3,200 salary's rent.
create temporary table rb_income on commit preserve rows as
select * from (values
  ('demo-1', 'Payroll · Northwind Group', 3200.00,  42.00, 1.000000),
  ('demo-2', 'Payroll · Freelance',       1850.00, 240.00, 0.578125)
) as v(client_ref, merchant, base, spread, factor);

-- Monthly patterns. `base` is a magnitude and `sgn` carries the direction, so
-- a spend can never come out as a credit. Days stay within 1..28 so a
-- generated row is always inside its own month, and `season` restricts a
-- pattern to the months it plausibly happens in.
create temporary table rb_tpl on commit preserve rows as
select * from (values
  -- Housing and the bills that come with it.
  ( 1, 'Housing',       'Rent · Vilnius apartment',    950.00,   0.00, -1,  3,  3, null::int[]),
  ( 2, 'Insurance',     'Home insurance',               42.00,   0.00, -1,  5,  5, null),
  ( 3, 'Utilities',     'Telia internet',               29.00,   0.00, -1,  6,  6, null),
  ( 4, 'Utilities',     'Mobile · Tele2',               18.00,   0.00, -1,  7,  7, null),
  ( 5, 'Utilities',     'Elektros tinklai',             61.20,  26.40, -1, 18, 22, null),
  -- Everyday living.
  ( 6, 'Groceries',     'Rimi Vilnius',                 62.40,  33.10, -1,  4,  9, null),
  ( 7, 'Groceries',     'Iki supermarket',              48.10,  21.60, -1, 21, 24, null),
  ( 8, 'Food',          'Coffee & Co.',                  4.60,   1.80, -1, 10, 14, null),
  ( 9, 'Food',          'Lunch',                        13.50,   6.20, -1, 26, 28, null),
  (10, 'Food',          'Restaurant · Ertlio namas',    78.40,  34.80, -1, 19, 22, null),
  (11, 'Transport',     'Vilnius public transport',     12.40,   8.20, -1, 20, 24, null),
  (12, 'Transport',     'Fuel · Circle K',              62.00,  28.00, -1, 23, 25, null),
  -- Subscriptions and health.
  (13, 'Subscriptions', 'Spotify',                      11.99,   0.00, -1, 15, 15, null),
  (14, 'Software',      'Adobe Creative Cloud',         24.99,   0.00, -1, 16, 16, null),
  (15, 'Health',        'Gym membership',               38.00,   0.00, -1, 17, 17, null),
  -- Discretionary, a refund, and the monthly savings sweep.
  (16, 'Shopping',      'Amazon',                       68.30,  51.70, -1, 25, 27, null),
  (17, 'Shopping',      'Bookstore · Vaga',             22.40,   9.60, -1, 12, 14, null),
  (18, 'Entertainment', 'Forum Cinemas',                24.00,  11.00, -1, 28, 28, null),
  (19, 'Charity',       'Donation · Caritas',           15.00,   0.00, -1, 11, 11, null),
  (20, 'Income',        'Refund · Amazon',              38.40,  26.10,  1, 12, 26, null),
  (21, 'Transfer',      'Transfer to Fixed savings',   240.00, 160.00, -1, 27, 28, null),
  -- Occasional, in the months they actually happen.
  (22, 'Travel',        'Ryanair · Vilnius',            92.00,  61.00, -1,  2, 12, array[6,7,8,12]),
  (23, 'Groceries',     'Christmas market',             84.00,  45.00, -1, 12, 20, array[12]),
  (24, 'Health',        'Pharmacy',                     21.30,  12.40, -1,  5, 25, array[1,2,11]),
  (25, 'Shopping',      'Zara',                         76.40,  38.20, -1,  3, 24, array[3,4,9,10]),
  (26, 'Travel',        'Vilnius → Riga train',         29.00,   0.00, -1,  6,  6, array[5,9])
) as v(slot, category, merchant, base, spread, sgn, day_lo, day_hi, season);

-- ----------------------------------------------------------------------------
-- 3b. Generate the history
-- ----------------------------------------------------------------------------
do $$
declare
  v_inserted int;
  v_total    int := 0;
begin
  if exists (select 1 from public.transactions where is_demo) then
    raise notice 'RIVERBEND 007: demonstration history already present — skipped';
    return;
  end if;


  -- ---- 3a. Spending rows ------------------------------------------------
  -- Written first because the opening deposit below is derived from them.
  insert into public.transactions
    (customer_id, client_ref, merchant, category, amount, occurred_on, account_kind, is_demo)
  select r.id,
         'hist-checking-' || to_char(r.mon, 'YYYY-MM') || '-' || t.slot::text,
         t.merchant,
         t.category,
         round(t.sgn * round((t.base
           + t.spread * public.riverbend_demo_unit(r.id::text || t.slot::text || r.mon::text || 'amt')) * i.factor, 2), 2),
         -- A day inside the month: start at day_hi, then step back by a seeded
         -- fraction of the [day_lo, day_hi] window.
         (r.mon + (t.day_hi - 1) * interval '1 day'
                - floor(public.riverbend_demo_unit(r.id::text || t.slot::text || r.mon::text || 'day')
                        * (t.day_hi - t.day_lo + 1)) * interval '1 day')::date,
         'checking',
         true
    from rb_range r
    join rb_tpl t
      on (t.season is null or extract(month from r.mon)::int = any (t.season))
    join rb_income i on i.client_ref = r.client_ref
   where r.after_opening
  on conflict (customer_id, client_ref) do nothing;

  get diagnostics v_inserted = row_count;
  v_total := v_total + v_inserted;

  -- ---- 3b. Salary, from the month after opening -------------------------
  -- The opening month has no salary: its opening deposit already covers that
  -- month, so a partial first month cannot double-count income.
  insert into public.transactions
    (customer_id, client_ref, merchant, category, amount, occurred_on, account_kind, is_demo)
  select r.id,
         'hist-checking-' || to_char(r.mon, 'YYYY-MM') || '-0',
         i.merchant,
         'Income',
         round(i.base + i.spread * public.riverbend_demo_unit(r.client_ref || r.mon::text || 'salary'), 2),
         (r.mon + interval '1 day')::date,   -- paid on the 1st
         'checking',
         true
    from rb_range r
    join rb_income i on i.client_ref = r.client_ref
   where r.after_opening
  on conflict (customer_id, client_ref) do nothing;

  get diagnostics v_inserted = row_count;
  v_total := v_total + v_inserted;

  -- ---- 3c. Paired savings credit for every savings transfer -------------
  -- Mirrors riverbend_transfer(): a negative leg on checking and a positive leg
  -- of the same amount on savings, same day, same description. Derived from the
  -- generated checking row so the two sides can never disagree.
  insert into public.transactions
    (customer_id, client_ref, merchant, category, amount, occurred_on, account_kind, is_demo)
  select t.customer_id,
         replace(t.client_ref, 'hist-checking-', 'hist-savings-in-'),
         t.merchant,
         'Transfer',
         -t.amount,
         t.occurred_on,
         'savings',
         true
    from public.transactions t
   where t.is_demo
     and t.account_kind = 'checking'
     and t.category = 'Transfer'
     and t.client_ref like 'hist-checking-%'
  on conflict (customer_id, client_ref) do nothing;

  get diagnostics v_inserted = row_count;
  v_total := v_total + v_inserted;

  -- ---- 3c-ii. Standing monthly transfer to the joint account -------------
  -- The one figure that is derived rather than chosen: whatever the generated
  -- months do not spend leaves the account for the household's joint account,
  -- spread evenly across them. That keeps income and outflow balanced, so the
  -- history neither accumulates an implausible surplus nor drifts into an
  -- overdraft. Direction follows the sign of the residual, so a customer
  -- spending more than they earn is topped up from the joint account rather
  -- than silently going negative.
  --
  -- A single leg, exactly as riverbend_send() writes for a transfer away. The
  -- `hist-out-` prefix keeps it out of the paired-leg copy above, which only
  -- pairs `hist-checking-` rows.
  insert into public.transactions
    (customer_id, client_ref, merchant, category, amount, occurred_on, account_kind, is_demo)
  select q.id,
         'hist-out-' || to_char(q.mon, 'YYYY-MM') || '-0',
         case when q.outbound >= 0 then 'Transfer to joint account'
              else 'Transfer from joint account' end,
         'Transfer',
         -q.outbound,
         (q.mon + interval '4 days')::date,
         'checking',
         true
    from (
      select r.id, r.mon,
             round(res.total / nullif(nm.n, 0), 2) as outbound
        from rb_range r
        join (select prev.customer_id as cid, sum(prev.amount) as total
                from public.transactions prev
               where prev.is_demo and prev.account_kind = 'checking'
               group by 1) res on res.cid = r.id
        join (select rr.id as cid, count(*) as n
                from rb_range rr
               where rr.after_opening
               group by 1) nm on nm.cid = r.id
       where r.after_opening
    ) q
  on conflict (customer_id, client_ref) do nothing;

  get diagnostics v_inserted = row_count;
  v_total := v_total + v_inserted;

  -- ---- 3d. Quarterly interest on fixed savings --------------------------
  -- Drifts upwards as the balance grows, so early years look thinner than
  -- recent ones the way a real term deposit would.
  insert into public.transactions
    (customer_id, client_ref, merchant, category, amount, occurred_on, account_kind, is_demo)
  select r.id,
         'hist-savings-int-' || to_char(r.mon, 'YYYY-MM') || '-0',
         'Interest',
         'Income',
         round(i.factor * (96.00 + (r.n * 0.85)
               + 22.00 * public.riverbend_demo_unit(r.client_ref || r.mon::text || 'int')), 2),
         (r.mon + interval '27 days')::date,
         'savings',
         true
    from rb_range r
    join rb_income i on i.client_ref = r.client_ref
   where r.after_opening
     and extract(month from r.mon)::int in (3, 6, 9, 12)
  on conflict (customer_id, client_ref) do nothing;

  get diagnostics v_inserted = row_count;
  v_total := v_total + v_inserted;

  -- ---- 3e. Opening deposits, sized from the generated history -----------
  -- Not an arbitrary figure: the deposit is what the generated rows would need
  -- on day one for the running total to stay above zero, plus a fixed float,
  -- rounded up to the nearest 100. A demo history therefore never implies an
  -- overdraft, and the deposit never disagrees with its own rows.
  insert into public.transactions
    (customer_id, client_ref, merchant, category, amount, occurred_on, account_kind, is_demo)
  select r.id,
         'hist-checking-open-0',
         'Opening deposit',
         'Income',
         greatest(0, ceil((-coalesce(min(p.running), 0) + 2000) / 100) * 100),
         r.member_since,
         'checking',
         true
    from rb_range r
    left join (
      select h.customer_id,
             h.account_kind,
             sum(h.amount) over (partition by h.customer_id, h.account_kind
                                 order by h.occurred_on, h.client_ref) as running
        from public.transactions h
       where h.is_demo
    ) p on p.customer_id = r.id and p.account_kind = 'checking'
   where r.mon = r.open_month
   group by r.id, r.member_since
  on conflict (customer_id, client_ref) do nothing;

  get diagnostics v_inserted = row_count;
  v_total := v_total + v_inserted;

  insert into public.transactions
    (customer_id, client_ref, merchant, category, amount, occurred_on, account_kind, is_demo)
  select r.id,
         'hist-savings-open-0',
         'Opening deposit',
         'Income',
         greatest(0, ceil((-coalesce(min(p.running), 0) + 2500) / 100) * 100),
         r.member_since,
         'savings',
         true
    from rb_range r
    left join (
      select h.customer_id,
             h.account_kind,
             sum(h.amount) over (partition by h.customer_id, h.account_kind
                                 order by h.occurred_on, h.client_ref) as running
        from public.transactions h
       where h.is_demo
    ) p on p.customer_id = r.id and p.account_kind = 'savings'
   where r.mon = r.open_month
   group by r.id, r.member_since
  on conflict (customer_id, client_ref) do nothing;

  get diagnostics v_inserted = row_count;
  v_total := v_total + v_inserted;

  raise notice 'RIVERBEND 007: inserted % demonstration rows', v_total;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Verification gate
-- ----------------------------------------------------------------------------
-- Expected shape:
--   demo-1  checking 2019-04-12 .. 2022-06   savings 2019-04-12 .. 2022-06
--   demo-2  checking 2022-09-30 .. 2026-01   savings 2022-09-30 .. 2026-01
--
-- Every assertion below is enforced. Any violation RAISEs, which aborts the
-- transaction: the DELETE of Alex's eight rows, the new is_demo column, the
-- index, the helper function and every generated row are all rolled back
-- together, leaving the database exactly as it was before the file ran. Nothing
-- is committed on a partial or suspicious result.
-- ----------------------------------------------------------------------------
do $$
declare
  v_overlap    int;
  v_early      int;
  v_overdrawn  int;
  v_late       int;
  v_demo       int;
  v_expected   int;
  v_jordan_bad int;
  v_jordan_ref int;
  v_problems   text[] := '{}';
begin
  -- (1) Zero overlapping months: no generated row may share or follow the month
  --     of a customer's own records.
  select count(*) into v_overlap
    from public.transactions t
   where t.is_demo
     and exists (select 1
                   from public.transactions r
                  where r.customer_id = t.customer_id
                    and not r.is_demo
                    and date_trunc('month', r.occurred_on) <= date_trunc('month', t.occurred_on));

  -- (2) Zero rows before either customer's opening date.
  select count(*) into v_early
    from public.transactions t
    join public.customers c on c.id = t.customer_id
   where t.is_demo and t.occurred_on < c.member_since;

  -- (3) Zero overdrawn points: the running balance may never dip below zero, in
  --     either account, at any point in the generated history.
  select count(*) into v_overdrawn
    from (
      select sum(t.amount) over (partition by t.customer_id, t.account_kind
                                 order by t.occurred_on, t.client_ref) as running
        from public.transactions t
       where t.is_demo
    ) x
   where x.running < 0;

  -- (4) Zero Alex rows after 2022-06-30 — ALL of them, with no exception for
  --     rows this file did not generate. Step 2c checks this immediately after
  --     the DELETE; this checks it again from inside the final gate, so neither
  --     check can pass while the other is wrong. Scoping this to "rows we are
  --     responsible for" (a previous revision) is exactly what let a run commit
  --     with Alex still holding late activity.
  select count(*) into v_late
    from public.transactions t
    join public.customers c on c.id = t.customer_id
   where c.client_ref = 'demo-1'
     and t.occurred_on > date '2022-06-30';

  -- (5) All expected generated history was inserted. The expected count is
  --     derived from the same window and pattern tables the generator used, so
  --     it cannot pass by accident: a skipped, truncated or duplicated insert
  --     all show up here. Recounted every run, so an idempotent re-run (no rows
  --     inserted the second time) is still verified against the real total.
  select count(*) into v_demo from public.transactions where is_demo;

  select
      -- two opening deposits per customer
      (select count(*) from rb_window) * 2
      -- one salary per month after the opening month
    + (select count(*) from rb_range where after_opening)
      -- spending: each month after opening times each in-season pattern
    + (select count(*)
         from rb_range r
         join rb_tpl t
           on (t.season is null
               or extract(month from r.mon)::int = any (t.season))
        where r.after_opening)
      -- the paired savings inflow for each savings transfer. The matching
      -- checking outflow is an ordinary slot-21 pattern row and is therefore
      -- already counted by the spending term above.
    + (select count(*)
             from rb_range r
             join rb_tpl t
               on t.slot = 21
              and (t.season is null
                   or extract(month from r.mon)::int = any (t.season))
            where r.after_opening)
      -- one joint transfer out per month after opening
    + (select count(*) from rb_range where after_opening)
      -- one interest credit per quarter
    + (select count(*) from rb_range
        where after_opening and extract(month from mon)::int in (3, 6, 9, 12))
    into v_expected;

  -- (6) Jordan's own transactions are untouched: same three rows, same ids,
  --     same dates, amounts and descriptions.
  select count(*) into v_jordan_bad
    from public.customers c
   where c.client_ref = 'demo-2'
     and not exists (
       select 1 from public.transactions t
        where t.customer_id = c.id
          and t.client_ref = 't9'
          and t.occurred_on = date '2026-02-02'
          and t.amount = 1850.00
          and t.account_kind = 'checking'
     );
  if v_jordan_bad > 0 then
    v_problems := v_problems || 'demo-2 is missing its original t9 row';
  end if;

  select count(*) into v_jordan_bad
    from public.customers c
   where c.client_ref = 'demo-2'
     and not exists (
       select 1 from public.transactions t
        where t.customer_id = c.id
          and t.client_ref = 't10'
          and t.occurred_on = date '2026-02-03'
          and t.amount = -42.00
          and t.account_kind = 'checking'
     );
  if v_jordan_bad > 0 then
    v_problems := v_problems || 'demo-2 is missing its original t10 row';
  end if;

  select count(*) into v_jordan_bad
    from public.customers c
   where c.client_ref = 'demo-2'
     and not exists (
       select 1 from public.transactions t
        where t.customer_id = c.id
          and t.client_ref = 't11'
          and t.occurred_on = date '2026-02-04'
          and t.amount = -13.50
          and t.account_kind = 'checking'
     );
  if v_jordan_bad > 0 then
    v_problems := v_problems || 'demo-2 is missing its original t11 row';
  end if;

  -- Jordan still owns exactly the three rows the seed gave them, and every row
  -- that existed before this file ran is still there, unchanged. Comparing
  -- against the snapshot rather than a hard-coded 3 keeps the assertion true
  -- for a re-run on a database a customer has since used.
  select count(*) into v_jordan_ref
    from public.transactions t
    join public.customers c on c.id = t.customer_id
   where c.client_ref = 'demo-2' and not t.is_demo
     and t.client_ref in ('t9','t10','t11');
  if v_jordan_ref <> 3 then
    v_problems := v_problems || format('demo-2 has %s original seeded rows, expected 3', v_jordan_ref);
  end if;

  select count(*) into v_jordan_bad
    from rb_preexisting p
   where not exists (select 1 from public.transactions t where t.id = p.id)
     and p.id not in (select id from rb_candidate);
  if v_jordan_bad > 0 then
    v_problems := v_problems || format(
      '%s pre-existing rows were removed (only the eight verified seeded rows may go)',
      v_jordan_bad);
  end if;

  -- Collect every failure before raising, so a single run reports all of them.
  if v_overlap > 0 then
    v_problems := v_problems || format('%s generated rows overlap existing record months', v_overlap);
  end if;
  if v_early > 0 then
    v_problems := v_problems || format('%s generated rows predate the account opening', v_early);
  end if;
  if v_overdrawn > 0 then
    v_problems := v_problems || format('%s points where the generated balance dips below zero', v_overdrawn);
  end if;
  if v_late > 0 then
    v_problems := v_problems || format('%s demo-1 rows are dated after 2022-06-30', v_late);
  end if;
  if v_demo <> v_expected then
    v_problems := v_problems || format('inserted %s generated rows, expected %s', v_demo, v_expected);
  end if;

  if array_length(v_problems, 1) is not null then
    raise exception 'RIVERBEND 007 aborted, nothing was committed: %',
      array_to_string(v_problems, '; ');
  end if;

  raise notice 'RIVERBEND 007 verified: % demonstration rows, 0 overlap, 0 early, 0 overdrawn, 0 late; demo-2 original rows intact',
    v_demo;
end;
$$;

commit;
