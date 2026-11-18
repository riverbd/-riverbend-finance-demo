import { useAuth, formatMoney, formatDate } from "./auth";
import { useContent } from "../admin/store";
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
          <p className="mt-0.5 text-[10px] text-slate-400">•••• 4218</p>
        </button>
        <button
          onClick={() => onGoTo("accounts")}
          className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs text-slate-500">{content.account.accounts.savingsLabel}</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {formatMoney(user.balance.savings)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">•••• 1147</p>
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
        <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {recent.map((t, i) => (
            <div
              key={t.id}
              className={`flex items-center justify-between px-4 py-3 ${
                i !== recent.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold ${categoryColor(t.category)}`}
                >
                  {t.merchant[0]}
                </div>
                <div className="min-w-0">
                  {/* A transfer now carries up to six recipient details, so the
                      description can be long. The wrapping utilities keep it inside the
                      row instead of pushing the amount off the edge on a phone. */}
                  <p className="whitespace-pre-line break-words text-sm font-medium text-slate-900">
                    {t.merchant}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {t.category} · {formatDate(t.date)}
                  </p>
                </div>
              </div>
              <p
                className={`text-sm font-semibold ${
                  t.amount >= 0 ? "text-emerald-600" : "text-slate-900"
                }`}
              >
                {t.amount >= 0 ? "+" : ""}
                {formatMoney(t.amount)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function categoryColor(c: string) {
  const map: Record<string, string> = {
    Income: "bg-emerald-100 text-emerald-700",
    Food: "bg-amber-100 text-amber-700",
    Groceries: "bg-violet-100 text-violet-700",
    Transfer: "bg-river-100 text-river-700",
    Subscriptions: "bg-rose-100 text-rose-700",
    Travel: "bg-sky-100 text-sky-700",
    Health: "bg-pink-100 text-pink-700",
    Software: "bg-indigo-100 text-indigo-700",
  };
  return map[c] ?? "bg-slate-100 text-slate-700";
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