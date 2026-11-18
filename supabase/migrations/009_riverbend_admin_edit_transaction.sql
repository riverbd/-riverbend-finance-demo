-- ============================================================================
-- RIVERBEND FINANCE — 009 admin edit of a single transaction
-- ============================================================================
-- Purpose: let the administrator correct an existing transaction's date and
-- amount from the Admin -> Transactions tab.
--
-- The awkward part is the balance. `bank_accounts.balance` is a stored value
-- and is not derived from the ledger, so correcting a transaction's amount has
-- to move the balance by the *difference* between the old and the new amount —
-- netting the row out of the balance and netting the corrected row back in:
--
--   balance := balance - old_amount + new_amount
--
-- That single expression is what makes both cases fall out correctly:
--
--   money received (+500 -> +700):  +500 removed, +700 added  => +200
--   money received (+700 -> +400):  removed, added             => -300
--   money sent   (-300 -> -500):    -300 removed, -500 added   => -200
--   money sent   (-500 -> -200):    removed, added             => +300
--
-- A date-only edit makes new_amount = old_amount, so the net adjustment is
-- zero and the balance is untouched. There is no separate date path to get
-- wrong.
--
-- WHAT IS NOT CHANGED
--   * merchant, category, customer_id and account_kind are never written, so
--     the description, the type and the owning account are preserved.
--   * No row is inserted and none is deleted. One row is corrected in place.
--   * No other transaction is touched: every statement is scoped to p_id.
--   * demo-2 (or any other customer) cannot be affected, because the balance
--     update is scoped to the owning customer and account of the row being
--     edited, both read from that row.
--
-- ATOMICITY AND RETRIES
--   The function body is a single statement sequence inside one implicit
--   transaction: either the ledger row and the balance both change, or neither
--   does. Any RAISE rolls the whole thing back.
--
--   `p_expected_amount` is what makes a retry safe. The caller sends the amount
--   it believes the row currently holds. The function locks the row and refuses
--   the edit if that no longer matches, so replaying a request that already
--   succeeded changes nothing the second time instead of applying the
--   difference twice.
--
-- NEGATIVE BALANCES
--   A correction that would leave the account below zero is refused, matching
--   the rule migration 002 already enforces on outgoing money.
--
-- ============================================================================

begin;

create or replace function public.riverbend_admin_edit_transaction(
  p_passphrase      text,
  p_id              uuid,
  p_expected_amount numeric,
  p_new_amount      numeric,
  p_new_date        date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_amount  numeric(14, 2);
  v_account_kind text;
  v_customer_id uuid;
  v_balance     numeric(14, 2);
begin
  if not public.riverbend_admin_ok(p_passphrase) then
    return 0;
  end if;

  if p_new_amount is null then
    raise exception 'A transaction amount is required.' using errcode = '22023';
  end if;

  if p_new_date is null then
    raise exception 'A transaction date is required.' using errcode = '22023';
  end if;

  -- Lock the ledger row first. The previous amount and the owner are read from
  -- the row itself, never trusted from the caller.
  select t.amount, t.account_kind, t.customer_id
    into v_old_amount, v_account_kind, v_customer_id
    from public.transactions t
   where t.id = p_id
     for update;

  if not found then
    raise exception 'Transaction not found.' using errcode = 'P0002';
  end if;

  -- Retry guard: the caller must have seen the amount we hold now.
  if p_expected_amount is not null
     and v_old_amount is distinct from round(p_expected_amount, 2) then
    raise exception
      'Transaction % already reads %, not the % this edit expected.',
      p_id, to_char(v_old_amount, 'FM999999999990.00'),
      to_char(p_expected_amount, 'FM999999999990.00')
      using errcode = 'P0001';
  end if;

  -- Zeroing a transaction would be a delete in disguise under a different
  -- name, and it leaves an amount that no longer says "money moved". Refuse.
  if round(p_new_amount, 2) = 0 then
    raise exception 'A transaction amount cannot be zero. Delete the transaction instead.'
      using errcode = '22023';
  end if;

  -- Money received stays money received; money sent stays money sent. Flipping
  -- the sign would turn a payment into a refund and change the meaning of the
  -- row, which this edit is not meant to do.
  if sign(p_new_amount) <> sign(v_old_amount) then
    raise exception 'A transaction cannot change from money received to money sent, or the reverse.'
      using errcode = '22023';
  end if;

  -- Apply the net correction, then check the floor. Locking the account row is
  -- what stops a concurrent transfer from racing this check.
  select balance into v_balance
    from public.bank_accounts
   where customer_id = v_customer_id
     and kind = v_account_kind
     for update;

  if not found then
    raise exception 'Account not found for this transaction.' using errcode = 'P0002';
  end if;

  if round(v_balance - v_old_amount + p_new_amount, 2) < 0 then
    raise exception
      'This correction would take the account below zero: balance %, correction %.',
      to_char(v_balance, 'FM999999999990.00'),
      to_char(round(p_new_amount - v_old_amount, 2), 'FM999999999990.00')
      using errcode = 'P0001';
  end if;

  update public.bank_accounts
     set balance = round(balance - v_old_amount + p_new_amount, 2)
   where customer_id = v_customer_id
     and kind = v_account_kind;

  -- Only the two editable fields are written.
  update public.transactions t
     set amount      = round(p_new_amount, 2),
         occurred_on = p_new_date
   where t.id = p_id;

  return 1;
end;
$$;

comment on function public.riverbend_admin_edit_transaction(text, uuid, numeric, numeric, date) is
  'Admin-only correction of one transaction date and/or amount. Moves the owning account balance by the difference between the old and new amount, in the same transaction. Never touches any other row.';

revoke all on function public.riverbend_admin_edit_transaction(text, uuid, numeric, numeric, date) from anon, authenticated, public;
grant execute on function public.riverbend_admin_edit_transaction(text, uuid, numeric, numeric, date) to anon, authenticated;

commit;
