import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  DatabaseError,
  fetchCustomerAccount,
  fetchDemoCustomers,
  findLoginCandidate,
  moveMoney as dbMoveMoney,
  breakFixedSavings as dbBreakFixedSavings,
  sendMoney as dbSendMoney,
  type BreakResult,
  setCardFrozen as dbSetCardFrozen,
  startLoginVerification,
  verifyLoginCode,
} from "./db";
import type { AccountKind, CustomerAccount } from "./types";

export type { Card, CustomerAccount, Transaction } from "./types";

/* ==========================================================================
 * Session pointer
 * ==========================================================================
 *
 * Only the signed-in customer's client_ref is kept in the browser. No account
 * data (balances, cards, transactions, profile) is ever cached — every read
 * goes to Supabase, so a stale pointer can never show stale money.
 */

/** Session pointer: the client_ref of the signed-in customer. */
const SESSION_KEY = "riverbend_session_v4";

/* ==========================================================================
 * Demo credentials (client-side, intentionally)
 * ==========================================================================
 *
 * The database deliberately stores no passwords, so demo password checking
 * stays here. This preserves the existing demo login exactly: alex/demo1234
 * and jordan/demo1234. It is a demo affordance, not a security boundary.
 */
export type DemoCustomer = { id: string; fullName: string; username: string; password: string };

/**
 * Fallback list for the login screen only, used when the customer table cannot
 * be read so the marketing page still renders. It does NOT authenticate anyone:
 * sign-in always verifies against customers.demo_password.
 */
export const FALLBACK_DEMO_CUSTOMERS: DemoCustomer[] = [
  { id: "demo-1", fullName: "Alex Morgan", username: "alex", password: "demo1234" },
  { id: "demo-2", fullName: "Jordan Reyes", username: "jordan", password: "demo1234" },
];

