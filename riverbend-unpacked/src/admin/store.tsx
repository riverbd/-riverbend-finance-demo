import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type ContentState = {
  brand: { name: string; tagline: string };
  hero: {
    badge: string;
    headline: string;
    headlineAccent: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
    trustBadges: string[];
  };
  contact: {
    address: string;
    phone: string;
    email: string;
    hours: string;
    reasons: string[];
    formIntro: string;
  };
  about: {
    eyebrow: string;
    headline: string;
    intro: string;
    storyEyebrow: string;
    storyHeadline: string;
    storyParagraphs: string[];
    values: { title: string; body: string }[];
    footprintEyebrow: string;
    footprintStats: { label: string; value: string }[];
  };
  signup: { headline: string; body: string };
  login: { headline: string; body: string };
  account: {
    dashboard: {
      welcomeEyebrow: string;
      quickActions: { label: string; target: string }[];
      recentHeading: string;
      recentSeeAll: string;
    };
    accounts: {
      heading: string;
      sub: string;
      checkingLabel: string;
      savingsLabel: string;
      activityHeading: string;
      emptyMessage: string;
    };
    cards: {
      heading: string;
      sub: string;
      frozenBadge: string;
      freezeButton: string;
      unfreezeButton: string;
      securityNote: string;
      expiresLabel: string;
    };
    profile: {
      netWorthLabel: string;
      cardsLabel: string;
      memberSinceLabel: string;
      accountGroup: string;
      securityGroup: string;
      preferencesGroup: string;
      usernameLabel: string;
      emailLabel: string;
      memberIdLabel: string;
      twoFactorLabel: string;
      twoFactorEnabled: string;
      lastSignInLabel: string;
      changePasswordLabel: string;
      notificationsLabel: string;
      languageLabel: string;
      currencyLabel: string;
      signOutLabel: string;
      sampleNote: string;
    };
    send: {
      heading: string;
      sub: string;
      fromLabel: string;
      toLabel: string;
      recipientNameLabel: string;
      recipientAccountLabel: string;
      recipientBankLabel: string;
      amountLabel: string;
      noteLabel: string;
      submitLabel: string;
      successHeadline: string;
      successBody: string;
      fixedSavingsWarning: string;
    };
    move: {
      heading: string;
      sub: string;
      fromLabel: string;
      toLabel: string;
      amountLabel: string;
      submitLabel: string;
      successHeadline: string;
      successBody: string;
      restrictionWarning: string;
    };
    login: {
      submittingLabel: string;
      successLabel: string;
    };
  };
};

