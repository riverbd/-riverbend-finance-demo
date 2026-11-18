/**
 * Formatting helpers with no dependencies.
 *
 * `auth.tsx` also exports these, but importing anything from it pulls in the
 * Supabase client. The PDF renderer has no business knowing about the database,
 * so the formatters live here and `auth` re-exports them for existing callers.
 */

export function formatMoney(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * A transaction date with its year, e.g. "19 Apr 2019".
 *
 * Separate from `formatDate` so the period header above the activity list,
 * where the year is already in the month heading, keeps its shorter label.
 */
export function formatDateWithYear(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
