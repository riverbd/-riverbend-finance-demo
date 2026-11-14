import { useEffect, useState } from "react";
import { useContent } from "./store";
import type { ContentState } from "./store";
import { RiverbendLogo } from "../components/icons";
import { useAuth, formatMoney } from "../account/auth";
import { DatabaseError } from "../account/db";
import {
  adminSetBalance,
  adminSetCardholderName,
  adminSetCredentials,
  clearAdminCache,
  fetchAdminCustomers,
} from "./db";
import type { AdminCustomer } from "./db";

type Tab =
  | "brand"
  | "hero"
  | "contact"
  | "about"
  | "signup"
  | "login"
  | "account-dash"
  | "account-acc"
  | "account-cards"
  | "account-profile"
  | "account-credentials"
  | "account-send"
  | "account-move"
  | "account-login"
  | "users"
  | "balances"
  | "cardholders"
  | "data";

const tabs: { id: Tab; label: string }[] = [
  { id: "brand", label: "Brand" },
  { id: "hero", label: "Landing · Hero" },
  { id: "contact", label: "Landing · Contact" },
  { id: "about", label: "Landing · About" },
  { id: "signup", label: "Landing · Sign up" },
  { id: "login", label: "Landing · Login" },
  { id: "account-dash", label: "Account · Home" },
  { id: "account-acc", label: "Account · Accounts" },
  { id: "account-cards", label: "Account · Cards" },
  { id: "account-profile", label: "Account · Profile" },
  { id: "account-send", label: "Account · Send" },
  { id: "account-move", label: "Account · Move" },
  { id: "account-login", label: "Account · Login copy" },
  { id: "users", label: "Users" },
  { id: "balances", label: "Balances" },
  { id: "cardholders", label: "Cardholders" },
  { id: "data", label: "Data" },
];

/**
 * Loads the customer table from Supabase for the admin data tabs.
 * Re-reads whenever `version` changes so balances/cards stay in sync with saves.
 */
function useAdminCustomers(version: number) {
  const [rows, setRows] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAdminCustomers()
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof DatabaseError ? e.message : "Could not load customers.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { rows, loading, error };
}

export default function AdminDashboard() {
  const { content, setContent, resetContent, logoutAdmin, isAdmin, loading, error, clearError } =
    useContent();
  const [draft, setDraft] = useState<ContentState>(content);
  const [active, setActive] = useState<Tab>("hero");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(content);
  }, [content]);

  if (!isAdmin) return null;

  const update = (path: (c: ContentState) => ContentState) => {
    setDraft((d) => path({ ...d }));
    setSaved(false);
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const onSave = async () => {
    setSaving(true);
    setSaveError(null);
    clearError();
    try {
      // Writes to Supabase; the provider only adopts it locally on success.
      await setContent(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(
        e instanceof DatabaseError ? e.message : "Could not save content to the database."
      );
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    if (!confirm("Reset all website content to defaults? This cannot be undone.")) return;
    setSaveError(null);
    try {
      await resetContent();
      setDraft(content);
    } catch (e) {
      setSaveError(
        e instanceof DatabaseError ? e.message : "Could not reset content."
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2 text-river-700">
            <RiverbendLogo className="h-6 w-6" />
            <span className="text-base font-semibold tracking-tight text-slate-900">
              RIVERBEND · Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#dashboard"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:inline-flex"
            >
              View account
            </a>
            <a
              href="#top"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:inline-flex"
            >
              View landing
            </a>
            <button
              onClick={logoutAdmin}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 lg:flex-row lg:gap-8 lg:py-10">
        <aside className="lg:w-60">
          <nav className="flex flex-row gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 lg:flex-col lg:overflow-visible">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                  active === t.id
                    ? "bg-river-700 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="mt-4 hidden lg:block">
            <button
              onClick={onSave}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-river-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-river-800"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
            </button>
            <button
              onClick={onReset}
              className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset to defaults
            </button>
            {saved && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Changes saved. Refresh the user account or landing page to see updates.
              </p>
            )}
          </div>
        </aside>

        <main className="flex-1">
          {(saveError || error) && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
              <p className="font-semibold">Database error</p>
              <p className="mt-1">{saveError ?? error}</p>
            </div>
          )}
          {loading && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
              Loading content from the database…
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            {active === "brand" && <BrandEditor draft={draft} onChange={update} />}
            {active === "hero" && <HeroEditor draft={draft} onChange={update} />}
            {active === "contact" && <ContactEditor draft={draft} onChange={update} />}
            {active === "about" && <AboutEditor draft={draft} onChange={update} />}
            {active === "signup" && <SignupEditor draft={draft} onChange={update} />}
            {active === "login" && <LoginEditor draft={draft} onChange={update} />}
            {active === "account-dash" && <DashboardEditor draft={draft} onChange={update} />}
            {active === "account-acc" && <AccountsEditor draft={draft} onChange={update} />}
            {active === "account-cards" && <CardsEditor draft={draft} onChange={update} />}
            {active === "account-profile" && <ProfileEditor draft={draft} onChange={update} />}
            {active === "account-send" && <SendEditor draft={draft} onChange={update} />}
            {active === "account-move" && <MoveEditor draft={draft} onChange={update} />}
            {active === "account-login" && <AccountLoginEditor draft={draft} onChange={update} />}
            {active === "users" && <UsersEditor />}
            {active === "balances" && <BalancesEditor />}
            {active === "cardholders" && <CardholdersEditor />}
            {active === "account-credentials" && <CredentialsEditor />}
            {active === "data" && <DataTab />}
          </div>

          <div className="mt-4 flex gap-2 lg:hidden">
            <button
              onClick={onSave}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-river-700 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
            </button>
            <button
              onClick={onReset}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              Reset
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---------------- Inputs ---------------- */

function Input({
  label,
  value,
  onChange,
  textarea,
  rows,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows ?? 3}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/20"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/20"
        />
      )}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function ListEditor({
  items,
  onChange,
  label,
  addLabel = "+ Add item",
}: {
  items: string[];
  onChange: (next: string[]) => void;
  label: string;
  addLabel?: string;
}) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="mt-2 space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={it}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-river-400 focus:ring-2 focus:ring-river-500/20"
            />
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange([...items, ""])}
        className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-river-400 hover:text-river-700"
      >
        {addLabel}
      </button>
    </div>
  );
}

/* ---------------- Landing Editors ---------------- */

function BrandEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const b = draft.brand;
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Brand</h2>
        <p className="mt-1 text-sm text-slate-500">
          Company name and tagline. Shown in the site header, the footer, the copyright line, and the
          sign-in panel.
        </p>
      </header>
      <Input
        label="Brand name"
        value={b.name}
        onChange={(v) => onChange((c) => ({ ...c, brand: { ...c.brand, name: v } }))}
      />
      <Input
        label="Tagline"
        value={b.tagline}
        onChange={(v) => onChange((c) => ({ ...c, brand: { ...c.brand, tagline: v } }))}
      />
    </div>
  );
}

function AccountLoginEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const l = draft.account.login;
  const set = (patch: Partial<ContentState["account"]["login"]>) =>
    onChange((c) => ({ ...c, account: { ...c.account, login: { ...c.account.login, ...patch } } }));
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Account · Login copy</h2>
        <p className="mt-1 text-sm text-slate-500">
          Text shown while the customer sign-in form is submitting.
        </p>
      </header>
      <Input
        label="Submitting label (shown on the button while signing in)"
        value={l.submittingLabel}
        onChange={(v) => set({ submittingLabel: v })}
      />
      <Input
        label="Success label"
        value={l.successLabel}
        onChange={(v) => set({ successLabel: v })}
        hint="Reserved — not currently displayed by any page."
      />
    </div>
  );
}

function HeroEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const h = draft.hero;
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Landing · Hero</h2>
        <p className="mt-1 text-sm text-slate-500">Headline and call-to-action at the top of the landing page.</p>
      </header>
      <Input label="Badge text" value={h.badge} onChange={(v) => onChange((c) => ({ ...c, hero: { ...c.hero, badge: v } }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Headline (first part)" value={h.headline} onChange={(v) => onChange((c) => ({ ...c, hero: { ...c.hero, headline: v } }))} />
        <Input label="Headline (accent — gradient)" value={h.headlineAccent} onChange={(v) => onChange((c) => ({ ...c, hero: { ...c.hero, headlineAccent: v } }))} />
      </div>
      <Input label="Body copy" textarea rows={3} value={h.body} onChange={(v) => onChange((c) => ({ ...c, hero: { ...c.hero, body: v } }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Primary CTA label" value={h.primaryCta} onChange={(v) => onChange((c) => ({ ...c, hero: { ...c.hero, primaryCta: v } }))} />
        <Input label="Secondary CTA label" value={h.secondaryCta} onChange={(v) => onChange((c) => ({ ...c, hero: { ...c.hero, secondaryCta: v } }))} />
      </div>
      <ListEditor
        label="Trust badges"
        items={h.trustBadges}
        onChange={(next) => onChange((c) => ({ ...c, hero: { ...c.hero, trustBadges: next } }))}
      />
    </div>
  );
}

function ContactEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const c = draft.contact;
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Landing · Contact</h2>
        <p className="mt-1 text-sm text-slate-500">Footer and contact-page details, plus the form's reason options.</p>
      </header>
      <Input label="Address" value={c.address} onChange={(v) => onChange((x) => ({ ...x, contact: { ...x.contact, address: v } }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Phone" value={c.phone} onChange={(v) => onChange((x) => ({ ...x, contact: { ...x.contact, phone: v } }))} />
        <Input label="Email" value={c.email} onChange={(v) => onChange((x) => ({ ...x, contact: { ...x.contact, email: v } }))} />
      </div>
      <Input label="Hours" value={c.hours} onChange={(v) => onChange((x) => ({ ...x, contact: { ...x.contact, hours: v } }))} />
      <Input label="Form intro" value={c.formIntro} onChange={(v) => onChange((x) => ({ ...x, contact: { ...x.contact, formIntro: v } }))} />
      <ListEditor
        label="Reason options (contact form dropdown)"
        items={c.reasons}
        onChange={(next) => onChange((x) => ({ ...x, contact: { ...x.contact, reasons: next } }))}
      />
    </div>
  );
}

function AboutEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const a = draft.about;
  const set = (patch: Partial<ContentState["about"]>) =>
    onChange((c) => ({ ...c, about: { ...c.about, ...patch } }));

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Landing · About</h2>
        <p className="mt-1 text-sm text-slate-500">The story, values, and footprint shown on the About page.</p>
      </header>
      <Input label="Eyebrow" value={a.eyebrow} onChange={(v) => set({ eyebrow: v })} />
      <Input label="Headline" value={a.headline} onChange={(v) => set({ headline: v })} />
      <Input label="Intro" textarea rows={3} value={a.intro} onChange={(v) => set({ intro: v })} />
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Story block</p>
        <div className="mt-3 space-y-3">
          <Input label="Story eyebrow" value={a.storyEyebrow} onChange={(v) => set({ storyEyebrow: v })} />
          <Input label="Story headline" value={a.storyHeadline} onChange={(v) => set({ storyHeadline: v })} />
          <ListEditor
            label="Story paragraphs"
            items={a.storyParagraphs}
            onChange={(next) => set({ storyParagraphs: next })}
            addLabel="+ Add paragraph"
          />
        </div>
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Values</p>
        <div className="mt-3 space-y-3">
          {a.values.map((v, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <Input label={`Value ${i + 1} — title`} value={v.title} onChange={(val) => set({ values: a.values.map((x, j) => (j === i ? { ...x, title: val } : x)) })} />
              <Input label={`Value ${i + 1} — body`} value={v.body} onChange={(val) => set({ values: a.values.map((x, j) => (j === i ? { ...x, body: val } : x)) })} />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Footprint stats</p>
        <div className="mt-3 space-y-2">
          <Input label="Eyebrow" value={a.footprintEyebrow} onChange={(v) => set({ footprintEyebrow: v })} />
          {a.footprintStats.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <Input label={`Stat ${i + 1} — label`} value={s.label} onChange={(val) => set({ footprintStats: a.footprintStats.map((x, j) => (j === i ? { ...x, label: val } : x)) })} />
              <Input label={`Stat ${i + 1} — value`} value={s.value} onChange={(val) => set({ footprintStats: a.footprintStats.map((x, j) => (j === i ? { ...x, value: val } : x)) })} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SignupEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const s = draft.signup;
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Landing · Sign up</h2>
        <p className="mt-1 text-sm text-slate-500">The "Become a member" headline and body on the Sign up page.</p>
      </header>
      <Input label="Headline" value={s.headline} onChange={(v) => onChange((c) => ({ ...c, signup: { ...c.signup, headline: v } }))} />
      <Input label="Body" textarea rows={3} value={s.body} onChange={(v) => onChange((c) => ({ ...c, signup: { ...c.signup, body: v } }))} />
    </div>
  );
}

function LoginEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const l = draft.login;
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Landing · Login</h2>
        <p className="mt-1 text-sm text-slate-500">The headline and body above the sign-in form.</p>
      </header>
      <Input label="Headline" value={l.headline} onChange={(v) => onChange((c) => ({ ...c, login: { ...c.login, headline: v } }))} />
      <Input label="Body" value={l.body} onChange={(v) => onChange((c) => ({ ...c, login: { ...c.login, body: v } }))} />
    </div>
  );
}

/* ---------------- User-account Editors ---------------- */

function DashboardEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const d = draft.account.dashboard;
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Account · Home (dashboard)</h2>
        <p className="mt-1 text-sm text-slate-500">Welcome eyebrow, quick-action buttons, and recent activity section.</p>
      </header>
      <Input
        label="Welcome eyebrow (above name)"
        value={d.welcomeEyebrow}
        onChange={(v) => onChange((c) => ({ ...c, account: { ...c.account, dashboard: { ...c.account.dashboard, welcomeEyebrow: v } } }))}
      />
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Quick actions row</p>
        <div className="mt-3 space-y-2">
          {d.quickActions.map((a, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <Input
                label={`Action ${i + 1} — label`}
                value={a.label}
                onChange={(v) =>
                  onChange((c) => ({
                    ...c,
                    account: {
                      ...c.account,
                      dashboard: {
                        ...c.account.dashboard,
                        quickActions: c.account.dashboard.quickActions.map((x, j) =>
                          j === i ? { ...x, label: v } : x
                        ),
                      },
                    },
                  }))
                }
              />
              <Input
                label={`Action ${i + 1} — target`}
                value={a.target}
                onChange={(v) =>
                  onChange((c) => ({
                    ...c,
                    account: {
                      ...c.account,
                      dashboard: {
                        ...c.account.dashboard,
                        quickActions: c.account.dashboard.quickActions.map((x, j) =>
                          j === i ? { ...x, target: v } : x
                        ),
                      },
                    },
                  }))
                }
                hint="One of: dashboard, accounts, cards, profile, send, move"
              />
            </div>
          ))}
        </div>
      </div>
      <Input
        label="Recent activity heading"
        value={d.recentHeading}
        onChange={(v) => onChange((c) => ({ ...c, account: { ...c.account, dashboard: { ...c.account.dashboard, recentHeading: v } } }))}
      />
      <Input
        label="Recent activity — See all link"
        value={d.recentSeeAll}
        onChange={(v) => onChange((c) => ({ ...c, account: { ...c.account, dashboard: { ...c.account.dashboard, recentSeeAll: v } } }))}
      />
    </div>
  );
}

function AccountsEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const a = draft.account.accounts;
  const set = (patch: Partial<ContentState["account"]["accounts"]>) =>
    onChange((c) => ({ ...c, account: { ...c.account, accounts: { ...c.account.accounts, ...patch } } }));
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Account · Accounts</h2>
        <p className="mt-1 text-sm text-slate-500">Labels for the Checking/Fixed savings page.</p>
      </header>
      <Input label="Heading" value={a.heading} onChange={(v) => set({ heading: v })} />
      <Input label="Sub-heading" value={a.sub} onChange={(v) => set({ sub: v })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Checking label" value={a.checkingLabel} onChange={(v) => set({ checkingLabel: v })} />
        <Input label="Fixed savings label" value={a.savingsLabel} onChange={(v) => set({ savingsLabel: v })} />
      </div>
      <Input
        label="Activity heading template"
        value={a.activityHeading}
        onChange={(v) => set({ activityHeading: v })}
        hint="Use {account} as a placeholder for the account label."
      />
      <Input
        label="Empty activity message"
        value={a.emptyMessage}
        onChange={(v) => set({ emptyMessage: v })}
      />
    </div>
  );
}

function CardsEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const c = draft.account.cards;
  const set = (patch: Partial<ContentState["account"]["cards"]>) =>
    onChange((x) => ({ ...x, account: { ...x.account, cards: { ...x.account.cards, ...patch } } }));
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Account · Cards</h2>
        <p className="mt-1 text-sm text-slate-500">Card page labels and the security note.</p>
      </header>
      <Input label="Heading" value={c.heading} onChange={(v) => set({ heading: v })} />
      <Input label="Sub-heading" value={c.sub} onChange={(v) => set({ sub: v })} textarea rows={2} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Frozen badge" value={c.frozenBadge} onChange={(v) => set({ frozenBadge: v })} />
        <Input label="Freeze button" value={c.freezeButton} onChange={(v) => set({ freezeButton: v })} />
        <Input label="Unfreeze button" value={c.unfreezeButton} onChange={(v) => set({ unfreezeButton: v })} />
      </div>
      <Input label="Expires label" value={c.expiresLabel} onChange={(v) => set({ expiresLabel: v })} />
      <Input label="Security note" value={c.securityNote} onChange={(v) => set({ securityNote: v })} textarea rows={3} />
    </div>
  );
}

function ProfileEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const p = draft.account.profile;
  const set = (patch: Partial<ContentState["account"]["profile"]>) =>
    onChange((x) => ({ ...x, account: { ...x.account, profile: { ...x.account.profile, ...patch } } }));
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Account · Profile</h2>
        <p className="mt-1 text-sm text-slate-500">Every label shown on the Profile page.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Net worth label" value={p.netWorthLabel} onChange={(v) => set({ netWorthLabel: v })} />
        <Input label="Cards label" value={p.cardsLabel} onChange={(v) => set({ cardsLabel: v })} />
        <Input label="Member since label" value={p.memberSinceLabel} onChange={(v) => set({ memberSinceLabel: v })} />
      </div>
      <Input label="Account group" value={p.accountGroup} onChange={(v) => set({ accountGroup: v })} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Username label" value={p.usernameLabel} onChange={(v) => set({ usernameLabel: v })} />
        <Input label="Email label" value={p.emailLabel} onChange={(v) => set({ emailLabel: v })} />
        <Input label="Member ID label" value={p.memberIdLabel} onChange={(v) => set({ memberIdLabel: v })} />
      </div>
      <Input label="Security group" value={p.securityGroup} onChange={(v) => set({ securityGroup: v })} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="2FA label" value={p.twoFactorLabel} onChange={(v) => set({ twoFactorLabel: v })} />
        <Input label="2FA enabled" value={p.twoFactorEnabled} onChange={(v) => set({ twoFactorEnabled: v })} />
        <Input label="Last sign-in label" value={p.lastSignInLabel} onChange={(v) => set({ lastSignInLabel: v })} />
      </div>
      <Input label="Change password label" value={p.changePasswordLabel} onChange={(v) => set({ changePasswordLabel: v })} />
      <Input label="Preferences group" value={p.preferencesGroup} onChange={(v) => set({ preferencesGroup: v })} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Notifications label" value={p.notificationsLabel} onChange={(v) => set({ notificationsLabel: v })} />
        <Input label="Language label" value={p.languageLabel} onChange={(v) => set({ languageLabel: v })} />
        <Input label="Currency label" value={p.currencyLabel} onChange={(v) => set({ currencyLabel: v })} />
      </div>
      <Input label="Sign out label" value={p.signOutLabel} onChange={(v) => set({ signOutLabel: v })} />
      <Input label="Sample note (footer disclaimer)" value={p.sampleNote} onChange={(v) => set({ sampleNote: v })} />
    </div>
  );
}

