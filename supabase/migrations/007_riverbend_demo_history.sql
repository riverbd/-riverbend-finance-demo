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
-- This is deliberately narrow. Every row is named by its uuid AND its
-- client_ref, scoped to demo-1, to a February 2026 date, and to is_demo = false.
-- Nothing else can match:
--   * generated history (is_demo = true) is excluded,
--   * Jordan's t9..t11 belong to a different customer,
--   * any row the customer creates later has a null or user-supplied client_ref
--     and dates far from February 2026.
-- Once the eight rows are gone this statement matches nothing, so re-running
-- deletes nothing.
-- ----------------------------------------------------------------------------
delete from public.transactions t
 using public.customers c
 where t.customer_id = c.id
   and c.client_ref = 'demo-1'
   and t.is_demo = false
   and t.client_ref in ('t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8')
   and t.id in (
     '30000000-0000-4000-8000-000000000001',
     '30000000-0000-4000-8000-000000000002',
     '30000000-0000-4000-8000-000000000003',
     '30000000-0000-4000-8000-000000000004',
     '30000000-0000-4000-8000-000000000005',
     '30000000-0000-4000-8000-000000000006',
     '30000000-0000-4000-8000-000000000007',
     '30000000-0000-4000-8000-000000000008'
   )
   and t.occurred_on >= date '2026-02-01'
   and t.occurred_on <  date '2026-03-01';

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

do $$
declare
  v_inserted int;
  v_total    int := 0;
begin
  if exists (select 1 from public.transactions where is_demo) then
    raise notice 'RIVERBEND 007: demonstration history already present — skipped';
    return;
  end if;

  -- The per-customer history window. `cutoff` is the first date that must have
  -- no activity; generation stops the month before it. Both windows are
  -- explicit statements of product intent rather than inferences from the
  -- current contents of the ledger, so the result is the same in every
  -- environment and does not drift as real rows are added.
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
-- 4. Verification (read-only, informational)
-- ----------------------------------------------------------------------------
-- Expected shape on a freshly seeded database:
--   demo-1  checking 2019-04-12 .. 2022-06   savings 2019-04-12 .. 2022-06
--   demo-2  checking 2022-09-30 .. 2026-01   savings 2022-09-30 .. 2026-01
-- Alex must have no row at all after 2022-06-30, generated or otherwise.
-- ----------------------------------------------------------------------------
do $$
declare
  v_overlap   int;
  v_early     int;
  v_overdrawn int;
  v_late      int;
begin
  select count(*) into v_overlap
    from public.transactions t
   where t.is_demo
     and exists (select 1
                   from public.transactions r
                  where r.customer_id = t.customer_id
                    and not r.is_demo
                    and date_trunc('month', r.occurred_on) <= date_trunc('month', t.occurred_on));

  select count(*) into v_early
    from public.transactions t
    join public.customers c on c.id = t.customer_id
   where t.is_demo and t.occurred_on < c.member_since;

  -- The running total may never dip below zero: a demo ledger should not imply
  -- an overdraft the customer could not have had.
  select count(*) into v_overdrawn
    from (
      select t.customer_id,
             sum(t.amount) over (partition by t.customer_id, t.account_kind
                                 order by t.occurred_on, t.client_ref) as running
        from public.transactions t
       where t.is_demo
    ) x
   where x.running < 0;

  -- A customer whose history has been closed off must have nothing after it.
  select count(*) into v_late
    from public.transactions t
    join public.customers c on c.id = t.customer_id
   where c.client_ref = 'demo-1' and t.occurred_on > date '2022-06-30';

  if v_overlap > 0 then
    raise warning 'RIVERBEND 007: % demonstration rows overlap existing record months', v_overlap;
  end if;
  if v_early > 0 then
    raise warning 'RIVERBEND 007: % demonstration rows predate the account opening', v_early;
  end if;
  if v_overdrawn > 0 then
    raise warning 'RIVERBEND 007: % points where demonstration history dips below zero', v_overdrawn;
  end if;
  if v_late > 0 then
    raise warning 'RIVERBEND 007: % demo-1 rows are dated after 2022-06-30', v_late;
  end if;

  raise notice 'RIVERBEND 007: % demonstration rows total, % overlap, % early, % overdrawn, % late',
    (select count(*) from public.transactions where is_demo), v_overlap, v_early, v_overdrawn, v_late;
end;
$$;

commit;
