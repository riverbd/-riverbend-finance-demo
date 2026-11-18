-- ============================================================================
-- RIVERBEND FINANCE — 002 atomic customer banking operations
-- ============================================================================
-- Adds the transactional primitives the customer banking UI needs, so that a
-- money movement can never leave balances and the ledger out of step.
--
-- Why a database function instead of doing this from the browser:
--   Debiting one account, crediting another, and writing the ledger rows are
--   three separate statements. Issued individually from the client they can
--   partially succeed (debit lands, credit fails) or interleave with a second
--   request and lose an update. Inside a single plpgsql function the whole
--   body is one implicit transaction, and the SELECT ... FOR UPDATE row locks
--   serialise concurrent callers on the same account.
--
-- Concurrency notes:
--   * Both balance rows are locked with FOR UPDATE before they are read, so the
--     balance check and the decrement cannot be separated by another writer.
--   * riverbend_transfer locks its two rows ORDER BY kind so that two
--     simultaneous opposing transfers (checking->savings and savings->checking)
--     acquire locks in the same order and cannot deadlock.
--
-- SECURITY DEFINER + pinned search_path:
--   These run as the function owner so they can write bank_accounts and
--   transactions regardless of the anon RLS policies, and a pinned search_path
--   stops a caller from shadowing the tables they resolve against.
--
-- Nothing here is destructive: no DROP TABLE, no TRUNCATE, no DELETE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Internal: assert the amount is a usable positive money value.
-- ----------------------------------------------------------------------------
create or replace function public.riverbend_assert_amount(p_amount numeric)
returns void
language plpgsql
immutable
as $$
begin
  if p_amount is null then
    raise exception 'Amount is required.' using errcode = '22023';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero.' using errcode = '22023';
  end if;
  -- numeric(14,2) holds at most 12 integer digits.
  if p_amount <> round(p_amount, 2) then
    raise exception 'Amount cannot have more than two decimal places.' using errcode = '22023';
  end if;
  if p_amount >= 1000000000000 then
    raise exception 'Amount is too large.' using errcode = '22023';
  end if;
end;
$$;

