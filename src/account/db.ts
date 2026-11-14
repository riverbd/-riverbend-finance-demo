import { supabase } from "../lib/supabase";
import type { AccountKind, Card, CustomerAccount, Transaction } from "./types";

/**
 * Supabase-backed data access for the customer banking experience.
 *
 * Replaces the localStorage read/write helpers that used to live in auth.tsx.
 *
 * Design rules enforced here:
 *  * Supabase is the single source of truth. There is no localStorage fallback:
 *    a failed request throws a DatabaseError, which the UI renders.
 *  * Money movement goes through the atomic Postgres functions installed by
 *    supabase/migrations/002_riverbend_atomic_transfers.sql, never through
 *    read-modify-write in the browser.
 *  * Customer `id` values in this module are the app's stable `client_ref`
 *    strings ("demo-1", "demo-2") so the rest of the UI keeps working
 *    unchanged. The uuid primary keys are resolved internally.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** A database failure with a message that is safe and useful to show a user. */
export class DatabaseError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
  }
}

/**
 * Turn a PostgREST/Postgres error into an actionable sentence.
 *
 * Postgres messages raised by our own functions (via RAISE EXCEPTION) are
 * already written for humans, so they pass through. Everything else gets a
 * plain-language wrapper that still names the operation that failed.
 */
function toDatabaseError(error: unknown, action: string): DatabaseError {
  const e = error as { message?: string; code?: string; details?: string } | null;

  if (!e?.message) {
    return new DatabaseError(
      `${action} failed: the database did not respond. Check your connection and try again.`
    );
  }

  // Our plpgsql RAISE EXCEPTION messages are user-facing already.
  const friendly =
    e.code === "P0001" || // insufficient funds (raised by our functions)
    e.code === "P0002" || // account not found (raised by our functions)
    e.code === "22023"    // invalid parameter (raised by our functions)
      ? e.message
      : mapGenericError(e, action);

  return new DatabaseError(friendly, e.code);
}

