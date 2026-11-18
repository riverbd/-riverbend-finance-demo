import { useMemo, useState } from "react";
import { useContent } from "../admin/store";
import type { Transaction } from "./types";
import { TransactionRow, newestFirst } from "./TransactionRow";
import { accountTitle } from "./accountIds";

/** How many rows the account activity view shows before "See All". */
export const ACTIVITY_PAGE_SIZE = 10;

/**
 * Every transaction on the account, newest first.
 *
 * Reached from the "See All" link on the account activity list. Shows both
 * accounts together, because the history is one ledger and a customer looking
 * for "all of it" does not want it split across two tabs. Each row therefore
 * names its account.
 *
 * Deliberately a separate component from the activity list rather than a mode
 * inside it: the activity list is a per-month view with navigation, and this is
 * the whole ledger. Keeping them apart means neither gains a branch that only
 * one of them uses.
 *
 * This view is read-only. It renders what the session already loaded and issues
 * no query, so it cannot change a transaction, a balance or a date.
 */
export default function AllActivity({
  transactions,
  onBack,
}: {
  transactions: Transaction[];
  onBack: () => void;
}) {
  const { content } = useContent();
  const copy = content.account.accounts;

  // One control, newest first. 20 rows is small enough to present in full, and
  // a customer who asked to see everything should not then be paginated again.
  const [account, setAccount] = useState<"all" | "checking" | "savings">("all");

  const rows = useMemo(() => {
    const filtered =
      account === "all"
        ? transactions
        : transactions.filter((t) => t.account === account);
    return [...filtered].sort(newestFirst);
  }, [transactions, account]);

  const counts = useMemo(
    () => ({
      all: transactions.length,
      checking: transactions.filter((t) => t.account === "checking").length,
      savings: transactions.filter((t) => t.account === "savings").length,
    }),
    [transactions]
  );

  const tabs: { id: typeof account; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "checking", label: accountTitle("checking", copy.checkingLabel), count: counts.checking },
    { id: "savings", label: accountTitle("savings", copy.savingsLabel), count: counts.savings },
  ];

  return (
    <div className="space-y-4">
      <header>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs font-medium text-river-700 hover:underline"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {copy.seeAllBack}
        </button>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
          {copy.allActivityHeading}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {copy.allActivitySub.replace("{count}", String(counts.all))}
        </p>
      </header>

      <div
        role="group"
        aria-label={copy.allActivityFilterLabel}
        className="grid grid-cols-3 gap-2"
      >
        {tabs.map((t) => {
          const active = account === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setAccount(t.id)}
              aria-pressed={active}
              data-testid={`all-activity-filter-${t.id}`}
              className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                active
                  ? "border-river-300 bg-river-50/60 text-river-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="block truncate">{t.label}</span>
              <span className="mt-0.5 block text-[10px] font-medium text-slate-400">
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            {copy.emptyMessage}
          </p>
        ) : (
          rows.map((t, i) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              showAccount={account === "all"}
              demoBadge={copy.demoBadge}
              demoNote={copy.demoNote}
              divided={i !== rows.length - 1}
            />
          ))
        )}
      </div>

      {rows.some((t) => t.isDemo) && (
        <p className="px-1 text-[11px] leading-relaxed text-slate-400">{copy.demoNote}</p>
      )}
    </div>
  );
}
