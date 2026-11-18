/**
 * Statement calculation.
 *
 * Pure functions, no React and no PDF library, so the arithmetic that a
 * customer's statement depends on can be tested directly and in isolation.
 *
 * The schema stores a *current* balance per account and a ledger of signed
 * transactions. It does NOT store a running balance per transaction. That
 * matters for honesty: a statement's opening and closing balances have to be
 * derived, and the derivation has to be one the records actually support.
 *
 * The rule used here:
 *
 *   closing = current balance − (net effect of every transaction after the
 *                               statement's end date)
 *
 * That is exact, because the current balance is the sum of the opening balance
 * and every transaction to date. Walking backwards from a known balance is the
 * only derivation that stays correct without assuming the ledger starts empty.
 * A statement that only looked at its own transactions and called their sum the
 * change would be wrong for any period that does not begin at account opening.
 */

import type { AccountKind, Transaction } from "./types";

export type StatementPeriod = { start: string; end: string };

export type StatementLine = {
  date: string;
  description: string;
  /** The transaction's category, used as its type on the statement. */
  type: string;
  /** Positive amounts are credits (money in); debits are emitted unsigned. */
  debit: number | null;
  credit: number | null;
  /** Running balance after this line, within the statement period. */
  balance: number;
};

export type StatementData = {
  accountKind: AccountKind;
  accountLabel: string;
  /** The account's masked identifier, e.g. "•••• 4218". */
  accountNumber: string;
  customerName: string;
  memberId: string;
  period: StatementPeriod;
  openingBalance: number;
  closingBalance: number;
  totalReceived: number;
  totalSpent: number;
  lines: StatementLine[];
  /** Transactions dated after the period that were used to derive the closing. */
  currentBalance: number;
};

export const EMPTY_STATEMENT_MESSAGE =
  "No transactions fall within the selected dates. Choose a different period.";

/** Round to cents, so floating-point drift never reaches a PDF. */
export function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Build a statement for one account and period.
 *
 * `currentBalance` is the account's stored balance right now. `transactions`
 * may contain both accounts; only the requested one is considered.
 */
export function buildStatement({
  accountKind,
  accountLabel,
  accountNumber,
  customerName,
  memberId,
  period,
  currentBalance,
  transactions,
}: {
  accountKind: AccountKind;
  accountLabel: string;
  accountNumber: string;
  customerName: string;
  memberId: string;
  period: StatementPeriod;
  currentBalance: number;
  transactions: Transaction[];
}): StatementData {
  const forAccount = transactions.filter((t) => t.account === accountKind);

  // Oldest first: a statement has to read forwards in time for the running
  // balance to mean anything.
  const inPeriod = forAccount
    .filter((t) => t.date >= period.start && t.date <= period.end)
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.id < b.id ? -1 : 1));

  // Everything after the period tells us how far back to walk from today's
  // balance to reach the closing balance of the statement.
  const afterPeriod = forAccount.filter((t) => t.date > period.end);

  const closingBalance = toCents(currentBalance - sum(afterPeriod.map((t) => t.amount)));
  const netInPeriod = toCents(sum(inPeriod.map((t) => t.amount)));
  const openingBalance = toCents(closingBalance - netInPeriod);

  let running = openingBalance;
  const lines: StatementLine[] = inPeriod.map((t) => {
    running = toCents(running + t.amount);
    return {
      date: t.date,
      description: t.merchant,
      type: t.category,
      debit: t.amount < 0 ? toCents(Math.abs(t.amount)) : null,
      credit: t.amount > 0 ? toCents(t.amount) : null,
      balance: running,
    };
  });

  return {
    accountKind,
    accountLabel,
    accountNumber,
    customerName,
    memberId,
    period,
    openingBalance,
    closingBalance,
    totalReceived: toCents(sum(inPeriod.filter((t) => t.amount > 0).map((t) => t.amount))),
    totalSpent: toCents(sum(inPeriod.filter((t) => t.amount < 0).map((t) => Math.abs(t.amount)))),
    lines,
    currentBalance: toCents(currentBalance),
  };
}

/** True when a period is usable: both dates present and ordered. */
export function isValidPeriod(period: StatementPeriod): boolean {
  if (!period.start || !period.end) return false;
  return period.start <= period.end;
}

/**
 * The earliest and latest dates that could appear on this account's statement,
 * used to bound the date pickers so an impossible period cannot be chosen.
 */
export function periodBounds(
  transactions: Transaction[],
  accountKind: AccountKind,
  memberSince: string,
  today: string
): { min: string; max: string } {
  const dates = transactions.filter((t) => t.account === accountKind).map((t) => t.date);
  // ISO dates compare correctly as strings; `Math.min` would not.
  const earliest = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : memberSince;
  return { min: earliest < memberSince ? earliest : memberSince, max: today };
}

/**
 * A sensible default period: the last 90 days, clamped into the account's life.
 *
 * A single-day default would make the page open on an empty statement, which
 * reads as a bug to a customer who came here to download something.
 */
export function defaultPeriod(
  transactions: Transaction[],
  accountKind: AccountKind,
  memberSince: string,
  today: string
): StatementPeriod {
  const { min, max } = periodBounds(transactions, accountKind, memberSince, today);
  const ninety = new Date(`${max}T00:00:00Z`);
  ninety.setUTCDate(ninety.getUTCDate() - 90);
  const start = ninety.toISOString().slice(0, 10);
  return { start: start < min ? min : start, end: max };
}
