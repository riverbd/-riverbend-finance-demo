import { useState } from "react";
import { useAuth, formatMoney } from "./auth";
import { useContent } from "../admin/store";
import CheckingActivity from "./CheckingActivity";
import AllActivity from "./AllActivity";
import Statements from "./Statements";

export default function Accounts() {
  const { user } = useAuth();
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const a = content.account.accounts;
  const [tab, setTab] = useState<"checking" | "savings">("checking");
  // The full ledger is a dedicated view, not a mode of the account cards, so
  // "See All" swaps the whole page body rather than expanding the list.
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showStatements, setShowStatements] = useState(false);
  if (!user) return null;

  if (showStatements) {
    return <Statements onBack={() => setShowStatements(false)} />;
  }

  if (showAllActivity) {
    return (
      <AllActivity
        transactions={user.transactions}
        onBack={() => setShowAllActivity(false)}
      />
    );
  }

  const isSavings = tab === "savings";
  const activityLabel = a.activityHeading.replace(
    "{account}",
    tab === "checking" ? a.checkingLabel : a.savingsLabel
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{a.heading}</h2>
          <p className="text-sm text-slate-500">{a.sub}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowStatements(true)}
          data-testid="open-statements"
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-river-700 hover:bg-river-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" />
          </svg>
          Statements
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setTab("checking")}
          className={`rounded-2xl border p-4 text-left transition-all ${
            tab === "checking"
              ? "border-river-300 bg-river-50/60 shadow-sm"
              : "border-slate-200 bg-white"
          }`}
        >
          <p className="text-xs text-slate-500">{a.checkingLabel}</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {formatMoney(user.balance.checking)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">•••• 4218</p>
        </button>
        <button
          onClick={() => setTab("savings")}
          className={`rounded-2xl border p-4 text-left transition-all ${
            tab === "savings"
              ? "border-river-300 bg-river-50/60 shadow-sm"
              : "border-slate-200 bg-white"
          }`}
        >
          <p className="text-xs text-slate-500">{a.savingsLabel}</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {formatMoney(user.balance.savings)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">•••• 1147</p>
        </button>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-slate-900">{activityLabel}</h3>
        {isSavings ? (
          <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-900">
              {a.savingsLabel} activity is locked
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Fixed savings statements are available on request. Contact our customer relations team.
            </p>
          </div>
        ) : (
          <CheckingActivity
            transactions={user.transactions}
            memberSince={user.memberSince}
            copy={a}
            onSeeAll={() => setShowAllActivity(true)}
          />
        )}
      </section>
    </div>
  );
}
