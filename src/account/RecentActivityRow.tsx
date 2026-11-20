/**
 * The compact transaction row used by the homepage Recent activity list and the
 * Accounts page Recent activity preview.
 *
 * Extracted so the two cannot drift apart. Before this existed, the homepage
 * and the accounts preview would have been two copies of the same markup, and
 * "use the same display conventions" would have held only until the next edit
 * to one of them.
 *
 * Deliberately different from `TransactionRow`: this is the small, four-or-five
 * line preview with a category avatar, not the full detail row used on the
 * activity and all-activity lists.
 */

import { formatDateWithYear, formatMoney } from "./format";
import { categoryTone } from "./TransactionRow";
import type { Transaction } from "./types";

export default function RecentActivityRow({
  transaction,
  divided,
}: {
  transaction: Transaction;
  /** Draw the hairline above this row. The last row in a list omits it. */
  divided: boolean;
}) {
  const t = transaction;
  return (
    <div
      data-testid="recent-row"
      className={`flex items-start justify-between gap-3 px-4 py-3 ${
        divided ? "border-b border-slate-100" : ""
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${categoryTone(t.category)}`}
        >
          {t.merchant[0]}
        </div>
        <div className="min-w-0">
          {/* A transfer can carry up to six recipient details, so the
              description can be long. These utilities keep it inside the row
              instead of pushing the amount off the edge on a phone. */}
          <p className="whitespace-pre-line break-words text-sm font-medium text-slate-900">
            {t.merchant}
          </p>
          <p className="text-[11px] text-slate-500">
            {t.category} · {formatDateWithYear(t.date)}
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
