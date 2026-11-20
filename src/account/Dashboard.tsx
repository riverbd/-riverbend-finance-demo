import { useAuth, formatMoney } from "./auth";
import { useContent } from "../admin/store";
import { ACCOUNT_IDENTIFIER } from "./accountIds";
import RecentActivityRow from "./RecentActivityRow";
import {
  IconArrowUpRight,
  IconArrowDownLeft,
  IconSend,
  IconSnow,
  IconChart,
} from "./icons";

type GoTarget = "accounts" | "cards" | "profile" | "send" | "move";

export default function Dashboard({
  onGoTo,
  onSeeAllActivity,
}: {
  onGoTo: (p: GoTarget) => void;
  /** Jump straight to the full ledger, skipping the account cards. */
  onSeeAllActivity: () => void;
}) {
  const { user } = useAuth();
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const dash = content.account.dashboard;

  if (!user) return null;

  const total = user.balance.checking + user.balance.savings;
  const recent = user.transactions.slice(0, 4);

  return (
    <div className="space-y-5">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">{dash.welcomeEyebrow}</p>
          <p className="text-lg font-semibold text-slate-900">{user.fullName.split(" ")[0]}</p>
        </div>
        <button
          onClick={() => onGoTo("profile")}
          aria-label="Open profile"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-river-600 to-river-800 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105"
        >
          {user.initials}
        </button>
      </div>

      {/* Balance card */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-river-700 to-river-900 p-5 text-white shadow-xl shadow-river-900/30">
        <p className="text-xs uppercase tracking-wider text-river-200">Total balance</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{formatMoney(total)}</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-river-100">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
            <IconChart className="h-3 w-3" />
            +4.2% this month
          </span>
          <span className="text-river-200">Across 2 accounts</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => onGoTo("send")}
            className="rounded-2xl bg-white/10 px-3 py-2.5 text-left text-xs font-medium text-white transition-colors hover:bg-white/15"
          >
            <IconArrowUpRight className="mb-1 h-4 w-4" />
            <p className="font-semibold">Send</p>
            <p className="text-[10px] text-river-100">To anyone, anywhere</p>
          </button>
          <button
            onClick={() => onGoTo("move")}
            className="rounded-2xl bg-white/10 px-3 py-2.5 text-left text-xs font-medium text-white transition-colors hover:bg-white/15"
          >
            <IconArrowDownLeft className="mb-1 h-4 w-4" />
            <p className="font-semibold">Move</p>
            <p className="text-[10px] text-river-100">Between accounts</p>
          </button>
        </div>
      </div>

      {/* Account summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onGoTo("accounts")}
          className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs text-slate-500">{content.account.accounts.checkingLabel}</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {formatMoney(user.balance.checking)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">{ACCOUNT_IDENTIFIER.checking}</p>
        </button>
        <button
          onClick={() => onGoTo("accounts")}
          className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs text-slate-500">{content.account.accounts.savingsLabel}</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {formatMoney(user.balance.savings)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">{ACCOUNT_IDENTIFIER.savings}</p>
        </button>
      </div>

      {/* Quick actions row */}
      <div className="grid grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        {dash.quickActions.map((a, i) => {
          const Icon = [IconSend, IconSnow, IconCardsIcon, ProfileIcon][i] ?? IconSend;
          const target: GoTarget =
            a.target === "send" || a.target === "move"
              ? a.target
              : a.target === "cards"
              ? "cards"
              : a.target === "profile"
              ? "profile"
              : "accounts";
          return (
            <button
              key={a.label}
              onClick={() => onGoTo(target)}
              className="flex flex-col items-center gap-1.5 py-1"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-river-50 text-river-700 transition-colors hover:bg-river-100">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-medium text-slate-600">{a.label}</span>
            </button>
          );
        })}
      </div>

      {/* Recent activity */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">{dash.recentHeading}</h3>
          <button
            onClick={onSeeAllActivity}
            data-testid="home-see-all"
            className="text-xs font-medium text-river-700 hover:text-river-800"
          >
            {dash.recentSeeAll}
          </button>
        </div>
        <div
          className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white"
          data-testid="home-recent-list"
        >
          {recent.map((t, i) => (
            <RecentActivityRow
              key={t.id}
              transaction={t}
              divided={i !== recent.length - 1}
            />
          ))}
        </div>
      </section>
    </div>
  );
}


function IconCardsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h2" />
    </svg>
  );
}
function ProfileIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}