-- ============================================================================
-- riverbend_send
-- ----------------------------------------------------------------------------
-- Debits one account and writes a single negative ledger row — the shape the
-- existing Send flow already produced (`amount: -amt`, category "Transfer").
--
-- Returns the id of the ledger row it created.
-- ============================================================================
create or replace function public.riverbend_send(
  p_customer   uuid,
  p_from       text,
  p_amount     numeric,
  p_merchant   text,
  p_occurred_on date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(14, 2);
  v_tx_id   uuid;
begin
  perform public.riverbend_assert_amount(p_amount);

  if p_from is null or p_from not in ('checking', 'savings') then
    raise exception 'Unknown source account "%".', coalesce(p_from, 'null')
      using errcode = '22023';
  end if;

  if p_merchant is null or length(trim(p_merchant)) = 0 then
    raise exception 'A transaction description is required.' using errcode = '22023';
  end if;

  -- Lock the row before reading so the check below cannot race a concurrent debit.
  select balance into v_balance
  from public.bank_accounts
  where customer_id = p_customer and kind = p_from
  for update;

  if not found then
    raise exception 'Account not found for this customer.' using errcode = 'P0002';
  end if;

  if v_balance < p_amount then
    raise exception 'Insufficient funds: % account has %, requested %.',
      p_from, to_char(v_balance, 'FM999999999990.00'), to_char(p_amount, 'FM999999999990.00')
      using errcode = 'P0001';
  end if;

  update public.bank_accounts
  set balance = balance - p_amount
  where customer_id = p_customer and kind = p_from;

  insert into public.transactions
    (customer_id, merchant, category, amount, occurred_on, account_kind)
  values
    (p_customer, p_merchant, 'Transfer', -p_amount,
     coalesce(p_occurred_on, current_date), p_from)
  returning id into v_tx_id;

  return v_tx_id;
end;
$$;

comment on function public.riverbend_send(uuid, text, numeric, text, date) is
  'Atomically debits one account and appends a negative ledger row. Raises on insufficient funds.';

-- ============================================================================
-- riverbend_transfer
-- ----------------------------------------------------------------------------
-- Moves money between a customer's own checking and savings accounts.
--
-- Writes TWO ledger legs (a debit on the source, a credit on the destination)
-- so the ledger reconciles against balances via SUM. This is invisible in the
-- existing UI: the Accounts screen only ever lists checking rows, and the
-- savings activity view is a fixed "locked" panel.
-- ============================================================================
create or replace function public.riverbend_transfer(
  p_customer    uuid,
  p_from        text,
  p_to          text,
  p_amount      numeric,
  p_merchant    text,
  p_occurred_on date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance   numeric(14, 2);
  v_leg_id    uuid;
  v_day       date := coalesce(p_occurred_on, current_date);
  v_locked    int;
begin
  perform public.riverbend_assert_amount(p_amount);

  if p_from is null or p_from not in ('checking', 'savings') then
    raise exception 'Unknown source account "%".', coalesce(p_from, 'null')
      using errcode = '22023';
  end if;

  if p_to is null or p_to not in ('checking', 'savings') then
    raise exception 'Unknown destination account "%".', coalesce(p_to, 'null')
      using errcode = '22023';
  end if;

  if p_from = p_to then
    raise exception 'Source and destination accounts must be different.'
      using errcode = '22023';
  end if;

  if p_merchant is null or length(trim(p_merchant)) = 0 then
    raise exception 'A transaction description is required.' using errcode = '22023';
  end if;

  -- Lock BOTH rows in a deterministic order (see header note on deadlocks).
  select count(*) into v_locked
  from (
    select balance
    from public.bank_accounts
    where customer_id = p_customer and kind in (p_from, p_to)
    order by kind
    for update
  ) locked;

  if v_locked <> 2 then
    raise exception 'Both accounts must exist for this customer.' using errcode = 'P0002';
  end if;

  select balance into v_balance
  from public.bank_accounts
  where customer_id = p_customer and kind = p_from;

  if v_balance < p_amount then
    raise exception 'Insufficient funds: % account has %, requested %.',
      p_from, to_char(v_balance, 'FM999999999990.00'), to_char(p_amount, 'FM999999999990.00')
      using errcode = 'P0001';
  end if;

  update public.bank_accounts
  set balance = balance - p_amount
  where customer_id = p_customer and kind = p_from;

  update public.bank_accounts
  set balance = balance + p_amount
  where customer_id = p_customer and kind = p_to;

  -- Debit leg on the source account.
  insert into public.transactions
    (customer_id, merchant, category, amount, occurred_on, account_kind)
  values
    (p_customer, p_merchant, 'Transfer', -p_amount, v_day, p_from)
  returning id into v_leg_id;

  -- Credit leg on the destination account.
  insert into public.transactions
    (customer_id, merchant, category, amount, occurred_on, account_kind)
  values
    (p_customer, p_merchant, 'Transfer', p_amount, v_day, p_to);

  return v_leg_id;
end;
$$;

comment on function public.riverbend_transfer(uuid, text, text, numeric, text, date) is
  'Atomically moves money between a customer''s checking and savings accounts, writing both ledger legs.';

-- ============================================================================
-- Execution privileges
-- ----------------------------------------------------------------------------
-- Functions are EXECUTE-to-PUBLIC by default; narrow that to the roles the
-- browser actually uses. migrations/001 creates these roles if they are absent.
-- ============================================================================

-- Ownership: SECURITY DEFINER functions run with the privileges of the role
-- that owns them. Whoever applies this file owns the functions, and it is the
-- same role that owns the tables in migration 001 — so the functions already
-- write with the privileges they need.
--
-- The block below pins ownership to `postgres` (the role Supabase's SQL Editor
-- uses) WHEN this session is allowed to do so, purely so behaviour does not
-- depend on which role applied the files. If it is not permitted it is skipped
-- with a notice instead of failing: the functions still work, because the role
-- that created them also owns the tables.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.riverbend_assert_amount(numeric)',
    'public.riverbend_send(uuid, text, numeric, text, date)',
    'public.riverbend_transfer(uuid, text, text, numeric, text, date)'
  ]
  loop
    begin
      execute format('alter function %s owner to postgres', fn);
    exception
      when insufficient_privilege or undefined_object then
        raise notice 'RIVERBEND 002: leaving % owned by % (not permitted to reassign)',
          fn, current_user;
    end;
  end loop;
end;
$$;

revoke all on function public.riverbend_assert_amount(numeric) from public;
revoke all on function public.riverbend_send(uuid, text, numeric, text, date) from public;
revoke all on function public.riverbend_transfer(uuid, text, text, numeric, text, date) from public;

grant execute on function public.riverbend_send(uuid, text, numeric, text, date)
  to anon, authenticated;
grant execute on function public.riverbend_transfer(uuid, text, text, numeric, text, date)
  to anon, authenticated;

-- A SECURITY DEFINER function must not be reachable by a role that can CREATE
-- objects in the schema its `search_path` resolves against (search_path
-- hijacking). PostgreSQL 15+ and Supabase already deny CREATE on `public` to
-- PUBLIC, so this is normally a no-op; it is asserted here so the guarantee
-- belongs to this schema rather than to a default we cannot see. Wrapped so a
-- non-owner applying role cannot make the migration fail on it.
do $$
begin
  revoke create on schema public from public;
exception
  when insufficient_privilege then
    raise notice 'RIVERBEND 002: could not revoke CREATE on schema public (owned by another role)';
end;
$$;


-- ============================================================================
-- Post-install verification (read-only, informational)
-- ============================================================================
do $$
declare
  n_fns int;
  n_exec int;
begin
  select count(*) into n_fns
  from pg_proc
  where proname in ('riverbend_send', 'riverbend_transfer')
    and pronamespace = 'public'::regnamespace;

  -- Both must be callable with the publishable key, or Send/Move fail at runtime.
  select count(*) into n_exec
  from pg_proc p
  where p.proname in ('riverbend_send', 'riverbend_transfer')
    and p.pronamespace = 'public'::regnamespace
    and has_function_privilege('anon', p.oid, 'execute');

  raise notice 'RIVERBEND 002: % atomic transfer function(s) installed, % executable by anon',
    n_fns, n_exec;
end;
$$;
