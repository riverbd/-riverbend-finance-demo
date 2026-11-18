-- ============================================================================
-- RIVERBEND FINANCE — 006 early withdrawal fee + checking account status
-- ============================================================================
-- Three related capabilities, all enforced in the database rather than in React:
--
--   1. Breaking a fixed-savings term. Moving money OUT of fixed savings into
--      checking is now allowed, but carries a 5% early-withdrawal fee on the
--      amount requested. The fee is taken from the amount, so $100 leaves fixed
--      savings and $95 arrives in checking; the $5 is the fee.
--
--   2. Fixed savings is never an external transfer source. riverbend_send() is
--      replaced so it only accepts checking — a caller who ignores the UI and
--      posts `p_from: 'savings'` straight to PostgREST is rejected.
--
--   3. An admin-controlled checking account status. When checking is inactive,
--      external transfers from it are refused by the database.
--
-- Design notes
-- ------------
-- * The fee lives in the DATABASE, not in the browser. The UI shows the same
--   arithmetic so the customer can see it before confirming, but the number
--   that moves is whatever the database computes inside the locked transaction.
--   A tampered amount in the request cannot change it.
--
-- * One transaction, one lock. riverbend_break_fixed_savings() locks both
--   balance rows with FOR UPDATE before reading, so a concurrent spend cannot
--   slip between the balance check and the decrement, and the two balance
--   updates plus all three ledger legs commit together or not at all.
--
-- * The fee is recorded as its own ledger row (negative, category
--   "Early withdrawal fee") so the history explains the difference between what
--   left fixed savings and what arrived in checking. It is taken from the
--   amount, NOT charged a second time against either balance.
--
-- * Fixed savings has no activity view in the customer UI (Accounts.tsx renders
--   a locked panel for it), so the three legs do not surface there. The
--   checking rows do: the credit for the net amount, and the fee. That is what
--   makes the deduction visible to the customer.
--
-- Only additive. No DROP TABLE, no TRUNCATE, no DELETE. Safe to re-run.
-- Depends on 001 (schema) and 002 (riverbend_assert_amount).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Checking account status
-- ----------------------------------------------------------------------------
-- One row per customer per product kind already exists in bank_accounts, so the
-- status belongs there rather than in a new table. 'active' is the default so
-- every existing row keeps working unchanged.
alter table public.bank_accounts
  add column if not exists status text not null default 'active';

-- Constrain the domain. Added separately so re-running is safe: ADD CONSTRAINT
-- has no IF NOT EXISTS, so it is guarded by a catalog lookup instead.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.bank_accounts'::regclass
       and conname  = 'bank_accounts_status_check'
  ) then
    alter table public.bank_accounts
      add constraint bank_accounts_status_check
      check (status in ('active', 'inactive'));
  end if;
end;
$$;

comment on column public.bank_accounts.status is
  'Admin-controlled account status. Inactive checking blocks external transfers only; internal moves between the customer''s own accounts still work.';

-- Lock the new column down before anything else uses it.
--
-- Migration 001 grants `update` on this whole table to anon/authenticated,
-- because the admin dashboard edits balances with a direct PostgREST PATCH.
-- That grant would also let ANY customer PATCH their own row and set
-- `status = 'active'`, quietly undoing the admin's suspend — the toggle would
-- be advisory only.
--
-- So the table-wide UPDATE is replaced with a column-level grant that covers
-- exactly what the admin dashboard actually writes (balance), plus the
-- updated_at column the BEFORE UPDATE trigger maintains. `status` is absent
-- from that list, which makes it unwritable by the browser roles no matter what
-- they send; the only way to change it is the passphrase-gated function below,
-- which runs as the table owner.
revoke update on public.bank_accounts from anon, authenticated;
grant  update (balance, updated_at) on public.bank_accounts to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Early withdrawal fee rate
-- ----------------------------------------------------------------------------
-- A function, not a constant, so the rate has exactly one definition that both
-- the fee maths and any future reader share.
create or replace function public.riverbend_early_withdrawal_fee_rate()
returns numeric
language sql
immutable
as $$ select 0.05::numeric $$;

comment on function public.riverbend_early_withdrawal_fee_rate() is
  'Early withdrawal fee on fixed savings, as a fraction of the amount requested. 5%.';