export const defaultContent: ContentState = {
  brand: {
    name: "RIVERBEND",
    tagline: "A family financial business, globally rooted",
  },
  hero: {
    badge: "A family financial business, globally rooted",
    headline: "Finance that flows",
    headlineAccent: "with you.",
    body: "RIVERBEND is a family-led financial group with a global footprint. We're building banking that listens first — and bends with the lives of the people we serve.",
    primaryCta: "Contact us",
    secondaryCta: "About RIVERBEND",
    trustBadges: [
      "Headquartered in Vilnius",
      "Operating across 4 continents",
      "Family-led since day 1",
    ],
  },
  contact: {
    address: "Gedimino pr. 24, LT-01103 Vilnius, Lithuania",
    phone: "+370 5 210 4500",
    email: "support@riverbend.bank",
    hours: "Mon – Fri · 8:00 – 20:00 (EET) · Sat 9:00 – 14:00",
    reasons: [
      "Open a new account",
      "Account support",
      "Loans & credit",
      "Report an issue",
      "Partnership inquiry",
      "Other",
    ],
    formIntro: "Fill in your details and tell us how we can help.",
  },
  about: {
    eyebrow: "About RIVERBEND",
    headline: "A family business, with the reach of a continent.",
    intro: "RIVERBEND began as a single family office in Vilnius — a quiet promise to look after the people we love. Three generations later, that promise has grown into a global financial group, but the family values remain the same.",
    storyEyebrow: "Our story",
    storyHeadline: "Built on trust. Grown with care.",
    storyParagraphs: [
      "What started as a family helping family — parents guiding children through their first savings account, siblings pooling resources for a first home — became a quiet revolution. We realized the best banking is the kind that listens before it speaks.",
      "Today, RIVERBEND operates across multiple continents, holding companies and partner institutions from the Baltics to Southeast Asia, Western Europe, and North America. Our conglomerate spans retail banking, wealth management, family-office services, and community development finance.",
      "Despite our scale, we remain family-led and family-hearted. Every account is opened with a handshake, every decision passes through a council that includes voices from the communities we serve, and every product is built to bend with the lives of real people.",
    ],
    values: [
      { title: "Family first", body: "Every product starts with the question: would we put our own family in this?" },
      { title: "Global reach, local care", body: "Our footprint spans continents, but every branch knows its neighbors by name." },
      { title: "Quiet excellence", body: "We measure success not in headlines, but in the lives we quietly improve." },
    ],
    footprintEyebrow: "Our footprint",
    footprintStats: [
      { label: "Continents", value: "4" },
      { label: "Countries", value: "23" },
      { label: "Family offices", value: "11" },
      { label: "Members served", value: "1.2M+" },
    ],
  },
  signup: {
    headline: "Become a RIVERBEND member.",
    body: "Membership with RIVERBEND is opened in person — it's part of how we know our members and protect your account from day one.",
  },
  login: {
    headline: "Welcome back.",
    body: "Sign in to access your accounts.",
  },
  account: {
    dashboard: {
      welcomeEyebrow: "Welcome back",
      quickActions: [
        { label: "Send", target: "send" },
        { label: "Freeze", target: "cards" },
        { label: "Cards", target: "cards" },
        { label: "Profile", target: "profile" },
      ],
      recentHeading: "Recent activity",
      recentSeeAll: "See all",
    },
    accounts: {
      heading: "Accounts",
      sub: "Tap an account to see its activity.",
      checkingLabel: "Checking",
      savingsLabel: "Fixed savings",
      activityHeading: "{account} activity",
      emptyMessage: "No activity yet.",
    },
    cards: {
      heading: "Cards",
      sub: "Manage your debit and credit cards. Freeze anytime if misplaced.",
      frozenBadge: "Frozen",
      freezeButton: "Freeze",
      unfreezeButton: "Unfreeze",
      securityNote: "Freezing a card blocks new purchases and online transactions instantly. Recurring payments and ATM access are paused until you unfreeze.",
      expiresLabel: "Expires",
    },
    profile: {
      netWorthLabel: "Net worth",
      cardsLabel: "Cards",
      memberSinceLabel: "Member since",
      accountGroup: "Account",
      securityGroup: "Security",
      preferencesGroup: "Preferences",
      usernameLabel: "Username",
      emailLabel: "Email",
      memberIdLabel: "Member ID",
      twoFactorLabel: "Two-factor auth",
      twoFactorEnabled: "Enabled",
      lastSignInLabel: "Last sign-in",
      changePasswordLabel: "Change password",
      notificationsLabel: "Notifications",
      languageLabel: "Language",
      currencyLabel: "Currency",
      signOutLabel: "Sign out of RIVERBEND",
      sampleNote: "Sample account · Not a real financial institution",
    },
    send: {
      heading: "Send money",
      sub: "Move funds to anyone, anywhere.",
      fromLabel: "From",
      toLabel: "To",
      recipientNameLabel: "Recipient name",
      recipientAccountLabel: "Recipient account number",
      recipientBankLabel: "Recipient bank",
      amountLabel: "Amount",
      noteLabel: "Note (optional)",
      submitLabel: "Send",
      successHeadline: "Transfer sent.",
      successBody: "Your transfer is on its way. We'll notify the recipient and update both accounts right away.",
      fixedSavingsWarning: "Fixed savings cannot be sent from directly. Funds in your fixed savings are locked until maturity and can only be moved internally to your Checking account via the Move flow, where the term-break rules apply.",
    },
    move: {
      heading: "Move money",
      sub: "Transfer between your own accounts.",
      fromLabel: "From",
      toLabel: "To",
      amountLabel: "Amount",
      submitLabel: "Move funds",
      successHeadline: "Funds moved.",
      successBody: "Your transfer between accounts is complete and reflected in both balances.",
      restrictionWarning: "Fixed savings funds are locked until maturity. Moving from Fixed savings to Checking will break the term and may incur a penalty. This action cannot be undone.",
    },
    login: {
      submittingLabel: "Signing you in…",
      successLabel: "Welcome back",
    },
  },
};

type Ctx = {
  content: ContentState;
  /** Bumps on every save so consumers can re-read live. */
  version: number;
  setContent: (c: ContentState) => void;
  resetContent: () => void;
  isAdmin: boolean;
  loginAdmin: (email: string, password: string) => boolean;
  logoutAdmin: () => void;
};

const ContentCtx = createContext<Ctx | null>(null);

