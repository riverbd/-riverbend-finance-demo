-- ============================================================================
-- RIVERBEND FINANCE — 008 backdate demo-1's activity and enable admin deletion
-- ============================================================================
-- Purpose: demo-1's ledger holds 19 transactions dated in 2026. This migration
-- re-dates them into the account's actual history window — 2019-04-19 to
-- 2022-06-30 — so the demo shows several years of activity instead of a few
-- days. It adds nothing, deletes nothing and changes no amount.
--
-- It also installs the one gated function the admin panel needs in order to
-- delete a single transaction.
--
-- ============================================================================
-- PART A — backdate the existing transactions
-- ============================================================================
-- WHAT IS CHANGED
--   Only transactions.occurred_on. Every other column of every row is left
--   exactly as it was: id, customer_id, client_ref, merchant, category, amount,
--   account_kind and created_at.
--
-- WHAT IS NOT CHANGED
--   * No transaction is inserted. The ledger keeps exactly the rows it has.
--   * No transaction is deleted here.
--   * bank_accounts is never read or written. Balances are stored values that
--     are not derived from the ledger, so re-dating rows cannot move them.
--   * demo-2 is not touched in any way.
--
-- WHO IS AFFECTED
--   Only the customer whose client_ref is 'demo-1'. The customer is identified
--   by client_ref alone — never by full_name, username, initials, email or
--   member_id, which are presentation fields an administrator may edit.
--
-- HOW THE DATES ARE ASSIGNED
--   The 19 rows are ordered by their existing occurred_on, then created_at,
--   then id — a total order, so the assignment is deterministic and keeps the
--   ledger's original sequence. Slot i of n gets
--
--     date = 2019-04-19 + round((i-1) * 1168 / (n-1))      days
--
--   where 1168 is the number of days between 2019-04-19 and 2022-06-30. That
--   puts the first row on 2019-04-19, the last on 2022-06-30, and spreads the
--   rest evenly (about 64 days apart). All 19 dates are distinct, so each row
--   remains individually identifiable.
--
-- VERIFICATION
--   Everything is checked before the update and again after it. Any discrepancy
--   raises, which aborts the transaction: the database is left exactly as it
--   was. Nothing is committed on a partial or unexpected result.
--
-- IDEMPOTENCE
--   If no demo-1 row is dated after 2022-06-30, this file has already been
--   applied: it reports that and skips the update, leaving the dates untouched.
--   Re-running therefore cannot re-space or shift the history.
--
-- IF THIS FILE ABORTS
--   It aborts rather than committing anything it could not verify, so a failed
--   run leaves the database unchanged. Run this to see what demo-1 actually
--   holds, and send the output along with the error message:
--
--     select t.occurred_on, t.merchant, t.category, t.amount, t.account_kind,
--            t.client_ref, t.id
--       from public.transactions t
--       join public.customers c on c.id = t.customer_id
--      where c.client_ref = 'demo-1'
--      order by t.occurred_on;
--
-- ============================================================================
-- PART B — admin transaction deletion
-- ============================================================================
-- The admin panel needs to remove a single transaction. public.transactions has
-- SELECT and INSERT policies only — there is intentionally no DELETE policy — so
-- a browser cannot delete a row directly. Instead this migration installs one
-- SECURITY DEFINER function, following the same pattern as
-- riverbend_admin_delete_message in 005:
--
--   * it does nothing unless riverbend_admin_ok(p_passphrase) passes;
--   * it deletes exactly one row, by primary key;
--   * it returns the number of rows removed, so the caller can distinguish
--     "deleted" from "already gone";
--   * it never reads or writes bank_accounts, so a customer's checking and
--     fixed-savings balances are unaffected by a deletion.
--
-- No RLS policy and no table permission is changed by this migration. The
-- function is the only path to a transaction delete, and it requires the admin
-- passphrase.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- A1. Snapshot every row before anything changes
-- ----------------------------------------------------------------------------
-- Used after the update to prove that only occurred_on moved, and that nothing
-- was added or removed. Session-scoped and dropped first, so re-running on the
-- same connection — which is what the SQL Editor does — is safe.
drop table if exists rb_before;
create temporary table rb_before on commit preserve rows as
select t.id,
       t.customer_id,
       t.client_ref,
       t.merchant,
       t.category,
       t.amount,
       t.account_kind,
       t.occurred_on,
       t.created_at
  from public.transactions t;

