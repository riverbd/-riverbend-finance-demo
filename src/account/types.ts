/**
 * Shape of customer data as the UI consumes it.
 *
 * These mirror the database rows in supabase/migrations/001_riverbend_schema.sql
 * but keep the exact field names the existing components already render
 * (`balance.checking`, `card.last4`, `transaction.merchant`, …) so no UI code
 * had to change.
 */

export type AccountKind = "checking" | "savings";

export type Card = {
  id: string;
  label: string;
  last4: string;
  network: "Visa" | "Mastercard";
  expiry: string;
  frozen: boolean;
  cardholderName?: string;
};

export type Transaction = {
  id: string;
  merchant: string;
  category: string;
  /** Signed: credits positive, debits negative. */
  amount: number;
  /** ISO date, YYYY-MM-DD (from `transactions.occurred_on`). */
  date: string;
  account: AccountKind;
};

/**
 * A customer as loaded from Supabase.
 *
 * Deliberately has NO `password` field: the schema stores no credentials, so
 * there is nothing to load. Demo password checking stays client-side for now.
 */
export type CustomerAccount = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  /** ISO date as stored, e.g. "2019-04-12". */
  memberSince: string;
  memberId: string;
  initials: string;
  balance: { checking: number; savings: number };
  cards: Card[];
  transactions: Transaction[];
};
