import { useState } from "react";
import { useAuth, formatMoney, formatDate } from "./auth";
import { useContent } from "../admin/store";

export default function Accounts() {
  const { user } = useAuth();
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const a = content.account.accounts;
  const [tab, setTab] = useState<"checking" | "savings">("checking");
  if (!user) return null;

  const isSavings = tab === "savings";
  const txs = isSavings ? [] : user.transactions.filter((t) => t.account === tab);
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
          <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {txs.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">{a.emptyMessage}</p>
            ) : (
              txs.map((t, i) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    i !== txs.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold ${cat(t.category)}`}
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
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function cat(c: string) {
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