-- ----------------------------------------------------------------------------
-- A2. The rows to backdate, and the date each one receives
-- ----------------------------------------------------------------------------
drop table if exists rb_target;
create temporary table rb_target on commit preserve rows as
select row_number() over (order by t.occurred_on, t.created_at, t.id) as slot,
       t.id
  from public.transactions t
  join public.customers c on c.id = t.customer_id
 where c.client_ref = 'demo-1';

drop table if exists rb_newdate;
create temporary table rb_newdate on commit preserve rows as
select b.slot,
       b.id,
       date '2019-04-19'
         + round((b.slot - 1)::numeric
                 * (date '2022-06-30' - date '2019-04-19')
                 / greatest(n.n - 1, 1))::int as new_date
  from rb_target b
 cross join (select count(*) as n from rb_target) n;

-- ----------------------------------------------------------------------------
-- A3. Verify the plan before writing anything
-- ----------------------------------------------------------------------------
do $$
declare
  v_n        int;
  v_late     int;
  v_bad      int;
  v_distinct int;
  v_first    date;
  v_last     date;
  v_problems text[] := '{}';
begin
  -- Already applied? Then there is nothing dated after the cut-off and the
  -- history is already correct. Skip rather than re-space it.
  select count(*) into v_late
    from public.transactions t
    join public.customers c on c.id = t.customer_id
   where c.client_ref = 'demo-1'
     and t.occurred_on > date '2022-06-30';

  if v_late = 0 then
    perform set_config('riverbend008.applied', 'true', true);
    raise notice 'RIVERBEND 008: demo-1 history already inside the window, nothing to re-date';
    return;
  end if;

  select count(*) into v_n from rb_target;
  if v_n <> 19 then
    v_problems := v_problems || format('demo-1 has %s transaction(s), expected 19', v_n);
  end if;

  -- Every assigned date must be inside the window.
  select count(*) into v_bad
    from rb_newdate
   where new_date < date '2019-04-19' or new_date > date '2022-06-30';
  if v_bad > 0 then
    v_problems := v_problems || format('%s assigned date(s) fall outside the window', v_bad);
  end if;

  -- Strictly increasing, so the ordering is chronological and unambiguous.
  select count(*) into v_bad
    from (select new_date, lag(new_date) over (order by slot) as prev from rb_newdate) x
   where prev is not null and new_date <= prev;
  if v_bad > 0 then
    v_problems := v_problems || format('%s date(s) are not strictly increasing', v_bad);
  end if;

  -- Distinct dates, so no two rows are interchangeable.
  select count(distinct new_date) into v_distinct from rb_newdate;
  if v_distinct <> v_n then
    v_problems := v_problems || format('only %s distinct dates for %s rows', v_distinct, v_n);
  end if;

  -- The boundaries must be exact.
  select min(new_date), max(new_date) into v_first, v_last from rb_newdate;
  if v_first is distinct from date '2019-04-19' then
    v_problems := v_problems || format('first date is %s, expected 2019-04-19', v_first);
  end if;
  if v_last is distinct from date '2022-06-30' then
    v_problems := v_problems || format('last date is %s, expected 2022-06-30', v_last);
  end if;

  -- Nothing on demo-1 may already sit inside the window: the history is exactly
  -- the re-dated rows, not those plus something else.
  select count(*) into v_bad
    from public.transactions t
    join public.customers c on c.id = t.customer_id
   where c.client_ref = 'demo-1'
     and t.occurred_on <= date '2022-06-30';
  if v_bad > 0 then
    v_problems := v_problems || format(
      'demo-1 already has %s row(s) inside the 2019-2022 window', v_bad);
  end if;

  if array_length(v_problems, 1) is not null then
    raise exception 'RIVERBEND 008 aborted before changing anything: %',
      array_to_string(v_problems, '; ');
  end if;

  raise notice 'RIVERBEND 008: % rows to backdate, % .. %', v_n, v_first, v_last;
end;
$$;

