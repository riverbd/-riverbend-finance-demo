/**
 * Promotional card for the Fixed savings activity area.
 *
 * Strictly a display. It reads no account, computes no interest and writes
 * nothing — there is no state here and no call into the data layer. The rate it
 * shows is copy, not a figure derived from a balance, so nothing about the
 * customer's fixed savings account, its locked status or its history is touched
 * by its presence.
 *
 * It is rendered above the history and separated from it by the section heading
 * and its own card, so the promotion never reads as part of the ledger.
 */

export default function SavingsPromo({
  eyebrow,
  rate,
  body,
  note,
}: {
  eyebrow: string;
  rate: string;
  body: string;
  note: string;
}) {
  return (
    <section
      aria-labelledby="savings-promo-heading"
      data-testid="savings-promo"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-river-700 via-river-800 to-river-900 p-5 text-white shadow-sm sm:p-6"
    >
      {/* Decorative only, and clipped by the card. Hidden from assistive tech so
          the promotion is read as its words, not as stray shapes. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-10 h-44 w-44 rounded-full bg-emerald-300/20 blur-2xl"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p
            id="savings-promo-heading"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-river-100"
          >
            {eyebrow}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-white/90 sm:max-w-sm">
            {body}
          </p>
        </div>

        {/* The rate is the thing the card is selling, so it gets the size and
            its own surface. It stays legible at 320px because it is allowed to
            wrap under the copy rather than being squeezed beside it. */}
        <div className="shrink-0 self-start rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/20 sm:self-auto sm:px-5 sm:py-4">
          <p
            data-testid="savings-promo-rate"
            className="whitespace-nowrap text-2xl font-bold tracking-tight tabular-nums sm:text-3xl"
          >
            {rate}
          </p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-river-100">
            Annual interest
          </p>
        </div>
      </div>

      {note && (
        <p className="relative mt-4 border-t border-white/15 pt-3 text-[10px] leading-relaxed text-white/60">
          {note}
        </p>
      )}
    </section>
  );
}