function mapGenericError(
  e: { message?: string; code?: string; details?: string },
  action: string
): string {
  switch (e.code) {
    case "42501":
      return `${action} failed: the database refused the request (permission denied). The Row Level Security policy may need updating.`;
    case "23503":
      return `${action} failed: a referenced record does not exist.`;
    case "23505":
      return `${action} failed: that record already exists.`;
    case "23514":
      return `${action} failed: the data did not pass a database validation rule${
        e.details ? ` (${e.details})` : ""
      }.`;
    case "PGRST301":
    case "PGRST302":
      return `${action} failed: the database session is not authorised.`;
    default:
      break;
  }

  // Network-level failures surface as a TypeError from fetch.
  if (/failed to fetch|networkerror|load failed/i.test(e.message ?? "")) {
    return `${action} failed: could not reach the database. Check your internet connection and try again.`;
  }

  return `${action} failed: ${e.message}${e.details ? ` (${e.details})` : ""}`;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

type CustomerRow = {
  id: string;
  client_ref: string;
  full_name: string;
  username: string;
  email: string;
  member_since: string;
  member_id: string;
  initials: string;
};

type AccountRow = { kind: AccountKind; balance: string | number };
type CardRow = {
  client_ref: string;
  label: string;
  last4: string;
  network: "Visa" | "Mastercard";
  expiry: string;
  frozen: boolean;
  cardholder_name: string | null;
};
type TransactionRow = {
  id: string;
  client_ref: string | null;
  merchant: string;
  category: string;
  amount: string | number;
  occurred_on: string;
  account_kind: AccountKind;
};

/** numeric comes back from PostgREST as a string; the UI needs a number. */
function num(value: string | number): number {
  return typeof value === "number" ? value : Number.parseFloat(value);
}

function mapCustomer(
  row: CustomerRow,
  accounts: AccountRow[],
  cards: CardRow[],
  transactions: TransactionRow[]
): CustomerAccount {
  const balance = { checking: 0, savings: 0 };
  for (const a of accounts) {
    if (a.kind === "checking" || a.kind === "savings") balance[a.kind] = num(a.balance);
  }

  return {
    id: row.client_ref,
    fullName: row.full_name,
    username: row.username,
    email: row.email,
    memberSince: row.member_since,
    memberId: row.member_id,
    initials: row.initials,
    balance,
    cards: cards.map(
      (c): Card => ({
        // The UI keys cards by id; client_ref is its stable per-customer id.
        id: c.client_ref,
        label: c.label,
        last4: c.last4,
        network: c.network,
        expiry: c.expiry,
        frozen: c.frozen,
        ...(c.cardholder_name ? { cardholderName: c.cardholder_name } : {}),
      })
    ),
    transactions: transactions.map(
      (t): Transaction => ({
        // The row uuid: client_ref is null for every runtime transaction, so a
        // composite of date/merchant/amount would collide whenever two
        // identical payments happened on the same day (React would then drop
        // or duplicate rows in the activity list).
        id: t.id,
        merchant: t.merchant,
        category: t.category,
        amount: num(t.amount),
        date: t.occurred_on,
        account: t.account_kind,
      })
    ),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Load one customer by its stable client_ref, including balances, cards and
 * full transaction history (newest first).
 *
 * Returns null only when no such customer exists. Any transport/permission
 * failure throws so the caller can surface it instead of silently showing
 * stale data.
 */
export async function fetchCustomerAccount(clientRef: string): Promise<CustomerAccount | null> {
  const { data: customers, error: customerError } = await supabase
    .from("customers")
    .select("id, client_ref, full_name, username, email, member_since, member_id, initials")
    .eq("client_ref", clientRef)
    .maybeSingle<CustomerRow>();

  if (customerError) throw toDatabaseError(customerError, "Loading your account");
  if (!customers) return null;

  const [accounts, cards, transactions] = await Promise.all([
    supabase
      .from("bank_accounts")
      .select("kind, balance")
      .eq("customer_id", customers.id)
      .returns<AccountRow[]>(),
    supabase
      .from("cards")
      .select("client_ref, label, last4, network, expiry, frozen, cardholder_name")
      .eq("customer_id", customers.id)
      .order("client_ref", { ascending: true })
      .returns<CardRow[]>(),
    supabase
      .from("transactions")
      .select("id, client_ref, merchant, category, amount, occurred_on, account_kind")
      .eq("customer_id", customers.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<TransactionRow[]>(),
  ]);

  for (const [label, result] of [
    ["balances", accounts],
    ["cards", cards],
    ["transactions", transactions],
  ] as const) {
    if (result.error) throw toDatabaseError(result.error, `Loading your ${label}`);
  }

  return mapCustomer(
    customers,
    accounts.data ?? [],
    cards.data ?? [],
    transactions.data ?? []
  );
}

/**
 * Resolve the sign-in identifier (username OR email) to a customer, and return
 * the account so the caller can confirm the session.
 *
 * Credentials are intentionally NOT verified against the database — the schema
 * stores no passwords by design. The caller checks the demo password against
 * the client-side demo credentials; this function only answers "who is this?".
 */
export async function findCustomerByLogin(identifier: string): Promise<CustomerAccount | null> {
  const value = identifier.trim();
  if (!value) return null;

  // Match on username or email, case-insensitively, like the old signIn did.
  const { data, error } = await supabase
    .from("customers")
    .select("client_ref")
    .or(`username.ilike.${escapeForFilter(value)},email.ilike.${escapeForFilter(value)}`)
    .limit(1)
    .maybeSingle<{ client_ref: string }>();

  if (error) throw toDatabaseError(error, "Signing in");
  if (!data) return null;

  return fetchCustomerAccount(data.client_ref);
}

/**
 * Resolve the sign-in identifier to a customer AND its demo password.
 *
 * The password now lives in `customers.demo_password` so an admin edit takes
 * effect for everyone. See the security note in migration 003 — this column is
 * plaintext and must be replaced by Supabase Auth before real data is loaded.
 */
export async function findLoginCandidate(
  identifier: string
): Promise<{ clientRef: string; username: string; password: string } | null> {
  const value = identifier.trim();
  if (!value) return null;

  const { data, error } = await supabase
    .from("customers")
    .select("client_ref, username, demo_password")
    .or(`username.ilike.${escapeForFilter(value)},email.ilike.${escapeForFilter(value)}`)
    .limit(1)
    .maybeSingle<{ client_ref: string; username: string; demo_password: string | null }>();

  if (error) throw toDatabaseError(error, "Signing in");
  if (!data) return null;

  return {
    clientRef: data.client_ref,
    username: data.username,
    password: data.demo_password ?? "",
  };
}

/** PostgREST `or=` filter values contain commas/parens; quote to stay literal. */
function escapeForFilter(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Resolve the internal uuid for a client_ref. Write operations need the uuid
 * foreign key, while the rest of the app speaks client_ref.
 */
async function resolveCustomerUuid(clientRef: string): Promise<string> {
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("client_ref", clientRef)
    .maybeSingle<{ id: string }>();

  if (error) throw toDatabaseError(error, "Looking up your account");
  if (!data) throw new DatabaseError("Your account could not be found in the database.", "P0002");
  return data.id;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Freeze or unfreeze a card and return the reloaded account.
 *
 * `affected` guards against a silent no-op: PostgREST reports success with an
 * empty array when an update matches no rows (for example after an RLS change),
 * which would otherwise look like it worked.
 */
export async function setCardFrozen(
  clientRef: string,
  cardClientRef: string,
  frozen: boolean
): Promise<CustomerAccount> {
  const customerUuid = await resolveCustomerUuid(clientRef);

  const { data, error } = await supabase
    .from("cards")
    .update({ frozen })
    .eq("customer_id", customerUuid)
    .eq("client_ref", cardClientRef)
    .select("client_ref");

  if (error) throw toDatabaseError(error, frozen ? "Freezing your card" : "Unfreezing your card");
  if (!data || data.length === 0) {
    throw new DatabaseError(
      "The card could not be updated — the database did not change any rows.",
      "PGRST_NO_ROWS"
    );
  }

  const fresh = await fetchCustomerAccount(clientRef);
  if (!fresh) throw new DatabaseError("Your account could not be reloaded after the update.");
  return fresh;
}

/**
 * Send money out of one account. Debiting the balance and writing the ledger
 * row happen inside the atomic riverbend_send() function.
 */
export async function sendMoney(params: {
  clientRef: string;
  from: AccountKind;
  amount: number;
  merchant: string;
}): Promise<CustomerAccount> {
  const customerUuid = await resolveCustomerUuid(params.clientRef);

  const { error } = await supabase.rpc("riverbend_send", {
    p_customer: customerUuid,
    p_from: params.from,
    p_amount: params.amount,
    p_merchant: params.merchant,
  });

  if (error) throw toDatabaseError(error, "Sending money");

  const fresh = await fetchCustomerAccount(params.clientRef);
  if (!fresh) throw new DatabaseError("Your account could not be reloaded after the transfer.");
  return fresh;
}

/**
 * Move money between the customer's own checking and savings accounts.
 * Both balance updates and both ledger legs happen inside riverbend_transfer().
 */
export async function moveMoney(params: {
  clientRef: string;
  from: AccountKind;
  to: AccountKind;
  amount: number;
  merchant: string;
}): Promise<CustomerAccount> {
  const customerUuid = await resolveCustomerUuid(params.clientRef);

  const { error } = await supabase.rpc("riverbend_transfer", {
    p_customer: customerUuid,
    p_from: params.from,
    p_to: params.to,
    p_amount: params.amount,
    p_merchant: params.merchant,
  });

  if (error) throw toDatabaseError(error, "Moving money");

  const fresh = await fetchCustomerAccount(params.clientRef);
  if (!fresh) throw new DatabaseError("Your account could not be reloaded after the transfer.");
  return fresh;
}

/**
 * Read every customer's display fields for the login screen's sample-account
 * cards (name + username). Password hints stay client-side; see signIn below.
 */
export async function fetchDemoCustomers(): Promise<
  { id: string; fullName: string; username: string; password: string }[]
> {
  const { data, error } = await supabase
    .from("customers")
    .select("client_ref, full_name, username, demo_password")
    .order("client_ref", { ascending: true })
    .returns<
      { client_ref: string; full_name: string; username: string; demo_password: string | null }[]
    >();

  if (error) throw toDatabaseError(error, "Loading the sample accounts");

  return (data ?? []).map((row) => ({
    id: row.client_ref,
    fullName: row.full_name,
    username: row.username,
    // Surfaced on the demo login card so the hint matches what the DB accepts.
    password: row.demo_password ?? "",
  }));
}
