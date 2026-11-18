import { formatDateWithYear, formatMoney } from "./format";
import type { AccountKind, Transaction } from "./types";

/**
 * One transaction row.
 *
 * Extracted so the account activity list and the "all activity" view render
 * byte-identical rows — same description, category, date, amount, badge and
 * colours. A presentation change to one is therefore a change to both, and the
 * two views can never drift apart.
 *
 * The class names here are load-bearing: `p.break-words` lets a long merchant
 * name wrap instead of overflowing on a phone, and the amount is `p.shrink-0`
 * inside a `justify-between` row so it can never be squeezed to nothing.
 */
export function TransactionRow({
  transaction: t,
  showAccount,
  demoBadge,
  demoNote,
  divided,
}: {
  transaction: Transaction;
  /** Show which account the row belongs to (the combined all-activity view). */
  showAccount?: boolean;
  demoBadge: string;
  demoNote: string;
  /** Draw a separator below the row. */
  divided: boolean;
}) {
  return (
    <div
      // A row, not a nested block: the description column takes the space that
      // is left and can shrink, the amount holds its width. py-3.5 gives each
      // row a comfortable tap/read height without turning the list into a wall.
      className={`flex items-center justify-between gap-3 px-4 py-3.5 ${
        divided ? "border-b border-slate-100" : ""
      }`}
      data-testid="activity-row"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${categoryTone(t.category)}`}
          aria-hidden="true"
        >
          {t.merchant[0]}
        </div>
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-slate-900">{t.merchant}</p>
          <p className="flex flex-wrap items-center gap-x-1 text-[11px] text-slate-500">
            <span>{t.category}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDateWithYear(t.date)}</span>
            {showAccount && (
              <>
                <span aria-hidden="true">·</span>
                <span>{accountLabel(t.account)}</span>
              </>
            )}
            {t.isDemo && (
              <span
                className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                title={demoNote}
              >
                {demoBadge}
              </span>
            )}
          </p>
        </div>
      </div>
      <p
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          t.amount >= 0 ? "text-emerald-600" : "text-slate-900"
        }`}
      >
        {t.amount >= 0 ? "+" : ""}
        {formatMoney(t.amount)}
      </p>
    </div>
  );
}

/** The human name of an account, matching the labels used on the account cards. */
export function accountLabel(kind: AccountKind): string {
  return kind === "savings" ? "Fixed savings" : "Checking";
}

/** Category chip colours, kept identical to the existing activity list. */
export function categoryTone(c: string) {
  const map: Record<string, string> = {
    Income: "bg-emerald-100 text-emerald-700",
    Food: "bg-amber-100 text-amber-700",
    Groceries: "bg-violet-100 text-violet-700",
    Transfer: "bg-river-100 text-river-700",
    Subscriptions: "bg-rose-100 text-rose-700",
    Travel: "bg-sky-100 text-sky-700",
    Health: "bg-pink-100 text-pink-700",
    Software: "bg-indigo-100 text-indigo-700",
    Housing: "bg-slate-200 text-slate-700",
    Utilities: "bg-cyan-100 text-cyan-700",
    Insurance: "bg-teal-100 text-teal-700",
    Transport: "bg-blue-100 text-blue-700",
    Shopping: "bg-fuchsia-100 text-fuchsia-700",
    Entertainment: "bg-orange-100 text-orange-700",
    Charity: "bg-lime-100 text-lime-700",
  };
  return map[c] ?? "bg-slate-100 text-slate-700";
}

/**
 * Newest first. The id breaks ties so rows sharing a date keep a stable order
 * between renders instead of shuffling.
 */
export function newestFirst(a: Transaction, b: Transaction) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
