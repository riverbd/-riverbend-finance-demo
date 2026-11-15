import { supabase } from "../lib/supabase";
import type { ContentState } from "../admin/store";
import { DatabaseError } from "../account/db";
import type { AccountKind } from "../account/types";

/**
 * Supabase data access for the admin dashboard.
 *
 * Covers everything the admin controls:
 *   * website content      -> site_content (one jsonb document)
 *   * customer profile     -> customers
 *   * balances             -> bank_accounts
 *   * cardholder names     -> cards
 *   * demo credentials     -> customers (incl. demo_password)
 *
 * Same rules as the customer layer: Supabase is the source of truth, failures
 * throw DatabaseError, and nothing silently falls back to localStorage.
 */

/** Message-safe error for admin surfaces. */
function adminError(error: unknown, action: string): DatabaseError {
  const e = error as { message?: string; code?: string; details?: string } | null;
  if (!e?.message) {
    return new DatabaseError(`${action} failed: the database did not respond.`);
  }
  if (/failed to fetch|networkerror|load failed/i.test(e.message)) {
    return new DatabaseError(
      `${action} failed: could not reach the database. Check your connection and try again.`
    );
  }
  if (e.code === "42501") {
    return new DatabaseError(
      `${action} failed: the database refused the request (permission denied).`
    );
  }
  if (e.code === "23514") {
    return new DatabaseError(
      `${action} failed: the content did not pass a database validation rule.`
    );
  }
  return new DatabaseError(`${action} failed: ${e.message}`);
}

// ---------------------------------------------------------------------------
// Website content
// ---------------------------------------------------------------------------

const CONTENT_SLUG = "default";

/** Load the website content document. Returns null if no row exists yet. */
export async function fetchSiteContent(): Promise<ContentState | null> {
  const { data, error } = await supabase
    .from("site_content")
    .select("content")
    .eq("slug", CONTENT_SLUG)
    .maybeSingle<{ content: ContentState }>();

  if (error) throw adminError(error, "Loading website content");
  return data?.content ?? null;
}

/** Save the whole content document (the admin saves wholesale). */
export async function saveSiteContent(content: ContentState): Promise<void> {
  const { data, error } = await supabase
    .from("site_content")
    .upsert({ slug: CONTENT_SLUG, content }, { onConflict: "slug" })
    .select("slug");

  if (error) throw adminError(error, "Saving website content");
  if (!data || data.length === 0) {
    throw new DatabaseError("Saving website content failed: the database changed no rows.");
  }
}

// ---------------------------------------------------------------------------
// Customer records (admin view of the Accounts table)
// ---------------------------------------------------------------------------

export type AdminCustomer = {
  /** The app's stable id (customers.client_ref), e.g. "demo-1". */
  id: string;
  fullName: string;
  /** Admin-editable; never derived from fullName on read. */
  initials: string;
  username: string;
  email: string;
  memberId: string;
  password: string;
  balance: { checking: number; savings: number };
  cards: {
    id: string;
    label: string;
    last4: string;
    network: string;
    expiry: string;
    frozen: boolean;
    cardholderName?: string;
  }[];
};

type CustomerRow = {
  client_ref: string;
  full_name: string;
  initials: string;
  username: string;
  email: string;
  member_id: string;
  demo_password: string | null;
};

const num = (v: string | number) => (typeof v === "number" ? v : Number.parseFloat(v));

/**
 * Every customer with balances and cards, for the admin tables and editors.
 *
 * Reads credentials too (including demo_password) because the Credentials tab
 * displays the current values — this is an admin-only read.
 */
export async function fetchAdminCustomers(): Promise<AdminCustomer[]> {
  const { data: customers, error } = await supabase
    .from("customers")
    .select("client_ref, full_name, initials, username, email, member_id, demo_password")
    .order("client_ref", { ascending: true })
    .returns<CustomerRow[]>();

  if (error) throw adminError(error, "Loading customers");

  const results = await Promise.all(
    (customers ?? []).map(async (row) => {
      const [accounts, cards] = await Promise.all([
        supabase
          .from("bank_accounts")
          .select("kind, balance")
          .eq("customer_id", await uuidOf(row.client_ref))
          .returns<{ kind: AccountKind; balance: string | number }[]>(),
        supabase
          .from("cards")
          .select("client_ref, label, last4, network, expiry, frozen, cardholder_name")
          .eq("customer_id", await uuidOf(row.client_ref))
          .order("client_ref", { ascending: true })
          .returns<
            {
              client_ref: string;
              label: string;
              last4: string;
              network: string;
              expiry: string;
              frozen: boolean;
              cardholder_name: string | null;
            }[]
          >(),
      ]);

      if (accounts.error) throw adminError(accounts.error, "Loading balances");
      if (cards.error) throw adminError(cards.error, "Loading cards");

      const balance = { checking: 0, savings: 0 };
      for (const a of accounts.data ?? []) {
        if (a.kind === "checking" || a.kind === "savings") balance[a.kind] = num(a.balance);
      }

      return {
        id: row.client_ref,
        fullName: row.full_name,
        initials: row.initials,
        username: row.username,
        email: row.email,
        memberId: row.member_id,
        password: row.demo_password ?? "",
        balance,
        cards: (cards.data ?? []).map((c) => ({
          id: c.client_ref,
          label: c.label,
          last4: c.last4,
          network: c.network,
          expiry: c.expiry,
          frozen: c.frozen,
          ...(c.cardholder_name ? { cardholderName: c.cardholder_name } : {}),
        })),
      };
    })
  );

  return results;
}

