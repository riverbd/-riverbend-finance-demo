-- ============================================================================
-- RIVERBEND FINANCE — 007 historical demonstration activity
-- ============================================================================
-- Purpose: the demo accounts have been open since 2019-04-12 (Alex) and
-- 2022-09-30 (Jordan), but their ledgers only start in February 2026. This
-- migration generates plausible demonstration activity from each customer's
-- real member_since month up to — but never into — the month their existing
-- records begin.
--
-- WHAT THIS MIGRATION DOES NOT DO
--   * It never updates, deletes or rewrites an existing transaction.
--   * It never touches bank_accounts. Balances are left exactly as they are.
--   * It does not decide what "today" means: the newest generated month is
--     derived from each customer's own earliest real row, so re-running this
--     against a database that has since grown still produces no future rows.
--
-- HOW BALANCES AND HISTORY STAY CONSISTENT
--   bank_accounts.balance is a stored balance that the transfer functions move
--   when money actually moves (see 002/006). It was never the SUM of the
--   ledger, and this migration deliberately keeps that true: generated rows
--   carry historical dates only and the current balance is untouched, so no
--   balance changes by a single cent.
--
--   What the generated history does reconcile against is itself. Within the
--   generated window every savings deposit is written twice — a negative leg
--   on checking and a matching positive leg on savings, same day, same
--   description — exactly the shape riverbend_transfer() uses for a real
--   internal move. The two sides therefore always agree, and both account
--   sums are reproducible from the same deterministic generator (see the
--   checks in supabase/migrations/007 verification block and the m7 suite).
--
-- HOW DEMONSTRATION DATA IS IDENTIFIED
--   Every generated row sets is_demo = true. The application labels those rows
--   in the Checking activity list, so generated history is never presented as a
--   genuine financial record. Rows written by the transfer functions keep the
--   column default of false.
--
-- IDEMPOTENCE
--   Each generated row has a deterministic client_ref of
--   'hist-checking-<YYYY-MM>-<slot>' (or 'hist-savings-…'), which the existing
--   unique (customer_id, client_ref) constraint plus ON CONFLICT DO NOTHING
--   turns into a no-op on a second run. The whole block is additionally skipped
--   when demonstration history is already present.
--
-- Safety: no DROP TABLE, no TRUNCATE, no DELETE, no UPDATE of transaction or
-- balance data. Safe to re-run.
-- ============================================================================

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
-- 2. Generate the history
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

do $$
declare
  v_inserted int;
  v_total    int := 0;
begin
  if exists (select 1 from public.transactions where is_demo) then
    raise notice 'RIVERBEND 007: demonstration history already present — skipped';
    return;
  end if;

  -- The set of (customer, month) pairs to generate, and where each customer's
  -- real records begin. A customer with no existing records is skipped: there
  -- is no opening period to extend towards, and inventing one could later
  -- collide with a genuine first transaction. Both demo customers have records.
  create temporary table rb_range on commit drop as
  with cust as (
    select c.id,
           c.client_ref,
           c.member_since,
           date_trunc('month', c.member_since)::date as open_month,
           (select date_trunc('month', min(t.occurred_on))::date
              from public.transactions t
             where t.customer_id = c.id
               and not t.is_demo) as cutoff_month
      from public.customers c
  ),
  months as (
    select cu.id, cu.client_ref, cu.member_since, cu.open_month,
           g.mon::date as mon,
           (g.mon::date > cu.open_month) as after_opening
      from cust cu
     cross join lateral generate_series(
                cu.open_month::timestamp,
                (cu.cutoff_month - interval '1 month')::timestamp,
                interval '1 month') as g(mon)
     where cu.cutoff_month is not null
       and cu.cutoff_month > cu.open_month
  )
  select m.*, row_number() over (partition by m.id order by m.mon) as n
    from months m;

  -- Each customer's payroll, already present in their seeded rows, plus the
  -- factor that scales every spending pattern to that income so the freelancer
  -- on 1,850 is not charged the 3,200 salary's rent.
  create temporary table rb_income on commit drop as
  select * from (values
    ('demo-1', 'Payroll · Northwind Group', 3200.00,  42.00, 1.000000),
    ('demo-2', 'Payroll · Freelance',       1850.00, 240.00, 0.578125)
  ) as v(client_ref, merchant, base, spread, factor);

  -- Monthly patterns. `base` is a magnitude and `sgn` carries the direction, so
  -- a spend can never come out as a credit. Days stay within 1..28 so a
  -- generated row is always inside its own month, and `season` restricts a
  -- pattern to the months it plausibly happens in.
  create temporary table rb_tpl on commit drop as
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

  -- ---- 2a. Spending rows ------------------------------------------------
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

  -- ---- 2b. Salary, from the month after opening -------------------------
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

  -- ---- 2c. Paired savings credit for every savings transfer -------------
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

  -- ---- 2c-ii. Standing monthly transfer to the joint account -------------
  -- The one figure that is derived rather than chosen: whatever the generated
  -- months do not spend leaves the account for the household's joint account,
  -- spread evenly across them. That keeps income and outflow balanced, so the
  -- history neither accumulates an implausible six-figure surplus nor drifts
  -- into an overdraft. Direction follows the sign of the residual, so a
  -- customer spending more than they earn is topped up from the joint account
  -- rather than silently going negative.
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

  -- ---- 2d. Quarterly interest on fixed savings --------------------------
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

  -- ---- 2e. Opening deposits, sized from the generated history -----------
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
-- 3. Verification (read-only, informational)
-- ----------------------------------------------------------------------------
-- Expected shape on a freshly seeded database:
--   demo-1  checking 2019-04-12 .. 2026-01   savings 2019-04-12 .. 2026-01
--   demo-2  checking 2022-09-30 .. 2026-01   savings 2022-09-30 .. 2026-01
-- No generated row may share or follow the month of an existing record, and no
-- generated row may predate the account.
-- ----------------------------------------------------------------------------
do $$
declare
  v_overlap  int;
  v_early    int;
  v_overdrawn int;
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

  if v_overlap > 0 then
    raise warning 'RIVERBEND 007: % demonstration rows overlap existing record months', v_overlap;
  end if;
  if v_early > 0 then
    raise warning 'RIVERBEND 007: % demonstration rows predate the account opening', v_early;
  end if;

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

  if v_overdrawn > 0 then
    raise warning 'RIVERBEND 007: % points where demonstration history dips below zero', v_overdrawn;
  end if;

  raise notice 'RIVERBEND 007: % demonstration rows total, % overlap, % early, % overdrawn',
    (select count(*) from public.transactions where is_demo), v_overlap, v_early, v_overdrawn;
end;
$$;
