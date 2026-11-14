import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Account = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  password: string;
  memberSince: string;
  memberId: string;
  initials: string;
  balance: { checking: number; savings: number };
  cards: Card[];
  transactions: Transaction[];
};

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
  amount: number;
  date: string;
  account: "checking" | "savings";
};

/**
 * Canonical starting point. Admin edits persist to localStorage and
 * REPLACE these defaults on subsequent loads.
 */
export const defaultAccounts: Account[] = [
  {
    id: "demo-1",
    fullName: "Alex Morgan",
    username: "alex",
    email: "alex@riverbend.bank",
    password: "demo1234",
    memberSince: "2019-04-12",
    memberId: "MBR-DEMO-1-001",
    initials: "AM",
    balance: { checking: 12480.5, savings: 38250.0 },
    cards: [
      { id: "c1", label: "Everyday checking", last4: "4218", network: "Visa", expiry: "09/28", frozen: false },
      { id: "c2", label: "Travel rewards", last4: "8830", network: "Mastercard", expiry: "02/27", frozen: false },
      { id: "c3", label: "Joint savings", last4: "1147", network: "Visa", expiry: "11/26", frozen: true },
    ],
    transactions: [
      { id: "t1", merchant: "Payroll · Northwind Group", category: "Income", amount: 3200, date: "2026-02-01", account: "checking" },
      { id: "t2", merchant: "Coffee & Co.", category: "Food", amount: -4.8, date: "2026-02-02", account: "checking" },
      { id: "t3", merchant: "Whole Foods", category: "Groceries", amount: -62.3, date: "2026-02-03", account: "checking" },
      { id: "t4", merchant: "Transfer to savings", category: "Transfer", amount: -500, date: "2026-02-04", account: "checking" },
      { id: "t5", merchant: "Spotify", category: "Subscriptions", amount: -11.99, date: "2026-02-05", account: "checking" },
      { id: "t6", merchant: "Vilnius → Riga train", category: "Travel", amount: -29.0, date: "2026-02-06", account: "checking" },
      { id: "t7", merchant: "Interest", category: "Income", amount: 84.12, date: "2026-02-07", account: "savings" },
      { id: "t8", merchant: "Gym membership", category: "Health", amount: -38.0, date: "2026-02-08", account: "checking" },
    ],
  },
  {
    id: "demo-2",
    fullName: "Jordan Reyes",
    username: "jordan",
    email: "jordan@riverbend.bank",
    password: "demo1234",
    memberSince: "2022-09-30",
    memberId: "MBR-DEMO-2-001",
    initials: "JR",
    balance: { checking: 4210.75, savings: 11800.0 },
    cards: [
      { id: "c4", label: "Daily debit", last4: "0092", network: "Visa", expiry: "05/29", frozen: false },
      { id: "c5", label: "Backup credit", last4: "5533", network: "Mastercard", expiry: "08/27", frozen: false },
    ],
    transactions: [
      { id: "t9", merchant: "Payroll · Freelance", category: "Income", amount: 1850, date: "2026-02-02", account: "checking" },
      { id: "t10", merchant: "AWS", category: "Software", amount: -42.0, date: "2026-02-03", account: "checking" },
      { id: "t11", merchant: "Lunch", category: "Food", amount: -13.5, date: "2026-02-04", account: "checking" },
    ],
  },
];

const ACCOUNTS_KEY = "riverbend_accounts_v4";
const SESSION_KEY = "riverbend_session_v4";

/**
 * Read accounts from localStorage. Always reads fresh — no caching.
 * Returns defaults if no data is saved or if parsing fails.
 */
export function readAccounts(): Account[] {
  if (typeof window === "undefined") {
    return JSON.parse(JSON.stringify(defaultAccounts));
  }
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) {
      return JSON.parse(JSON.stringify(defaultAccounts));
    }
    const parsed = JSON.parse(raw) as Account[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return JSON.parse(JSON.stringify(defaultAccounts));
    }
    return parsed;
  } catch {
    return JSON.parse(JSON.stringify(defaultAccounts));
  }
}

/** Write the accounts array to localStorage. */
export function writeAccounts(accounts: Account[]) {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    // Also clear any stale data from previous storage key versions
    cleanupOldAccountKeys();
  } catch {}
}

/**
 * Remove stale accounts data from previous key versions so they don't
 * confuse future migrations.
 */
function cleanupOldAccountKeys() {
  try {
    const oldKeys = [
      "riverbend_accounts_v1",
      "riverbend_accounts_v2",
      "riverbend_accounts_v3",
    ];
    oldKeys.forEach((k) => window.localStorage.removeItem(k));
  } catch {}
}

/**
 * Convenience accessor used by the admin editor and any read-only consumer.
 * Always returns the latest persisted array by reading directly from
 * localStorage on every call. Use this if you need the freshest data.
 */
export function getSampleAccounts(): Account[] {
  return readAccounts();
}

/**
 * Backwards-compat alias used elsewhere in the codebase.
 * Reads through to the latest persisted array on every property access.
 */
