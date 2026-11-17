/**
 * Activity period selection for the Checking activity list (Milestone 5).
 *
 * Kept free of React and of the database so the boundary rules — "the next
 * month button must never go past the current month", "the earliest month is
 * the account's opening month" — can be tested directly.
 *
 * All dates are plain "YYYY-MM-DD" strings, which is what `transactions.
 * occurred_on` and `customers.member_since` already are. Everything here is
 * string/UTC arithmetic, so no timezone can shift a transaction into the wrong
 * month on a phone in Lagos or a laptop in Vilnius.
 */

/** A calendar month, identified by its first day, e.g. "2024-03-01". */
export type MonthKey = string;

/** Inclusive YYYY-MM-DD date range, or null when showing a whole month. */
export type DateRange = { start: string; end: string } | null;

/** The month a YYYY-MM-DD date falls in. */
export function monthOf(date: string): MonthKey {
  return `${date.slice(0, 7)}-01`;
}

/** Today as YYYY-MM-DD in the viewer's own timezone. */
export function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Shift a month key by whole months. */
export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const mon = total % 12;
  return `${year}-${`${mon + 1}`.padStart(2, "0")}-01`;
}

/** Last day of a month, as YYYY-MM-DD. */
export function endOfMonth(month: MonthKey): string {
  const next = addMonths(month, 1);
  const [y, m, d] = next.split("-").map(Number);
  void d;
  const last = new Date(Date.UTC(y, m - 1, 0));
  const mm = `${last.getUTCMonth() + 1}`.padStart(2, "0");
  const dd = `${last.getUTCDate()}`.padStart(2, "0");
  return `${last.getUTCFullYear()}-${mm}-${dd}`;
}

/** "March 2024" — the label the customer reads. */
export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Mar 2024" — compact form for <option> labels and narrow screens. */
export function monthLabelShort(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Every month from `first` to `last` inclusive, newest first. */
export function monthsBetween(first: MonthKey, last: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  let cur = monthOf(last);
  const stop = monthOf(first);
  // Bounded so a corrupt date can never spin forever.
  for (let i = 0; i < 600 && cur >= stop; i++) {
    out.push(cur);
    cur = addMonths(cur, -1);
  }
  return out;
}

/**
 * The newest month the customer may page to.
 *
 * Two limits, whichever is earlier:
 *   * the current month, so the next button can never reach a future month and
 *     future-dated rows — which `riverbend_send()` can create via its optional
 *     p_occurred_on — stay out of reach;
 *   * the month of the newest transaction, so a history that has been closed
 *     off (Alex's ends in June 2022) does not offer months of empty pages after
 *     it, and the year selector stops at the last year with activity.
 *
 * With no transactions at all the current month is the sensible resting place.
 */
export function latestNavigableMonth(today: string, newestTransaction?: string): MonthKey {
  const cap = monthOf(today);
  if (!newestTransaction) return cap;
  const newest = monthOf(newestTransaction);
  return newest < cap ? newest : cap;
}

/** Clamp a month into the range the customer is allowed to look at. */
export function clampMonth(month: MonthKey, earliest: MonthKey, latest: MonthKey): MonthKey {
  if (month < earliest) return earliest;
  if (month > latest) return latest;
  return month;
}

/** Can the customer page back from this month? */
export function canGoPrev(month: MonthKey, earliest: MonthKey): boolean {
  return monthOf(month) > monthOf(earliest);
}

/** Can the customer page forward from this month without entering the future? */
export function canGoNext(month: MonthKey, latest: MonthKey): boolean {
  return monthOf(month) < monthOf(latest);
}

/**
 * The window the list actually filters on.
 *
 * A chosen date range wins over the month. Either end may be left blank, and a
 * blank end is read in the way a customer would mean it: no start means
 * "everything from the account opening", no end means "up to today". A range
 * whose end is in the future is capped at today — the list must never imply a
 * transaction that has not happened.
 */
export function effectiveWindow(
  month: MonthKey,
  range: DateRange,
  today: string,
  earliest: MonthKey = month
): { start: string; end: string } {
  const capEnd = (end: string) => (end > today ? today : end);

  if (range && (range.start || range.end)) {
    const start = range.start || monthOf(earliest);
    const end = capEnd(range.end || today);
    // A reversed range is almost certainly a slip; swapping it is friendlier
    // than showing an inexplicable empty list.
    return start <= end ? { start, end } : { start: end, end: start };
  }

  return { start: month, end: capEnd(endOfMonth(month)) };
}

/** Filter helper shared by the page and its tests. */
export function inWindow(date: string, window: { start: string; end: string }): boolean {
  return date >= window.start && date <= window.end;
}

/** True when a month is later than the month we are allowed to show. */
export function isFutureMonth(month: MonthKey, today: string): boolean {
  return monthOf(month) > monthOf(today);
}
