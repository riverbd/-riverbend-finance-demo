import { useState } from "react";
import { useAuth, formatMoney } from "./auth";
import { useContent } from "../admin/store";
import CheckingActivity from "./CheckingActivity";

export default function Accounts() {
  const { user } = useAuth();
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const a = content.account.accounts;
  const [tab, setTab] = useState<"checking" | "savings">("checking");
  if (!user) return null;

  const isSavings = tab === "savings";
  const activityLabel = a.activityHeading.replace(
    "{account}",
    tab === "checking" ? a.checkingLabel : a.savingsLabel
  );

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">{a.heading}</h2>
        <p className="text-sm text-slate-500">{a.sub}</p>
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
          />
        )}
      </section>
    </div>
  );
}