-- ----------------------------------------------------------------------------
-- A4. Apply — occurred_on only
-- ----------------------------------------------------------------------------
do $$
begin
  if coalesce(current_setting('riverbend008.applied', true), 'false') = 'true' then
    return;
  end if;

  update public.transactions t
     set occurred_on = n.new_date
    from rb_newdate n
   where t.id = n.id;
end;
$$;

-- ----------------------------------------------------------------------------
-- A5. Prove the result
-- ----------------------------------------------------------------------------
do $$
declare
  v_late      int;
  v_changed   int;
  v_other     int;
  v_before    int;
  v_after     int;
  v_d2_before int;
  v_d2_after  int;
begin
  if coalesce(current_setting('riverbend008.applied', true), 'false') = 'true' then
    return;
  end if;

  -- Nothing on demo-1 may be dated after the cut-off.
  select count(*) into v_late
    from public.transactions t
    join public.customers c on c.id = t.customer_id
   where c.client_ref = 'demo-1'
     and t.occurred_on > date '2022-06-30';
  if v_late > 0 then
    raise exception
      'RIVERBEND 008 aborted, nothing was committed: % demo-1 row(s) dated after 2022-06-30', v_late;
  end if;

  -- Exactly the 19 target rows moved, and no more.
  select count(*) into v_changed
    from public.transactions t
    join rb_before b on b.id = t.id
   where t.occurred_on is distinct from b.occurred_on;
  if v_changed <> 19 then
    raise exception
      'RIVERBEND 008 aborted, nothing was committed: % row(s) changed date, expected 19', v_changed;
  end if;

  -- Nothing but the date may have moved on any row.
  select count(*) into v_other
    from public.transactions t
    join rb_before b on b.id = t.id
   where t.merchant     is distinct from b.merchant
      or t.category     is distinct from b.category
      or t.amount       is distinct from b.amount
      or t.account_kind is distinct from b.account_kind
      or t.client_ref   is distinct from b.client_ref
      or t.customer_id  is distinct from b.customer_id
      or t.created_at   is distinct from b.created_at;
  if v_other > 0 then
    raise exception
      'RIVERBEND 008 aborted, nothing was committed: % row(s) changed something other than the date', v_other;
  end if;

  -- No row was added or removed.
  select count(*) into v_before from rb_before;
  select count(*) into v_after from public.transactions;
  if v_after <> v_before then
    raise exception
      'RIVERBEND 008 aborted, nothing was committed: row count went % -> %', v_before, v_after;
  end if;

  -- demo-2 is untouched, in count and in content.
  select count(*) into v_d2_before
    from rb_before b join public.customers c on c.id = b.customer_id
   where c.client_ref = 'demo-2';
  select count(*) into v_d2_after
    from public.transactions t join public.customers c on c.id = t.customer_id
   where c.client_ref = 'demo-2'
     and t.id in (select id from rb_before);
  if v_d2_after <> v_d2_before then
    raise exception
      'RIVERBEND 008 aborted, nothing was committed: demo-2 changed % -> %', v_d2_before, v_d2_after;
  end if;

  raise notice 'RIVERBEND 008 verified: 19 rows backdated into 2019-04-19 .. 2022-06-30, no other column touched';
end;
$$;

-- ----------------------------------------------------------------------------
-- A6. Drop the working tables so nothing is left behind
-- ----------------------------------------------------------------------------
drop table if exists rb_newdate;
drop table if exists rb_target;
drop table if exists rb_before;

-- ----------------------------------------------------------------------------
-- B1. Admin: delete a single transaction
-- ----------------------------------------------------------------------------
create or replace function public.riverbend_admin_delete_transaction(
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

  -- Deletes the ledger row only. bank_accounts.balance is a stored value that
  -- this function never reads or writes, so the customer's checking and
  -- fixed-savings balances are unaffected.
  delete from public.transactions t where t.id = p_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.riverbend_admin_delete_transaction(text, uuid) is
  'Admin-only delete of a single transaction row. Never changes account balances.';

revoke all on function public.riverbend_admin_delete_transaction(text, uuid) from anon, authenticated, public;
grant execute on function public.riverbend_admin_delete_transaction(text, uuid) to anon, authenticated;

commit;