/* ---------------- Credentials ---------------- */

function CredentialsEditor() {
  const { version } = useAuth();
  const { rows, loading, error: loadError } = useAdminCustomers(version);

  const [drafts, setDrafts] = useState<
    Record<string, { username: string; password: string; memberId: string; email: string }>
  >({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<string, { username: string; password: string; memberId: string; email: string }> = {};
    rows.forEach((a) => {
      init[a.id] = {
        username: a.username ?? "",
        password: a.password ?? "",
        memberId: a.memberId ?? "",
        email: a.email ?? "",
      };
    });
    setDrafts(init);
  }, [rows]);

  const setField = (userId: string, key: keyof (typeof drafts)[string], value: string) => {
    setDrafts((d) => ({ ...d, [userId]: { ...d[userId], [key]: value } }));
  };

  const saveOne = async (userId: string) => {
    const d = drafts[userId];
    if (!d) return;
    setError(null);
    setNotice(null);
    if (!d.username.trim() || !d.password.trim()) {
      setError("Username and password are required.");
      return;
    }
    setBusy(userId);
    try {
      await adminSetCredentials(userId, {
        username: d.username.trim(),
        password: d.password,
        memberId: d.memberId.trim() || `MBR-${userId.toUpperCase()}-001`,
        email: d.email.trim(),
      });
      setNotice(
        `Saved for ${rows.find((a) => a.id === userId)?.fullName ?? userId}. New login: "${d.username.trim()}" with the password you set.`
      );
    } catch (e) {
      setError(e instanceof DatabaseError ? e.message : "Could not save credentials.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Account · Login credentials</h2>
        <p className="mt-1 text-sm text-slate-500">
          Edit username, password, member ID, and email. Changes save to Supabase and apply to every
          device immediately.
        </p>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
        <p className="font-semibold">Demo credentials</p>
        <p className="mt-1">
          Passwords are stored as plaintext in <code className="font-mono">customers.demo_password</code>{" "}
          for this demo. Replace with Supabase Auth before loading real customer data.
        </p>
      </div>

      {loading && <p className="text-xs text-slate-500">Loading customers…</p>}
      {(error || loadError) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error ?? loadError}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {notice}
        </div>
      )}

      <div className="space-y-4">
        {rows.map((a) => {
          const d = drafts[a.id] ?? { username: "", password: "", memberId: "", email: "" };
          return (
            <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{a.fullName}</p>
                  <p className="text-[11px] text-slate-500">
                    <code className="font-mono">{a.id}</code> · current login:{" "}
                    <code className="font-mono">{a.username}</code>
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <CredentialField
                  label="Username (used to log in)"
                  value={d.username}
                  onChange={(v) => setField(a.id, "username", v)}
                  placeholder="e.g. alex"
                />
                <CredentialField
                  label="Password (set a new one)"
                  value={d.password}
                  onChange={(v) => setField(a.id, "password", v)}
                  placeholder="Enter new password"
                  type="password"
                />
                <CredentialField
                  label="Member ID"
                  value={d.memberId}
                  onChange={(v) => setField(a.id, "memberId", v)}
                  placeholder="e.g. MBR-DEMO-1-001"
                />
                <CredentialField
                  label="Email address"
                  value={d.email}
                  onChange={(v) => setField(a.id, "email", v)}
                  placeholder="e.g. alex@riverbend.bank"
                  type="email"
                />
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => saveOne(a.id)}
                  disabled={busy === a.id}
                  className="inline-flex items-center justify-center rounded-xl bg-river-700 px-4 py-2 text-xs font-semibold text-white hover:bg-river-800 disabled:opacity-60"
                >
                  {busy === a.id ? "Saving…" : "Save credentials"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CredentialField({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password" | "email";
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/20"
      />
    </label>
  );
}

function SendEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const s = draft.account.send;
  const set = (patch: Partial<ContentState["account"]["send"]>) =>
    onChange((x) => ({ ...x, account: { ...x.account, send: { ...x.account.send, ...patch } } }));
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Account · Send money</h2>
        <p className="mt-1 text-sm text-slate-500">Form labels and the success popup message.</p>
      </header>
      <Input label="Heading" value={s.heading} onChange={(v) => set({ heading: v })} />
      <Input label="Sub-heading" value={s.sub} onChange={(v) => set({ sub: v })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="From label" value={s.fromLabel} onChange={(v) => set({ fromLabel: v })} />
        <Input label="To label" value={s.toLabel} onChange={(v) => set({ toLabel: v })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Recipient name label" value={s.recipientNameLabel} onChange={(v) => set({ recipientNameLabel: v })} />
        <Input label="Recipient account label" value={s.recipientAccountLabel} onChange={(v) => set({ recipientAccountLabel: v })} />
        <Input label="Recipient bank label" value={s.recipientBankLabel} onChange={(v) => set({ recipientBankLabel: v })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Amount label" value={s.amountLabel} onChange={(v) => set({ amountLabel: v })} />
        <Input label="Note label" value={s.noteLabel} onChange={(v) => set({ noteLabel: v })} />
      </div>
      <Input label="Submit button" value={s.submitLabel} onChange={(v) => set({ submitLabel: v })} />
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Fixed savings warning (shown when sending from Fixed savings)</p>
        <div className="mt-3">
          <Input
            label="Fixed savings warning"
            value={s.fixedSavingsWarning}
            onChange={(v) => set({ fixedSavingsWarning: v })}
            textarea
            rows={3}
          />
        </div>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Success popup</p>
        <div className="mt-3 space-y-3">
          <Input label="Headline" value={s.successHeadline} onChange={(v) => set({ successHeadline: v })} />
          <Input label="Body" value={s.successBody} onChange={(v) => set({ successBody: v })} textarea rows={2} />
        </div>
      </div>
    </div>
  );
}

function MoveEditor({ draft, onChange }: { draft: ContentState; onChange: (fn: (c: ContentState) => ContentState) => void }) {
  const m = draft.account.move;
  const set = (patch: Partial<ContentState["account"]["move"]>) =>
    onChange((x) => ({ ...x, account: { ...x.account, move: { ...x.account.move, ...patch } } }));
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Account · Move money</h2>
        <p className="mt-1 text-sm text-slate-500">Form labels, restriction warning, and the success popup.</p>
      </header>
      <Input label="Heading" value={m.heading} onChange={(v) => set({ heading: v })} />
      <Input label="Sub-heading" value={m.sub} onChange={(v) => set({ sub: v })} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="From label" value={m.fromLabel} onChange={(v) => set({ fromLabel: v })} />
        <Input label="To label" value={m.toLabel} onChange={(v) => set({ toLabel: v })} />
        <Input label="Amount label" value={m.amountLabel} onChange={(v) => set({ amountLabel: v })} />
      </div>
      <Input label="Submit button" value={m.submitLabel} onChange={(v) => set({ submitLabel: v })} />
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Cautionary note (fixed savings → checking)</p>
        <div className="mt-3">
          <Input
            label="Restriction warning"
            value={m.restrictionWarning}
            onChange={(v) => set({ restrictionWarning: v })}
            textarea
            rows={3}
          />
        </div>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Success popup</p>
        <div className="mt-3 space-y-3">
          <Input label="Headline" value={m.successHeadline} onChange={(v) => set({ successHeadline: v })} />
          <Input label="Body" value={m.successBody} onChange={(v) => set({ successBody: v })} textarea rows={2} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Users ---------------- */

function UsersEditor() {
  const { version } = useAuth();
  const { rows, loading, error } = useAdminCustomers(version);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Users</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sample accounts available for the demo login. Read-only view — live from Supabase.
        </p>
      </header>

      {loading && <p className="text-xs text-slate-500">Loading customers…</p>}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2 text-right">Checking</th>
              <th className="px-4 py-2 text-right">Fixed savings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{u.fullName}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{u.username}</td>
                <td className="px-4 py-3 text-slate-700">{u.email}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatMoney(u.balance.checking)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatMoney(u.balance.savings)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Balances ---------------- */

function BalancesEditor() {
  const { refreshUser, version } = useAuth();
  const { rows, loading, error: loadError } = useAdminCustomers(version);
  const [drafts, setDrafts] = useState<Record<string, { checking: string; savings: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Re-seed drafts whenever the database rows change.
  useEffect(() => {
    const init: Record<string, { checking: string; savings: string }> = {};
    rows.forEach((u) => {
      init[u.id] = {
        checking: u.balance.checking.toFixed(2),
        savings: u.balance.savings.toFixed(2),
      };
    });
    setDrafts(init);
  }, [rows]);

  const setField = (id: string, key: "checking" | "savings", v: string) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: v } }));
  };

  const save = async (id: string) => {
    const d = drafts[id];
    const checking = parseFloat(d.checking);
    const savings = parseFloat(d.savings);
    setError(null);
    setNotice(null);
    if (!Number.isFinite(checking) || checking < 0) {
      setError("Checking balance must be a non-negative number.");
      return;
    }
    if (!Number.isFinite(savings) || savings < 0) {
      setError("Fixed savings balance must be a non-negative number.");
      return;
    }
    setBusy(id);
    try {
      await adminSetBalance(id, "checking", checking);
      await adminSetBalance(id, "savings", savings);
      // Reload the customer table and any active session from the database.
      await refreshUser();
      setNotice(`Balances saved for ${rows.find((u) => u.id === id)?.fullName ?? id}.`);
    } catch (e) {
      setError(e instanceof DatabaseError ? e.message : "Could not save balances.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Balances</h2>
        <p className="mt-1 text-sm text-slate-500">
          Edit Checking and Fixed savings balances for each customer. Saves to Supabase and applies
          to every device.
        </p>
      </header>

      {loading && <p className="text-xs text-slate-500">Loading customers…</p>}
      {(error || loadError) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error ?? loadError}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {notice}
        </div>
      )}

      <div className="space-y-4">
        {rows.map((u) => {
          const d = drafts[u.id] ?? { checking: "0.00", savings: "0.00" };
          return (
            <div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{u.fullName}</p>
                  <p className="text-[11px] text-slate-500">
                    <code className="font-mono">{u.username}</code> · {u.email}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <BalanceField label="Checking" value={d.checking} onChange={(v) => setField(u.id, "checking", v)} />
                <BalanceField label="Fixed savings" value={d.savings} onChange={(v) => setField(u.id, "savings", v)} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">
                  Live total:{" "}
                  <span className="font-semibold text-slate-700">
                    {formatMoney((parseFloat(d.checking) || 0) + (parseFloat(d.savings) || 0))}
                  </span>
                </p>
                <button
                  onClick={() => save(u.id)}
                  disabled={busy === u.id}
                  className="inline-flex items-center justify-center rounded-xl bg-river-700 px-4 py-2 text-xs font-semibold text-white hover:bg-river-800 disabled:opacity-60"
                >
                  {busy === u.id ? "Saving…" : "Save balances"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BalanceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-river-400 focus-within:ring-2 focus-within:ring-river-500/20">
        <span className="text-base font-semibold text-slate-500">$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-2 py-2.5 text-sm text-slate-900 outline-none"
        />
      </div>
    </label>
  );
}

/* ---------------- Cardholders ---------------- */

function CardholdersEditor() {
  const { refreshUser, version } = useAuth();
  const { rows, loading, error: loadError } = useAdminCustomers(version);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<string, string> = {};
    rows.forEach((u) => u.cards.forEach((c) => (init[c.id] = c.cardholderName ?? u.fullName)));
    setDrafts(init);
  }, [rows]);

  const setName = (cardId: string, v: string) => {
    setDrafts((d) => ({ ...d, [cardId]: v }));
  };

  const save = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      for (const u of rows) {
        for (const c of u.cards) {
          const name = drafts[c.id] ?? u.fullName;
          await adminSetCardholderName(u.id, c.id, name);
        }
      }
      await refreshUser();
      setNotice("Cardholder names saved to the database.");
    } catch (e) {
      setError(e instanceof DatabaseError ? e.message : "Could not save cardholder names.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Cardholders</h2>
        <p className="mt-1 text-sm text-slate-500">
          Set the name engraved on each card. Changes are stored in Supabase and shown on the
          customer's card.
        </p>
      </header>

      {loading && <p className="text-xs text-slate-500">Loading cards…</p>}
      {(error || loadError) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {error ?? loadError}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {notice}
        </div>
      )}

      <div className="space-y-5">
        {rows.map((u) => (
          <div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{u.fullName}</p>
                <p className="text-[11px] text-slate-500">
                  <code className="font-mono">{u.username}</code> · {u.email}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {u.cards.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{c.label}</p>
                    <p className="text-[11px] text-slate-500">
                      {c.network} · •••• {c.last4} · expires {c.expiry}
                    </p>
                  </div>
                  <input
                    value={drafts[c.id] ?? ""}
                    onChange={(e) => setName(c.id, e.target.value)}
                    placeholder="Cardholder name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-river-400 focus:ring-2 focus:ring-river-500/20 sm:w-72"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-xl bg-river-700 px-5 py-3 text-sm font-semibold text-white hover:bg-river-800 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save cardholder names"}
      </button>
    </div>
  );
}

/* ---------------- Data ---------------- */

function DataTab() {
  const { content, setContent, resetContent, loading } = useContent();
  const { refreshUser } = useAuth();
  const exported = JSON.stringify(content, null, 2);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const importJson = async () => {
    setError(null);
    setNotice(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(pasted);
    } catch (e) {
      setError("Invalid JSON: " + (e as Error).message);
      return;
    }
    if (typeof parsed !== "object" || !parsed || !("hero" in parsed) || !("contact" in parsed)) {
      setError("That doesn't look like RIVERBEND content JSON. Paste a full export from this tab.");
      return;
    }
    setBusy(true);
    try {
      await setContent(parsed as typeof content);
      setPasted("");
      setNotice("Content imported and saved to the database.");
    } catch (e) {
      setError(e instanceof DatabaseError ? e.message : "Could not import content.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Data</h2>
        <p className="mt-1 text-sm text-slate-500">
          View, copy, or restore the website content. Everything here lives in Supabase.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>
      )}

      {/* Storage status */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Landing content</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {loading ? "Loading…" : `${(new Blob([exported]).size / 1024).toFixed(1)} KB in Supabase`}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">site_content · slug = default</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Account data (users, balances, cards, cardholders)
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">In Supabase</p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">customers · bank_accounts · cards</p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Current content JSON</h3>
        <pre className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
          {exported}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(exported);
              alert("Copied to clipboard.");
            }}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Copy JSON
          </button>
          <a
            href={`data:application/json;charset=utf-8,${encodeURIComponent(exported)}`}
            download="riverbend-content.json"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Download .json
          </a>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Restore from a previous export</h3>
        <p className="mb-2 text-xs text-slate-500">
          Paste a previously exported JSON below and click Import. Useful if you cleared your browser data and need to restore.
        </p>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          placeholder='{ "hero": { "headline": "..." }, ... }'
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-river-400 focus:ring-2 focus:ring-river-500/20"
        />
        <button
          onClick={importJson}
          disabled={!pasted.trim() || busy}
          className="mt-2 inline-flex items-center justify-center rounded-xl bg-river-700 px-4 py-2 text-sm font-semibold text-white hover:bg-river-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import JSON"}
        </button>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
        <p className="font-semibold">Reset website content to defaults</p>
        <p className="mt-1">
          Writes the original demo copy back to Supabase. This is a write, not a delete — no rows are
          removed and account data is untouched.
        </p>
        <button
          onClick={async () => {
            if (!confirm("Reset all website content to the original defaults?")) return;
            setError(null);
            setNotice(null);
            setBusy(true);
            try {
              await resetContent();
              clearAdminCache();
              await refreshUser();
              setNotice("Website content restored to defaults.");
            } catch (e) {
              setError(e instanceof DatabaseError ? e.message : "Could not reset content.");
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="mt-3 inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {busy ? "Resetting…" : "Reset content"}
        </button>
      </div>
    </div>
  );
}