// Bumping this key forces a clean slate for anyone with stale localStorage
const STORAGE_KEY = "riverbend_content_v5";
const ADMIN_KEY = "riverbend_admin_v5";
export const ADMIN_EMAIL = "hhrqqa@gmail.com";
export const ADMIN_PASSWORD = "67500363oi!";

/**
 * Read the persisted content from localStorage.
 * Always returns the latest persisted state, or defaults if nothing is saved.
 * No merge — what you saved is what you get.
 */
function loadContent(): ContentState {
  if (typeof window === "undefined") return defaultContent;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultContent;
    const parsed = JSON.parse(raw) as ContentState;
    // Backfill any missing top-level keys from defaults so old saves still render.
    return {
      ...defaultContent,
      ...parsed,
      hero: { ...defaultContent.hero, ...parsed.hero },
      contact: { ...defaultContent.contact, ...parsed.contact },
      about: { ...defaultContent.about, ...parsed.about },
      signup: { ...defaultContent.signup, ...parsed.signup },
      login: { ...defaultContent.login, ...parsed.login },
      account: {
        ...defaultContent.account,
        ...(parsed.account ?? {}),
        dashboard: { ...defaultContent.account.dashboard, ...(parsed.account?.dashboard ?? {}) },
        accounts: { ...defaultContent.account.accounts, ...(parsed.account?.accounts ?? {}) },
        cards: { ...defaultContent.account.cards, ...(parsed.account?.cards ?? {}) },
        profile: { ...defaultContent.account.profile, ...(parsed.account?.profile ?? {}) },
        send: { ...defaultContent.account.send, ...(parsed.account?.send ?? {}) },
        move: { ...defaultContent.account.move, ...(parsed.account?.move ?? {}) },
        login: { ...defaultContent.account.login, ...(parsed.account?.login ?? {}) },
      },
    };
  } catch {
    return defaultContent;
  }
}

function saveContent(c: ContentState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    // Clear any stale data from previous storage key versions
    cleanupOldContentKeys();
  } catch {}
}

function cleanupOldContentKeys() {
  try {
    const oldKeys = [
      "riverbend_content_v1",
      "riverbend_content_v2",
      "riverbend_content_v3",
      "riverbend_content_v4",
    ];
    oldKeys.forEach((k) => window.localStorage.removeItem(k));
  } catch {}
}

export function ContentProvider({ children }: { children: ReactNode }) {
  // Always start by reading from localStorage so a refresh shows the saved state.
  const [content, setContentState] = useState<ContentState>(loadContent);
  const [version, setVersion] = useState(0);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(ADMIN_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Wrap setContent so every save ALSO writes to localStorage in the same tick
  // AND bumps the version counter so every consumer re-renders.
  const setContent = useCallback((c: ContentState) => {
    saveContent(c); // disk first, so even a hard refresh immediately after will see it
    setContentState(c);
    setVersion((v) => v + 1);
    // Notify same-tab listeners too (the storage event only fires in OTHER tabs).
    window.dispatchEvent(new CustomEvent("riverbend:content-changed"));
    // Helpful for the user to verify saves in DevTools
    // eslint-disable-next-line no-console
    console.log(
      "[RIVERBEND] Content saved",
      new Date().toLocaleTimeString(),
      "— version:",
      version + 1
    );
  }, [version]);

  const resetContent = useCallback(() => {
    saveContent(defaultContent);
    setContentState(defaultContent);
    setVersion((v) => v + 1);
    window.dispatchEvent(new CustomEvent("riverbend:content-changed"));
    console.log("[RIVERBEND] Content reset to defaults");
  }, []);

  const loginAdmin = useCallback((email: string, password: string) => {
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      try {
        window.localStorage.setItem(ADMIN_KEY, "1");
      } catch {}
      setIsAdmin(true);
      return true;
    }
    return false;
  }, []);

  const logoutAdmin = useCallback(() => {
    try {
      window.localStorage.removeItem(ADMIN_KEY);
    } catch {}
    setIsAdmin(false);
  }, []);

  // Cross-tab sync: when another tab saves to localStorage, update here too.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setContentState(JSON.parse(e.newValue) as ContentState);
          setVersion((v) => v + 1);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <ContentCtx.Provider
      value={{ content, version, setContent, resetContent, isAdmin, loginAdmin, logoutAdmin }}
    >
      {children}
    </ContentCtx.Provider>
  );
}

export function useContent() {
  const ctx = useContext(ContentCtx);
  if (!ctx) throw new Error("useContent must be used inside ContentProvider");
  return ctx;
}