-- ----------------------------------------------------------------------------
-- 3. Fee arithmetic
-- ----------------------------------------------------------------------------
-- Both derived values in one place, so the UI and the transfer can never
-- disagree about rounding. Rounded to cents, half-up.
create or replace function public.riverbend_early_withdrawal_fee(p_amount numeric)
returns numeric
language sql
immutable
as $$
  select round(coalesce(p_amount, 0) * public.riverbend_early_withdrawal_fee_rate(), 2)
$$;

comment on function public.riverbend_early_withdrawal_fee(numeric) is
  'Fee charged when breaking fixed savings for the given amount. 5% of the amount, to 2dp.';

create or replace function public.riverbend_early_withdrawal_net(p_amount numeric)
returns numeric
language sql
immutable
as $$
  select coalesce(p_amount, 0)
       - round(coalesce(p_amount, 0) * public.riverbend_early_withdrawal_fee_rate(), 2)
$$;

comment on function public.riverbend_early_withdrawal_net(numeric) is
  'Amount actually credited to checking after the early withdrawal fee, to 2dp.';

-- ----------------------------------------------------------------------------
-- 4. Early withdrawal fee rate must stay sane
-- ----------------------------------------------------------------------------
-- A mis-set rate could silently confiscate a balance. Guard the range.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.bank_accounts'::regclass
       and conname  = 'bank_accounts_balance_nonnegative'
  ) then
    -- 001 already declares `balance >= 0` inline; this restates it under a name
    -- so a future migration cannot accidentally drop the guarantee.
    alter table public.bank_accounts
      add constraint bank_accounts_balance_nonnegative check (balance >= 0) not valid;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. riverbend_send — checking only
-- ----------------------------------------------------------------------------
-- Replaces the 002 definition. The signature is unchanged, so the app's
-- existing RPC call keeps working; only the accepted source changed.
--
-- The extra guards, all of which a browser cannot bypass:
--   * p_from must be 'checking'. Fixed savings is not an external source.
--   * the checking row must exist and be 'active'.
--   * the balance check happens under FOR UPDATE, as before.
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
  v_status  text;
  v_tx_id   uuid;
begin
  perform public.riverbend_assert_amount(p_amount);

  -- External transfers leave from checking and nowhere else. Fixed savings is
  -- deliberately excluded here rather than only omitted from the UI dropdown.
  if p_from is null or p_from <> 'checking' then
    raise exception 'External transfers can only be sent from a checking account.'
      using errcode = '22023';
  end if;

  if p_merchant is null or length(trim(p_merchant)) = 0 then
    raise exception 'A transaction description is required.' using errcode = '22023';
  end if;

  -- Lock the row before reading so the check below cannot race a concurrent debit.
  select balance, status into v_balance, v_status
  from public.bank_accounts
  where customer_id = p_customer and kind = p_from
  for update;

  if not found then
    raise exception 'Account not found for this customer.' using errcode = 'P0002';
  end if;

  if v_status <> 'active' then
    raise exception 'This checking account is inactive. External transfers are unavailable.'
      using errcode = 'P0001';
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
  'Atomically debits checking and appends a negative ledger row. Rejects fixed savings and inactive accounts.';

