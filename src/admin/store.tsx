import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DatabaseError } from "../account/db";
import { fetchSiteContent, saveSiteContent } from "./db";

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
      /** Milestone 5 — activity period navigation. */
      demoBadge: string;
      demoNote: string;
      periodEmpty: string;
      periodFuture: string;
      periodSelectLabel: string;
      rangeStartLabel: string;
      rangeEndLabel: string;
      rangeClear: string;
      prevMonth: string;
      nextMonth: string;
      earliestLabel: string;
      /** Account activity is capped at this many rows; "See All" opens the rest. */
      seeAll: string;
      seeAllHint: string;
      showingCount: string;
      allActivityHeading: string;
      allActivitySub: string;
      allActivityFilterLabel: string;
      seeAllBack: string;
      /** Milestone 8 — promotional card in the Fixed savings activity area. */
      promoEyebrow: string;
      promoRate: string;
      promoBody: string;
      promoNote: string;
      /** Separator sitting between an account's name and its identifier. */
      accountIdSeparator: string;
    };
    statements: {
      heading: string;
      sub: string;
      back: string;
      startLabel: string;
      endLabel: string;
      fullHistory: string;
      last90: string;
      invalidPeriod: string;
      openingBalance: string;
      totalReceived: string;
      totalSpent: string;
      closingBalance: string;
      download: string;
      generating: string;
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
      /** Label for the Routing Number field. */
      routingNumberLabel: string;
      /** Label for the SWIFT Code / BIC field. */
      swiftCodeLabel: string;
      /** Label for the Recipient Address field. */
      recipientAddressLabel: string;
      amountLabel: string;
      noteLabel: string;
      submitLabel: string;
      successHeadline: string;
      successBody: string;
      fixedSavingsWarning: string;
      /** Shown on Send when the admin has set the Checking account inactive. */
      inactiveCheckingWarning: string;
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
      /** Button label before the fee preview is shown. */
      continueLabel: string;
      /** Button label on the second step, after the fee preview. */
      confirmLabel: string;
      /** Label for the read-only fee field. */
      breakingFeeLabel: string;
      /** Label for the read-only net-credit field. */
      withdrawAmountLabel: string;
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
      demoBadge: "Demo",
      demoNote: "Includes demonstration history. Not real financial records.",
      periodEmpty: "No activity in this period.",
      periodFuture: "This month hasn't happened yet.",
      periodSelectLabel: "Period",
      rangeStartLabel: "From",
      rangeEndLabel: "To",
      rangeClear: "Clear dates",
      prevMonth: "Previous month",
      nextMonth: "Next month",
      seeAll: "See All",
      seeAllHint: "Showing {total} transactions for this period. See All opens your full history.",
      showingCount: "Showing {shown} of {total}",
      allActivityHeading: "All activity",
      allActivitySub: "Your complete history — {count} transactions, newest first.",
      allActivityFilterLabel: "Filter by account",
      seeAllBack: "Back to accounts",
      promoEyebrow: "HIGH-YIELD SAVINGS",
      promoRate: "18% p.a.",
      promoBody:
        "Put your savings to work. Grow your balance with one of our most competitive fixed savings rates, applied to the full term of your deposit.",
      promoNote: "Illustrative rate. Existing balances and transactions are unchanged.",
      accountIdSeparator: "·",
      earliestLabel: "Earliest",
    },
    statements: {
      heading: "Download a statement",
      sub: "Choose an account and a period, then download a PDF.",
      back: "Back to accounts",
      startLabel: "From",
      endLabel: "To",
      fullHistory: "Full history",
      last90: "Last 90 days",
      invalidPeriod: "Choose a start date on or before the end date.",
      openingBalance: "Opening balance",
      totalReceived: "Money received",
      totalSpent: "Money spent",
      closingBalance: "Closing balance",
      download: "Download PDF statement",
      generating: "Preparing…",
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
      routingNumberLabel: "Routing Number",
      swiftCodeLabel: "SWIFT Code / BIC",
      recipientAddressLabel: "Recipient Address",
      amountLabel: "Amount",
      noteLabel: "Note (optional)",
      submitLabel: "Send",
      successHeadline: "Transfer sent.",
      successBody: "Your transfer is on its way. We'll notify the recipient and update both accounts right away.",
      fixedSavingsWarning: "Fixed savings cannot be sent from directly. Funds in your fixed savings are locked until maturity and can only be moved internally to your Checking account via the Move flow, where the term-break rules apply.",
      inactiveCheckingWarning:
        "Your Checking account is currently inactive. External transfers are temporarily unavailable. Please contact our support team for assistance.",
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
      continueLabel: "Continue",
      confirmLabel: "Continue",
      breakingFeeLabel: "Breaking Fee",
      withdrawAmountLabel: "Withdraw Amount",
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
  /** True while the document is being loaded from Supabase. */
  loading: boolean;
  /** A load/save failure, ready to show in the dashboard. */
  error: string | null;
  /** Persist the whole document to Supabase. Throws DatabaseError on failure. */
  setContent: (c: ContentState) => Promise<void>;
  /** Write the defaults back to Supabase. */
  resetContent: () => Promise<void>;
  /** Re-read the document from Supabase. */
  refreshContent: () => Promise<void>;
  clearError: () => void;
  isAdmin: boolean;
  loginAdmin: (email: string, password: string) => boolean;
  logoutAdmin: () => void;
};