const uuidCache = new Map<string, string>();

/** Resolve a client_ref to its uuid (cached for the session). */
async function uuidOf(clientRef: string): Promise<string> {
  const cached = uuidCache.get(clientRef);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("client_ref", clientRef)
    .maybeSingle<{ id: string }>();

  if (error) throw adminError(error, "Looking up a customer");
  if (!data) throw new DatabaseError("That customer no longer exists.", "P0002");
  uuidCache.set(clientRef, data.id);
  return data.id;
}

/** Invalidate the uuid cache (used after a reset). */
export function clearAdminCache() {
  uuidCache.clear();
}

// ---------------------------------------------------------------------------
// Admin writes
// ---------------------------------------------------------------------------

/** Set checking and/or savings. Each value is written in one statement. */
export async function adminSetBalance(
  clientRef: string,
  kind: AccountKind,
  value: number
): Promise<void> {
  const uuid = await uuidOf(clientRef);

  const { data, error } = await supabase
    .from("bank_accounts")
    .update({ balance: value })
    .eq("customer_id", uuid)
    .eq("kind", kind)
    .select("kind");

  if (error) throw adminError(error, "Saving balance");
  if (!data || data.length === 0) {
    throw new DatabaseError("Saving balance failed: no matching account row was updated.");
  }
}

/** Set the name engraved on one card. */
export async function adminSetCardholderName(
  clientRef: string,
  cardClientRef: string,
  name: string
): Promise<void> {
  const uuid = await uuidOf(clientRef);

  const { data, error } = await supabase
    .from("cards")
    .update({ cardholder_name: name })
    .eq("customer_id", uuid)
    .eq("client_ref", cardClientRef)
    .select("client_ref");

  if (error) throw adminError(error, "Saving cardholder name");
  if (!data || data.length === 0) {
    throw new DatabaseError("Saving cardholder name failed: no matching card was updated.");
  }
}

/**
 * Update a customer's login details.
 *
 * `password` maps to the plaintext demo_password column (see the security note
 * in migration 003). Passing undefined leaves it untouched.
 */
export async function adminSetCredentials(
  clientRef: string,
  patch: {
    username?: string;
    password?: string;
    memberId?: string;
    email?: string;
    fullName?: string;
    initials?: string;
  }
): Promise<void> {
  const uuid = await uuidOf(clientRef);

  const update: Record<string, unknown> = {};
  if (patch.fullName !== undefined) update.full_name = patch.fullName;
  if (patch.initials !== undefined) update.initials = patch.initials;
  if (patch.username !== undefined) update.username = patch.username;
  if (patch.email !== undefined) update.email = patch.email;
  if (patch.memberId !== undefined) update.member_id = patch.memberId;
  if (patch.password !== undefined) update.demo_password = patch.password;

  if (Object.keys(update).length === 0) return;

  const { data, error } = await supabase
    .from("customers")
    .update(update)
    .eq("id", uuid)
    .select("client_ref");

  if (error) throw adminError(error, "Saving credentials");
  if (!data || data.length === 0) {
    throw new DatabaseError("Saving credentials failed: no matching customer was updated.");
  }
}

/**
 * Restore the seeded values for everything the "Reset all data" button covers.
 *
 * Deliberately NOT a DELETE: the migration grants no delete policy to the demo
 * roles, and the requirement forbids destructive database operations. Resetting
 * means writing the original seed values back.
 */
export const SEEDED_CONTENT_MARKER = "default";

// ---------------------------------------------------------------------------
// Login verification codes (Milestone 2)
// ---------------------------------------------------------------------------
// This is the ONLY place in the browser that ever sees a customer's six-digit
// code, and it is an admin surface. The database function behind it requires
// the admin passphrase, which was written to Postgres by migration 004 — the
// browser value below is what the admin logged in with, not a new secret.

export type AdminVerification = {
  clientRef: string;
  challengeId: string;
  /** The live six-digit code the admin reads out to the customer. */
  code: string;
  status: "pending" | "verified" | "expired" | "failed";
  createdAt: string;
  expiresAt: string;
  secondsLeft: number;
  attempts: number;
  attemptsLeft: number;
};

type VerificationRow = {
  client_ref: string;
  challenge_id: string;
  code: string;
  status: string;
  created_at: string;
  expires_at: string;
  seconds_left: number;
  attempts: number;
  attempts_left: number;
};

/**
 * Latest verification challenge per customer, including the live code.
 *
 * Returns an empty list when the passphrase does not match, which is
 * indistinguishable from "no customer has ever tried to sign in" — deliberate,
 * so a caller without the passphrase learns nothing.
 */
export async function fetchAdminVerifications(passphrase: string): Promise<AdminVerification[]> {
  const { data, error } = await supabase.rpc("riverbend_admin_login_verifications", {
    p_passphrase: passphrase,
  });

  if (error) throw adminError(error, "Loading verification codes");

  return ((data ?? []) as VerificationRow[]).map((row) => ({
    clientRef: row.client_ref,
    challengeId: row.challenge_id,
    code: row.code,
    status: row.status as AdminVerification["status"],
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    secondsLeft: Number(row.seconds_left ?? 0),
    attempts: Number(row.attempts ?? 0),
    attemptsLeft: Number(row.attempts_left ?? 0),
  }));
}