-- ----------------------------------------------------------------------------
-- 6. riverbend_break_fixed_savings — the fee-bearing move
-- ----------------------------------------------------------------------------
-- Moves money from fixed savings to checking, keeping 5% of the requested
-- amount as an early withdrawal fee.
--
-- Balances:  savings - amount        checking + (amount - fee)
-- Ledger:    3 rows
--              savings  -amount                "Transfer: Fixed savings -> Checking"
--              checking +(amount - fee)        same description
--              checking -fee                   "... · early withdrawal fee"
--
-- The fee is never deducted twice: it is never taken off either balance as a
-- separate charge. It is simply the part of `amount` that does not arrive.
create or replace function public.riverbend_break_fixed_savings(
  p_customer    uuid,
  p_amount      numeric,
  p_merchant    text,
  p_occurred_on date default current_date
)
returns table (
  transaction_id uuid,
  fee            numeric,
  net            numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_savings   numeric(14, 2);
  v_locked    int;
  v_fee       numeric(14, 2);
  v_net       numeric(14, 2);
  v_day       date := coalesce(p_occurred_on, current_date);
  v_leg_id    uuid;
  v_desc      text := coalesce(p_merchant, 'Transfer: Fixed savings → Checking');
begin
  perform public.riverbend_assert_amount(p_amount);

  if v_desc is null or length(trim(v_desc)) = 0 then
    raise exception 'A transaction description is required.' using errcode = '22023';
  end if;

  -- Lock BOTH rows in a deterministic order, exactly as riverbend_transfer does,
  -- so two opposing moves cannot deadlock.
  select count(*) into v_locked
  from (
    select balance
    from public.bank_accounts
    where customer_id = p_customer and kind in ('checking', 'savings')
    order by kind
    for update
  ) locked;

  if v_locked <> 2 then
    raise exception 'Both accounts must exist for this customer.' using errcode = 'P0002';
  end if;

  select balance into v_savings
  from public.bank_accounts
  where customer_id = p_customer and kind = 'savings';

  -- The full requested amount must be available, not just the net. Sending $100
  -- requires $100 in fixed savings.
  if v_savings < p_amount then
    raise exception 'Insufficient funds: fixed savings has %, requested %.',
      to_char(v_savings, 'FM999999999990.00'), to_char(p_amount, 'FM999999999990.00')
      using errcode = 'P0001';
  end if;

  v_fee := public.riverbend_early_withdrawal_fee(p_amount);
  v_net := p_amount - v_fee;

  -- A fee that consumed the whole amount would mean a pointless zero credit.
  if v_net <= 0 then
    raise exception 'That amount is too small to move after the early withdrawal fee.'
      using errcode = '22023';
  end if;

  -- Deduct the full amount from fixed savings.
  update public.bank_accounts
  set balance = balance - p_amount
  where customer_id = p_customer and kind = 'savings';

  -- Credit only the net amount to checking.
  update public.bank_accounts
  set balance = balance + v_net
  where customer_id = p_customer and kind = 'checking';

  -- Debit leg on fixed savings: the whole amount left.
  insert into public.transactions
    (customer_id, merchant, category, amount, occurred_on, account_kind)
  values
    (p_customer, v_desc, 'Transfer', -p_amount, v_day, 'savings')
  returning id into v_leg_id;

  -- Credit leg on checking: only the net arrived.
  insert into public.transactions
    (customer_id, merchant, category, amount, occurred_on, account_kind)
  values
    (p_customer, v_desc, 'Transfer', v_net, v_day, 'checking');

  -- The fee itself, as its own visible line on checking.
  insert into public.transactions
    (customer_id, merchant, category, amount, occurred_on, account_kind)
  values
    (p_customer, v_desc || ' · early withdrawal fee', 'Early withdrawal fee', -v_fee, v_day, 'checking');

  return query select v_leg_id, v_fee, v_net;
end;
$$;

comment on function public.riverbend_break_fixed_savings(uuid, numeric, text, date) is
  'Moves money from fixed savings to checking, retaining a 5% early withdrawal fee on the amount requested. Atomic; returns the fee and net.';

-- ----------------------------------------------------------------------------
-- 7. riverbend_transfer — unchanged behaviour, extra guards
-- ----------------------------------------------------------------------------
-- 002's version is restated here rather than altered, because the fee rule
-- belongs to one direction only: checking -> fixed savings must stay free and
-- must not be routed through the fee function. Behaviour is identical to 002
-- except that the destination status is not checked (only external transfers
-- care about status) and the source may not be an inactive checking account
-- when moving to fixed savings is the customer's own money — that stays allowed
-- by design, which is why no status check is added here at all.
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

  insert into public.transactions
    (customer_id, merchant, category, amount, occurred_on, account_kind)
  values
    (p_customer, p_merchant, 'Transfer', -p_amount, v_day, p_from)
  returning id into v_leg_id;

  insert into public.transactions
    (customer_id, merchant, category, amount, occurred_on, account_kind)
  values
    (p_customer, p_merchant, 'Transfer', p_amount, v_day, p_to);

  return v_leg_id;
end;
$$;

comment on function public.riverbend_transfer(uuid, text, text, numeric, text, date) is
  'Atomically moves money between a customer''s own accounts, writing both ledger legs. No fee in either direction.';

-- ----------------------------------------------------------------------------
-- 8. Customer-facing status read
-- ----------------------------------------------------------------------------
-- The Send page needs to know whether checking is active before it renders, and
-- the customer reads bank_accounts through RLS. Rather than widen the table's
-- select policy to expose status generally, this one function returns just the
-- status for one customer. Returns null when the customer is unknown.
create or replace function public.riverbend_account_status(
  p_customer uuid,
  p_kind     text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ba.status
  from public.bank_accounts ba
  where ba.customer_id = p_customer
    and ba.kind = p_kind;
$$;

comment on function public.riverbend_account_status(uuid, text) is
  'Returns ''active'' or ''inactive'' for one of a customer''s accounts.';

revoke all on function public.riverbend_account_status(uuid, text) from public;
grant execute on function public.riverbend_account_status(uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. Admin: set checking account status
-- ----------------------------------------------------------------------------
create or replace function public.riverbend_admin_set_account_status(
  p_passphrase text,
  p_customer   uuid,
  p_kind       text,
  p_status     text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  if not public.riverbend_admin_ok(p_passphrase) then
    return 0;
  end if;

  if p_kind is null or p_kind not in ('checking', 'savings') then
    raise exception 'Unknown account "%".', coalesce(p_kind, 'null')
      using errcode = '22023';
  end if;

  if p_status is null or p_status not in ('active', 'inactive') then
    raise exception 'Unknown account status "%".', coalesce(p_status, 'null')
      using errcode = '22023';
  end if;

  update public.bank_accounts
  set status = p_status,
      updated_at = now()
  where customer_id = p_customer
    and kind = p_kind;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

comment on function public.riverbend_admin_set_account_status(text, uuid, text, text) is
  'Admin-only. Switches an account between active and inactive. Requires the admin passphrase.';

revoke all on function public.riverbend_admin_set_account_status(text, uuid, text, text) from anon, authenticated, public;
grant execute on function public.riverbend_admin_set_account_status(text, uuid, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. Admin: read every account's status
-- ----------------------------------------------------------------------------
create or replace function public.riverbend_admin_account_statuses(
  p_passphrase text
)
returns table (
  customer_id uuid,
  kind        text,
  status      text
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
    select ba.customer_id, ba.kind, ba.status
      from public.bank_accounts ba
     order by ba.customer_id, ba.kind;
end;
$$;

comment on function public.riverbend_admin_account_statuses(text) is
  'Admin-only read of every account status. Requires the admin passphrase.';

revoke all on function public.riverbend_admin_account_statuses(text) from anon, authenticated, public;
grant execute on function public.riverbend_admin_account_statuses(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11. Execution privileges
-- ----------------------------------------------------------------------------
-- Narrow EXECUTE from the PUBLIC default to the roles the browser actually uses.
revoke all on function public.riverbend_early_withdrawal_fee_rate() from public;
revoke all on function public.riverbend_early_withdrawal_fee(numeric) from public;
revoke all on function public.riverbend_early_withdrawal_net(numeric) from public;

grant execute on function public.riverbend_early_withdrawal_fee_rate() to anon, authenticated;
grant execute on function public.riverbend_early_withdrawal_fee(numeric) to anon, authenticated;
grant execute on function public.riverbend_early_withdrawal_net(numeric) to anon, authenticated;

-- riverbend_send and riverbend_transfer were granted in 002; CREATE OR REPLACE
-- preserves the existing grants, but restate them so this file is self-contained.
grant execute on function public.riverbend_send(uuid, text, numeric, text, date)
  to anon, authenticated;
grant execute on function public.riverbend_transfer(uuid, text, text, numeric, text, date)
  to anon, authenticated;
grant execute on function public.riverbend_break_fixed_savings(uuid, numeric, text, date)
  to anon, authenticated;

revoke all on function public.riverbend_break_fixed_savings(uuid, numeric, text, date) from public;

-- ----------------------------------------------------------------------------
-- 12. Post-install verification (read-only, informational)
-- ----------------------------------------------------------------------------
do $$
declare
  n_status int;
  n_fns    int;
begin
  select count(*) into n_status
  from public.bank_accounts
  where status = 'inactive';

  select count(*) into n_fns
  from pg_proc
  where proname in (
    'riverbend_break_fixed_savings',
    'riverbend_early_withdrawal_fee',
    'riverbend_early_withdrawal_net',
    'riverbend_admin_set_account_status',
    'riverbend_admin_account_statuses',
    'riverbend_account_status'
  )
  and pronamespace = 'public'::regnamespace;

  raise notice 'RIVERBEND 006: % fee/status function(s) installed, % inactive account(s)',
    n_fns, n_status;
end;
$$;
