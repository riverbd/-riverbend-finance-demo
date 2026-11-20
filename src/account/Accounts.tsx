import { useState } from "react";
import { useAuth, formatMoney } from "./auth";
import { useContent } from "../admin/store";
import CheckingActivity from "./CheckingActivity";
import AllActivity from "./AllActivity";
import Statements from "./Statements";
import SavingsPromo from "./SavingsPromo";
import RecentActivityRow from "./RecentActivityRow";
import { ACCOUNT_IDENTIFIER } from "./accountIds";

export default function Accounts({ initialView = "list" }: { initialView?: "list" | "all-activity" }) {
  const { user } = useAuth();
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const a = content.account.accounts;
  const [tab, setTab] = useState<"checking" | "savings">("checking");
  // The full ledger is a dedicated view, not a mode of the account cards, so
  // "See All" swaps the whole page body rather than expanding the list.
  const [showAllActivity, setShowAllActivity] = useState(initialView === "all-activity");
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

  /**
   * The five most recent transactions for the selected account, across the
   * whole history — deliberately independent of the month/period the activity
   * section is filtered to. A customer on June 2022 should still see that they
   * have a history, even when that month holds a single row.
   */
  const accountTransactions = user.transactions.filter((t) => t.account === tab);
  const newest = [...accountTransactions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 5);
  const activeLabel = isSavings ? a.savingsLabel : a.checkingLabel;
  const activityLabel = a.activityHeading.replace(
    "{account}",
    `${activeLabel} ${a.accountIdSeparator} ${ACCOUNT_IDENTIFIER[tab]}`
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
          <p className="mt-0.5 text-[10px] text-slate-400">{ACCOUNT_IDENTIFIER.checking}</p>
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
          <p className="mt-0.5 text-[10px] text-slate-400">{ACCOUNT_IDENTIFIER.savings}</p>
        </button>
      </div>

      {/* Promotional panel, Fixed savings only, and above the history so the
          ledger is never mistaken for part of the offer. */}
      {isSavings && (
        <SavingsPromo
          eyebrow={a.promoEyebrow}
          rate={a.promoRate}
          body={a.promoBody}
          note={a.promoNote}
          contact={a.promoContact}
        />
      )}

      {/* Recent activity preview: five newest, newest first, regardless of the
          month selected below. The filtered section that follows is untouched. */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">{a.recentHeading}</h3>
          <button
            type="button"
            onClick={() => setShowAllActivity(true)}
            data-testid="accounts-recent-see-all"
            className="text-xs font-medium text-river-700 hover:text-river-800"
          >
            {a.seeAll}
          </button>
        </div>
        <div
          className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white"
          data-testid="accounts-recent-list"
        >
          {newest.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">{a.recentEmpty}</p>
          ) : (
            newest.map((t, i) => (
              <RecentActivityRow
                key={t.id}
                transaction={t}
                divided={i !== newest.length - 1}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900">{activityLabel}</h3>
        {/*
          Both accounts now page through their own ledger with the same month
          navigation. The Fixed savings panel used to stop here with a lock
          notice in place of any history; the lock itself lives in the Move flow
          and in the database, not in whether this list is shown.
        */}
        <CheckingActivity
          transactions={user.transactions}
          memberSince={user.memberSince}
          copy={a}
          onSeeAll={() => setShowAllActivity(true)}
          account={tab}
        />
      </section>
    </div>
  );
}