/** Names/usernames for the login screen's sample cards, loaded from Supabase. */
export function useDemoCustomers(): {
  demoCustomers: DemoCustomer[];
  fromDatabase: boolean;
} {
  const [rows, setRows] = useState<DemoCustomer[]>(FALLBACK_DEMO_CUSTOMERS);
  const [fromDatabase, setFromDatabase] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDemoCustomers()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        // Passwords come from customers.demo_password so an admin edit is
        // reflected on the login screen.
        setRows(list.map((c) => ({ ...c, password: c.password })));
        setFromDatabase(true);
      })
      .catch(() => {
        // The login screen is a marketing surface: if the customer list cannot
        // be read we still render the demo hints rather than an error page.
        // Sign-in itself reports its own failures explicitly.
        if (!cancelled) setFromDatabase(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { demoCustomers: rows, fromDatabase };
}

/* ==========================================================================
 * Auth context
 * ========================================================================== */

/**
 * What phase 1 hands back. It is deliberately NOT a session: the customer still
 * has to pass the six-digit step, and `clientRef` here is only used to verify
 * the code that belongs to it.
 */
export type SignInTicket = {
  challengeId: string;
  clientRef: string;
  /** Where the code is waiting for the admin to read out. */
  displayName: string;
};

export type PendingChallenge = SignInTicket & { createdAt: number };

type Ctx = {
  /** The signed-in customer, loaded from Supabase. Null when signed out. */
  user: CustomerAccount | null;
  /** True while the saved session is being re-validated against the database. */
  loading: boolean;
  /** A session/refresh failure, ready to show to the customer. */
  error: string | null;
  /** Bumps on every successful reload so views can re-read derived state. */
  version: number;

  /**
   * Phase 1 of sign-in. Checks the password, then opens a six-digit challenge.
   *
   * Returns the challenge when the password was correct, `null` when the
   * credentials did not match, and throws DatabaseError if the database itself
   * failed. IMPORTANT: this does NOT establish a session — `user` stays null and
   * the banking dashboard stays closed until `completeSignIn` succeeds.
   */
  signIn: (identifier: string, password: string) => Promise<SignInTicket | null>;
  /**
   * Phase 2. Submits the six-digit code and, only if the database accepts it,
   * establishes the session. Returns `true` on success, `false` for a wrong or
   * expired code.
   */
  completeSignIn: (code: string) => Promise<boolean>;
  /** The open challenge while the verification screen is showing, else null. */
  pendingChallenge: PendingChallenge | null;
  /** Abandon a pending verification and go back to the password step. */
  cancelVerification: () => void;
  signOut: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;

  /** Customer banking operations. Each reloads the account on success. */
  freezeCard: (cardId: string, frozen: boolean) => Promise<void>;
  breakFixedSavings: (params: {
    amount: number;
    merchant: string;
  }) => Promise<BreakResult>;
  sendMoney: (params: {
    from: AccountKind;
    amount: number;
    merchant: string;
  }) => Promise<void>;
  moveMoney: (params: {
    from: AccountKind;
    to: AccountKind;
    amount: number;
    merchant: string;
  }) => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

function readSessionPointer(): string | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as string;
  } catch {
    return null;
  }
}

function writeSessionPointer(clientRef: string | null) {
  try {
    if (clientRef) window.localStorage.setItem(SESSION_KEY, JSON.stringify(clientRef));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomerAccount | null>(null);
  const [loading, setLoading] = useState<boolean>(() => readSessionPointer() !== null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  // The open six-digit challenge. Kept in memory only: a reload should start
  // the login over rather than resume a half-finished verification.
  const [pendingChallenge, setPendingChallenge] = useState<PendingChallenge | null>(null);

  // Guards against a slow response for a customer who already signed out.
  const activeRef = useRef<string | null>(readSessionPointer());

  const clearError = useCallback(() => setError(null), []);

  /** Re-read the signed-in customer from Supabase. Never falls back to cache. */
  const refreshUser = useCallback(async () => {
    const clientRef = activeRef.current;
    if (!clientRef) {
      setUser(null);
      setError(null);
      return;
    }
    try {
      const fresh = await fetchCustomerAccount(clientRef);
      if (activeRef.current !== clientRef) return; // signed out / switched
      if (!fresh) {
        // Row is gone (e.g. reset database) — end the session cleanly.
        activeRef.current = null;
        writeSessionPointer(null);
        setUser(null);
        setError("Your account is no longer available. Please sign in again.");
        return;
      }
      setUser(fresh);
      setError(null);
      setVersion((v) => v + 1);
    } catch (e) {
      if (activeRef.current !== clientRef) return;
      // Explicitly NOT falling back to localStorage: surface the failure.
      setError(e instanceof DatabaseError ? e.message : "Could not refresh your account data.");
    }
  }, []);

  // Cross-device sync for the signed-in customer.
  //
  // Mirrors the content provider's `focus` refresh in src/admin/store.tsx. A
  // customer tab left open would otherwise keep showing the balances it loaded
  // at sign-in, so an admin edit or a transaction made on another device would
  // not appear until the tab was reloaded. Re-reading on focus closes that gap;
  // reads are already cheap and every one is a fresh Supabase query.
  //
  // The ref keeps the listener from re-subscribing whenever refreshUser changes
  // identity, and the effect only runs while a session pointer exists.
  const refreshRef = useRef(refreshUser);
  refreshRef.current = refreshUser;
  useEffect(() => {
    if (!readSessionPointer()) return;
    const onFocus = () => void refreshRef.current();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Hydrate the saved session from Supabase on first load.
  useEffect(() => {
    const clientRef = readSessionPointer();
    if (!clientRef) {
      setLoading(false);
      return;
    }
    activeRef.current = clientRef;
    setLoading(true);
    fetchCustomerAccount(clientRef)
      .then((fresh) => {
        if (activeRef.current !== clientRef) return;
        if (fresh) {
          setUser(fresh);
        } else {
          activeRef.current = null;
          writeSessionPointer(null);
        }
      })
      .catch((e) => {
        if (activeRef.current !== clientRef) return;
        setError(
          e instanceof DatabaseError
            ? e.message
            : "Could not reach the database to restore your session."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  /**
   * Phase 1: password check, then open a six-digit challenge.
   *
   * No session is created here on purpose. The dashboard gate reads `user`, so
   * leaving it null is what keeps the banking screens shut until the code is
   * accepted — there is no route to #dashboard that skips `completeSignIn`.
   */
  const signIn = useCallback(
    async (identifier: string, password: string): Promise<SignInTicket | null> => {
      setError(null);

      // Throws DatabaseError if the lookup itself fails — the caller shows it.
      const candidate = await findLoginCandidate(identifier);
      if (!candidate) return null; // no such customer
      if (!candidate.password || candidate.password !== password) return null; // wrong password

      // Read the account up front so the verification screen can greet the
      // customer by name and so a missing row fails here rather than after the
      // code step.
      const account = await fetchCustomerAccount(candidate.clientRef);
      if (!account) return null;

      // The database re-checks the password and, in the same call, invalidates
      // any challenge this customer already had outstanding.
      const challengeId = await startLoginVerification(candidate.clientRef, password);

      const ticket: PendingChallenge = {
        challengeId,
        clientRef: account.id,
        displayName: account.fullName,
        createdAt: Date.now(),
      };
      setPendingChallenge(ticket);
      return ticket;
    },
    []
  );

  /**
   * Phase 2: submit the code. The session is created only after the database
   * confirms the code, so a wrong or expired code leaves `user` null and the
   * customer on the verification screen.
   */
  const completeSignIn = useCallback(
    async (code: string): Promise<boolean> => {
      const pending = pendingChallenge;
      if (!pending) return false;

      const confirmedRef = await verifyLoginCode(pending.clientRef, pending.challengeId, code);
      if (!confirmedRef) return false; // wrong / expired / already used / out of attempts

      const account = await fetchCustomerAccount(confirmedRef);
      if (!account) return false;

      activeRef.current = account.id;
      writeSessionPointer(account.id);
      setUser(account);
      setPendingChallenge(null);
      setError(null);
      setVersion((v) => v + 1);
      return true;
    },
    [pendingChallenge]
  );

  const cancelVerification = useCallback(() => {
    setPendingChallenge(null);
    setError(null);
  }, []);

  const signOut = useCallback(() => {
    activeRef.current = null;
    writeSessionPointer(null);
    setUser(null);
    setError(null);
    setPendingChallenge(null);
  }, []);

  const freezeCard = useCallback(async (cardId: string, frozen: boolean) => {
    const clientRef = activeRef.current;
    if (!clientRef) throw new DatabaseError("You are not signed in.");
    const fresh = await dbSetCardFrozen(clientRef, cardId, frozen);
    setUser(fresh);
    setVersion((v) => v + 1);
  }, []);

  const sendMoney = useCallback(
    async (params: { from: AccountKind; amount: number; merchant: string }) => {
      const clientRef = activeRef.current;
      if (!clientRef) throw new DatabaseError("You are not signed in.");
      const fresh = await dbSendMoney({ clientRef, ...params });
      setUser(fresh);
      setVersion((v) => v + 1);
    },
    []
  );

  const breakFixedSavings = useCallback(
    async (params: { amount: number; merchant: string }) => {
      const clientRef = activeRef.current;
      if (!clientRef) throw new DatabaseError("You are not signed in.");
      const { account, result } = await dbBreakFixedSavings({ clientRef, ...params });
      setUser(account);
      setVersion((v) => v + 1);
      return result;
    },
    []
  );

  const moveMoney = useCallback(
    async (params: { from: AccountKind; to: AccountKind; amount: number; merchant: string }) => {
      const clientRef = activeRef.current;
      if (!clientRef) throw new DatabaseError("You are not signed in.");
      const fresh = await dbMoveMoney({ clientRef, ...params });
      setUser(fresh);
      setVersion((v) => v + 1);
    },
    []
  );

  return (
    <AuthCtx.Provider
      value={{
        user,
        loading,
        error,
        version,
        signIn,
        completeSignIn,
        pendingChallenge,
        cancelVerification,
        signOut,
        refreshUser,
        clearError,
        freezeCard,
        sendMoney,
        moveMoney,
        breakFixedSavings,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/* ==========================================================================
 * Formatting helpers (unchanged)
 * ========================================================================== */

export function formatMoney(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
