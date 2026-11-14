import { useAuth, formatMoney } from "./auth";
import { useContent } from "../admin/store";
import { IconArrowRight } from "./icons";

export default function Profile() {
  const { user, signOut } = useAuth();
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const p = content.account.profile;

  if (!user) return null;

  const memberSince = new Date(user.memberSince).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const total = user.balance.checking + user.balance.savings;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-river-700 to-river-900 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-base font-semibold backdrop-blur">
            {user.initials}
          </div>
          <div>
            <p className="text-base font-semibold">{user.fullName}</p>
            <p className="text-xs text-river-100">{user.email}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/10 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wider text-river-100">{p.netWorthLabel}</p>
            <p className="mt-1 text-sm font-semibold">{formatMoney(total)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wider text-river-100">{p.cardsLabel}</p>
            <p className="mt-1 text-sm font-semibold">{user.cards.length}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wider text-river-100">{p.memberSinceLabel}</p>
            <p className="mt-1 text-xs font-semibold">{memberSince}</p>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Group label={p.accountGroup}>
          <Row label={p.usernameLabel} value={user.username} />
          <Row label={p.emailLabel} value={user.email} />
          <Row label={p.memberIdLabel} value={user.memberId} />
        </Group>
        <Group label={p.securityGroup}>
          <Row label={p.twoFactorLabel} value={p.twoFactorEnabled} badge="ok" />
          <Row label={p.lastSignInLabel} value="Today, 9:41 AM" />
          <Row label={p.changePasswordLabel} value="" arrow />
        </Group>
        <Group label={p.preferencesGroup}>
          <Row label={p.notificationsLabel} value="On" arrow />
          <Row label={p.languageLabel} value="English" arrow />
          <Row label={p.currencyLabel} value="USD" arrow />
        </Group>
      </section>

      <button
        onClick={signOut}
        className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
      >
        {p.signOutLabel}
      </button>

      <p className="text-center text-[11px] text-slate-400">{p.sampleNote}</p>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  badge,
  arrow,
}: {
  label: string;
  value: string;
  badge?: "ok";
  arrow?: boolean;
}) {
  return (
    <button className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50">
      <span className="text-sm text-slate-700">{label}</span>
      <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
        {badge === "ok" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            ✓ {value}
          </span>
        )}
        {!badge && value && <span>{value}</span>}
        {arrow && <IconArrowRight className="h-4 w-4 text-slate-400" />}
      </span>
    </button>
  );
}