const ContentCtx = createContext<Ctx | null>(null);

// Admin *session* only. Website content lives in Supabase (site_content).
const ADMIN_KEY = "riverbend_admin_v5";
export const ADMIN_EMAIL = "hhrqqa@gmail.com";
export const ADMIN_PASSWORD = "67500363oi!";

/**
 * Merge a stored document over the defaults.
 *
 * A stored document always wins, but any section missing from it (an older
 * save, or a partial import) falls back to the default so a page can never
 * render `undefined`. Operates on the same shape returned by Supabase.
 */
function mergeWithDefaults(parsed: Partial<ContentState>): ContentState {
  return {
    ...defaultContent,
    ...parsed,
    brand: { ...defaultContent.brand, ...parsed.brand },
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
      statements: { ...defaultContent.account.statements, ...(parsed.account?.statements ?? {}) },
      cards: { ...defaultContent.account.cards, ...(parsed.account?.cards ?? {}) },
      profile: { ...defaultContent.account.profile, ...(parsed.account?.profile ?? {}) },
      send: { ...defaultContent.account.send, ...(parsed.account?.send ?? {}) },
      move: { ...defaultContent.account.move, ...(parsed.account?.move ?? {}) },
      login: { ...defaultContent.account.login, ...(parsed.account?.login ?? {}) },
    },
  };
}

export function ContentProvider({ children }: { children: ReactNode }) {
  // Renders immediately with the last-known/default document, then replaces it
  // with whatever Supabase holds. Nothing is read from localStorage.
  const [content, setContentState] = useState<ContentState>(defaultContent);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      // Admin *session* flag only — website content is not stored here.
      return window.localStorage.getItem(ADMIN_KEY) === "1";
    } catch {
      return false;
    }
  });

  const clearError = useCallback(() => setError(null), []);

  /** Re-read the document from Supabase. Never falls back to a cached copy. */
  const refreshContent = useCallback(async () => {
    try {
      const stored = await fetchSiteContent();
      setContentState(stored ? mergeWithDefaults(stored) : defaultContent);
      setError(null);
      setVersion((v) => v + 1);
    } catch (e) {
      // Surface the failure instead of quietly rendering stale content.
      setError(e instanceof DatabaseError ? e.message : "Could not load website content.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshContent();
  }, [refreshContent]);

  /**
   * Persist the whole document to Supabase, then adopt it locally.
   * The state only changes after the write succeeds, so a failed save can
   * never leave the UI showing content the database does not have.
   */
  const setContent = useCallback(async (c: ContentState) => {
    try {
      await saveSiteContent(c);
      setContentState(c);
      setError(null);
      setVersion((v) => v + 1);
      window.dispatchEvent(new CustomEvent("riverbend:content-changed"));
    } catch (e) {
      const err = e instanceof DatabaseError ? e : new DatabaseError("Could not save website content.");
      setError(err.message);
      throw err; // let the admin surface it
    }
  }, []);

  const resetContent = useCallback(async () => {
    await setContent(defaultContent);
  }, [setContent]);

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

  // Cross-tab / cross-client sync: another tab saving to Supabase is picked up
  // when the window regains focus. (There is no `storage` event for Supabase.)
  const refreshRef = useRef(refreshContent);
  refreshRef.current = refreshContent;
  useEffect(() => {
    const onFocus = () => void refreshRef.current();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <ContentCtx.Provider
      value={{
        content,
        version,
        loading,
        error,
        setContent,
        resetContent,
        refreshContent,
        clearError,
        isAdmin,
        loginAdmin,
        logoutAdmin,
      }}
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