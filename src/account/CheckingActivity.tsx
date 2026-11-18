import { useEffect, useMemo, useState } from "react";
import { formatDate } from "./auth";
import type { Transaction } from "./types";
import { ACTIVITY_PAGE_SIZE } from "./AllActivity";
import { TransactionRow } from "./TransactionRow";
import {
  addMonths,
  canGoNext,
  canGoPrev,
  clampMonth,
  effectiveWindow,
  inWindow,
  isFutureMonth,
  latestNavigableMonth,
  monthLabel,
  monthLabelShort,
  monthOf,
  todayISO,
  type DateRange,
  type MonthKey,
} from "./activity";

/**
 * Checking activity with period navigation (Milestone 5).
 *
 * The transaction rows themselves are deliberately unchanged — same markup,
 * same category chips, same colours — so the page keeps its existing visual
 * identity. Everything new is wrapped around them: a month strip, a month/year
 * picker, an optional date range, and the demonstration-data label.
 *
 * Navigation can never leave the window [account opening month, current month]:
 * "previous" stops at the month the account was opened and "next" stops at the
 * current month, so no future transaction is ever reachable.
 */

export type ActivityCopy = {
  emptyMessage: string;
  demoBadge: string;
  demoNote: string;
  periodEmpty: string;
  periodFuture: string;
  periodSelectLabel: string;
  rangeStartLabel: string;
  rangeEndLabel: string;
  rangeClear: string;
  prevMonth: string;
  nextMonth: string;
  earliestLabel: string;
  seeAll: string;
  seeAllHint: string;
  showingCount: string;
};