export const sampleAccounts: Account[] = new Proxy([] as Account[], {
  get(_target, prop) {
    const arr = readAccounts();
    // @ts-expect-error generic proxy pass-through
    return arr[prop];
  },
}) as Account[];

type Ctx = {
  user: Account | null;
  signIn: (username: string, password: string) => Account | null;
  signOut: () => void;
  updateAccount: (patch: Partial<Account>) => void;
  setUserBalance: (
    userId: string,
    account: "checking" | "savings",
    value: number
  ) => void;
  refreshUser: () => void;
  setCardholderName: (userId: string, cardId: string, name: string) => void;
  setAccountCredentials: (
    userId: string,
    patch: { username?: string; password?: string; memberId?: string; email?: string }
  ) => void;
  version: number;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Read directly from localStorage on mount so a refresh shows the saved data.
  const [user, setUser] = useState<Account | null>(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const id = JSON.parse(raw) as string;
      return readAccounts().find((a) => a.id === id) ?? null;
    } catch {
      return null;
    }
  });
  const [version, setVersion] = useState(0);

  // When accounts-changed fires anywhere, re-read from storage and bump version
  useEffect(() => {
    const onChange = () => {
      setVersion((v) => v + 1);
      setUser((prev) => {
        if (!prev) return null;
        const fresh = readAccounts().find((a) => a.id === prev.id);
        return fresh ? { ...fresh } : null;
      });
    };
    // pageshow fires on initial load AND when restored from bfcache
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Restored from bfcache — force a re-read
        onChange();
      } else {
        // Normal load — also re-sync in case the React state was stale
        onChange();
      }
    };
    window.addEventListener("riverbend:accounts-changed", onChange);
    window.addEventListener("storage", (e) => {
      if (e.key === ACCOUNTS_KEY) onChange();
    });
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("riverbend:accounts-changed", onChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const persistSession = useCallback((u: Account | null) => {
    try {
      if (u) window.localStorage.setItem(SESSION_KEY, JSON.stringify(u.id));
      else window.localStorage.removeItem(SESSION_KEY);
    } catch {}
  }, []);

  const signIn = useCallback(
    (username: string, password: string): Account | null => {
      // Always read the freshest accounts when signing in
      const fresh = readAccounts().find(
        (a) =>
          (a.username.toLowerCase() === username.toLowerCase() ||
            a.email.toLowerCase() === username.toLowerCase()) &&
          a.password === password
      );
      if (fresh) {
        setUser({ ...fresh });
        persistSession(fresh);
        return fresh;
      }
      return null;
    },
    [persistSession]
  );

  const signOut = useCallback(() => {
    setUser(null);
    persistSession(null);
  }, [persistSession]);

  const updateAccount = useCallback(
    (patch: Partial<Account>) => {
      setUser((prev) => {
        if (!prev) return prev;
        const all = readAccounts();
        const idx = all.findIndex((a) => a.id === prev.id);
        if (idx < 0) return prev;
        const next = { ...prev, ...patch };
        all[idx] = next;
        writeAccounts(all);
        window.dispatchEvent(new CustomEvent("riverbend:accounts-changed"));
        return next;
      });
    },
    []
  );

  const setUserBalance = useCallback(
    (userId: string, account: "checking" | "savings", value: number) => {
      const all = readAccounts();
      const idx = all.findIndex((a) => a.id === userId);
      if (idx < 0) return;
      const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
      all[idx] = {
        ...all[idx],
        balance: { ...all[idx].balance, [account]: safe },
      };
      writeAccounts(all);
      window.dispatchEvent(new CustomEvent("riverbend:accounts-changed"));
    },
    []
  );

  const setCardholderName = useCallback(
    (userId: string, cardId: string, name: string) => {
      const all = readAccounts();
      const idx = all.findIndex((a) => a.id === userId);
      if (idx < 0) return;
      all[idx] = {
        ...all[idx],
        cards: all[idx].cards.map((c) =>
          c.id === cardId ? { ...c, cardholderName: name } : c
        ),
      };
      writeAccounts(all);
      window.dispatchEvent(new CustomEvent("riverbend:accounts-changed"));
    },
    []
  );

  const setAccountCredentials = useCallback(
    (
      userId: string,
      patch: { username?: string; password?: string; memberId?: string; email?: string }
    ) => {
      const all = readAccounts();
      const idx = all.findIndex((a) => a.id === userId);
      if (idx < 0) return;
      all[idx] = {
        ...all[idx],
        ...(patch.username !== undefined ? { username: patch.username } : {}),
        ...(patch.password !== undefined ? { password: patch.password } : {}),
        ...(patch.memberId !== undefined ? { memberId: patch.memberId } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
      };
      writeAccounts(all);
      window.dispatchEvent(new CustomEvent("riverbend:accounts-changed"));
    },
    []
  );

  const refreshUser = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const fresh = readAccounts().find((a) => a.id === prev.id);
      return fresh ? { ...fresh } : prev;
    });
    setVersion((v) => v + 1);
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        user,
        signIn,
        signOut,
        updateAccount,
        setUserBalance,
        refreshUser,
        setCardholderName,
        setAccountCredentials,
        version,
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