export default function CheckingActivity({
  transactions,
  memberSince,
  copy,
  onSeeAll,
}: {
  transactions: Transaction[];
  /** ISO date the account was opened — the earliest month we may page to. */
  memberSince: string;
  copy: ActivityCopy;
  /** Opens the combined all-activity view. */
  onSeeAll: () => void;
}) {
  const today = todayISO();
  const earliest = monthOf(memberSince);

  // Newest transaction decides where the page opens, so a demo account with a
  // gap shows its latest real activity rather than an empty recent month.
  const newest = useMemo(
    () =>
      transactions.reduce<string>((acc, t) => (t.date > acc ? t.date : acc), ""),
    [transactions]
  );

  // Never past the current month, and never past the newest transaction: a
  // closed history should not offer months of empty pages after it.
  const latest = latestNavigableMonth(today, newest || undefined);

  // The month the customer is looking at, or null while they have not chosen
  // one. Deriving the default instead of seeding state matters: this component
  // renders before the account data has arrived, so a seeded value would freeze
  // the page on whatever month was current at that instant — an empty one —
  // and never move to the months that actually hold activity.
  const [picked, setPicked] = useState<MonthKey | null>(null);
  const [range, setRange] = useState<DateRange>(null);

  // Open on the newest month that actually has activity, falling back to the
  // current month for an account with no history at all.
  const defaultMonth = newest ? monthOf(newest) : latest;
  const month = clampMonth(picked ?? defaultMonth, earliest, latest);
  const setMonth = setPicked;

  // Keep a chosen month inside the legal window if the window itself moves.
  useEffect(() => {
    if (picked && picked !== clampMonth(picked, earliest, latest)) {
      setPicked(clampMonth(picked, earliest, latest));
    }
  }, [picked, earliest, latest]);

  const window = effectiveWindow(month, range, today, earliest);
  const rows = useMemo(
    () =>
      transactions
        .filter((t) => t.account === "checking" && inWindow(t.date, window))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [transactions, window]
  );

  // Show at most a page of rows here; "See All" opens the full, unpaginated
  // ledger. The cap applies to whatever period is on screen, so a busy month
  // never turns into an endless scroll inside the account card.
  const visible = rows.slice(0, ACTIVITY_PAGE_SIZE);
  const hasMore = rows.length > visible.length;

  const isFiltered = !!(range && (range.start || range.end));
  const nextBlocked = !canGoNext(month, latest);

  const step = (delta: number) => {
    setRange(null);
    setMonth(clampMonth(addMonths(month, delta), earliest, latest));
  };

  return (
    <div className="mt-2 space-y-3">
      {/* ---- period header ------------------------------------------------ */}
      <div
        className="rounded-2xl border border-slate-200 bg-white p-3"
        data-testid="activity-nav"
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={!canGoPrev(month, earliest)}
            aria-label={copy.prevMonth}
            title={copy.prevMonth}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold text-slate-900" data-testid="period-label">
              {monthLabel(month)}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {isFiltered
                ? `${formatDate(window.start)} – ${formatDate(window.end)}`
                : `${monthLabelShort(earliest)} – ${monthLabelShort(latest)}`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => step(1)}
            disabled={nextBlocked}
            aria-label={copy.nextMonth}
            title={nextBlocked ? copy.periodFuture : copy.nextMonth}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* ---- month / year pickers --------------------------------------- */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">
              {copy.periodSelectLabel}
            </span>
            <select
              aria-label={copy.periodSelectLabel}
              value={month.slice(5, 7)}
              onChange={(e) => {
                setRange(null);
                setMonth(clampMonth(`${month.slice(0, 4)}-${e.target.value}-01`, earliest, latest));
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
            >
              {Array.from({ length: 12 }, (_, i) => `${i + 1}`.padStart(2, "0")).map((mm) => (
                <option key={mm} value={mm}>
                  {new Date(Date.UTC(2000, Number(mm) - 1, 1)).toLocaleDateString("en-GB", {
                    month: "long",
                    timeZone: "UTC",
                  })}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Year</span>
            <select
              aria-label="Year"
              value={month.slice(0, 4)}
              onChange={(e) => {
                setRange(null);
                setMonth(clampMonth(`${e.target.value}-${month.slice(5, 7)}-01`, earliest, latest));
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
            >
              {yearsIn(earliest, latest).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Jump straight to the earliest month, which is the account opening. */}
        <button
          type="button"
          onClick={() => {
            setRange(null);
            setMonth(earliest);
          }}
          disabled={month === earliest}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copy.earliestLabel} · {monthLabelShort(earliest)}
        </button>

        {/* ---- optional date range ---------------------------------------- */}
        <details className="mt-2">
          <summary className="cursor-pointer list-none rounded-xl px-1 py-1.5 text-xs font-medium text-river-700 marker:hidden">
            {copy.rangeStartLabel} / {copy.rangeEndLabel}
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">
                {copy.rangeStartLabel}
              </span>
              <input
                type="date"
                aria-label={copy.rangeStartLabel}
                value={range?.start ?? ""}
                max={today}
                onChange={(e) =>
                  setRange((r) => ({
                    start: e.target.value,
                    end: r?.end ?? "",
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">
                {copy.rangeEndLabel}
              </span>
              <input
                type="date"
                aria-label={copy.rangeEndLabel}
                value={range?.end ?? ""}
                max={today}
                onChange={(e) =>
                  setRange((r) => ({
                    start: r?.start ?? "",
                    end: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
              />
            </label>
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={() => setRange(null)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {copy.rangeClear}
            </button>
          )}
        </details>
      </div>

      {/* ---- the list (visuals unchanged) -------------------------------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-slate-500">
              {isFutureMonth(month, today) ? copy.periodFuture : copy.periodEmpty}
            </p>
            {isFiltered && (
              <button
                type="button"
                onClick={() => setRange(null)}
                className="mt-2 text-xs font-medium text-river-700 underline"
              >
                {copy.rangeClear}
              </button>
            )}
          </div>
        ) : (
          visible.map((t, i) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              demoBadge={copy.demoBadge}
              demoNote={copy.demoNote}
              divided={i !== visible.length - 1}
            />
          ))
        )}
      </div>

      {/* ---- see all ------------------------------------------------------
          A real anchor, not a styled span: it is focusable, keyboard
          activatable, announced as a link, and shows a pointer cursor. The
          click is intercepted so the SPA switches view without reloading, but
          the href keeps it a genuine hyperlink for assistive tech. It is shown
          whenever there is anything beyond the page, and also when a period has
          more history worth opening. */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[11px] text-slate-500" data-testid="activity-count">
          {copy.showingCount
            .replace("{shown}", String(visible.length))
            .replace("{total}", String(rows.length))}
        </p>
        <a
          href="#all-activity"
          onClick={(e) => {
            e.preventDefault();
            onSeeAll();
          }}
          data-testid="see-all-link"
          className="inline-flex items-center gap-1 text-sm font-semibold text-river-700 underline underline-offset-2 hover:text-river-800"
        >
          {copy.seeAll}
        </a>
      </div>

      {hasMore && (
        <p className="px-1 text-[11px] leading-relaxed text-slate-400">
          {copy.seeAllHint.replace("{total}", String(rows.length))}
        </p>
      )}

      {rows.some((t) => t.isDemo) && (
        <p className="px-1 text-[11px] leading-relaxed text-slate-400">{copy.demoNote}</p>
      )}
    </div>
  );
}

/** The years spanned by [earliest, latest], newest first. */
function yearsIn(earliest: MonthKey, latest: MonthKey): string[] {
  const first = Number(earliest.slice(0, 4));
  const last = Number(latest.slice(0, 4));
  const out: string[] = [];
  for (let y = last; y >= first && out.length < 40; y--) out.push(String(y));
  return out;
}

