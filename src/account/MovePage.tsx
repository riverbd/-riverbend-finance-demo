import { useEffect, useState } from "react";
import { useAuth, formatMoney } from "./auth";
import {
  DatabaseError,
  EARLY_WITHDRAWAL_FEE_RATE,
  earlyWithdrawalFee,
  earlyWithdrawalNet,
} from "./db";
import { useContent } from "../admin/store";

type Account = "checking" | "savings";

export default function MovePage() {
  const { user, moveMoney, breakFixedSavings } = useAuth();
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const m = content.account.move;
  const [from, setFrom] = useState<Account>("checking");
  const [to, setTo] = useState<Account>("savings");
  const [amount, setAmount] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The fee preview is shown only after the first Continue, and only for a
  // fixed-savings -> checking break.
  const [feeShown, setFeeShown] = useState(false);

  // The preview must survive the customer editing the amount — the fee and the
  // net are derived from `amount` on every render, so they simply recalculate.
  // It is reappearing that is conditional. What must NOT survive is a change of
  // accounts: a preview approved for one pair must never be confirmed against
  // another.
  useEffect(() => {
    setFeeShown(false);
  }, [from, to]);

  if (!user) return null;

  const restricted = from === "savings" && to === "checking";

  const amt = parseFloat(amount);
  const validAmount = Number.isFinite(amt) && amt > 0;
  const fee = validAmount ? earlyWithdrawalFee(amt) : 0;
  const net = validAmount ? earlyWithdrawalNet(amt) : 0;

  const performMove = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || from === to) return;
    if (amt > user.balance[from]) {
      setError(`Insufficient funds — ${formatMoney(user.balance[from])} available.`);
      setShowWarning(false);
      return;
    }

    const fromLabel =
      from === "checking"
        ? content.account.accounts.checkingLabel
        : content.account.accounts.savingsLabel;
    const toLabel =
      to === "checking"
        ? content.account.accounts.checkingLabel
        : content.account.accounts.savingsLabel;

    setError(null);
    setSubmitting(true);
    try {
      if (restricted) {
        // Breaking fixed savings. The 5% fee is applied by the database inside
        // the same locked transaction that moves the money — this call only
        // says "move this amount"; it cannot influence the fee.
        await breakFixedSavings({
          amount: amt,
          merchant: `Transfer: ${fromLabel} → ${toLabel}`,
        });
      } else {
        // Atomic: both balances and both ledger legs commit as one transaction.
        await moveMoney({
          from,
          to,
          amount: amt,
          merchant: `Transfer: ${fromLabel} → ${toLabel}`,
        });
      }
      setShowWarning(false);
      setFeeShown(false);
      setShowSuccess(true);
    } catch (err) {
      setShowWarning(false);
      setError(
        err instanceof DatabaseError
          ? err.message
          : "We couldn't complete that transfer. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (from === to || submitting) return;

    // A fixed-savings break is always two steps: the first Continue only
    // reveals the fee and the net credit, so the customer sees what the early
    // withdrawal costs before anything moves.
    if (restricted && !feeShown) {
      if (!validateBeforeContinue()) return;
      setFeeShown(true);
      return;
    }

    performMove();
  };

  /** Shared pre-flight checks, used by both Continue steps. */
  const validateBeforeContinue = () => {
    if (!validAmount) {
      setError("Enter an amount greater than zero.");
      return false;
    }
    if (amt > user.balance[from]) {
      setError(`Insufficient funds — ${formatMoney(user.balance[from])} available.`);
      return false;
    }
    setError(null);
    return true;
  };

  const onClose = () => {
    setShowSuccess(false);
    setError(null);
    setFeeShown(false);
    setAmount("");
  };

  const onConfirmBreak = () => {
    performMove();
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">{m.heading}</h2>
        <p className="text-sm text-slate-500">{m.sub}</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            {m.fromLabel}
          </label>
          <select
            value={from}
            onChange={(e) => {
              const v = e.target.value as Account;
              setFrom(v);
              if (v === to) setTo(v === "checking" ? "savings" : "checking");
            }}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/20"
          >
            <option value="checking">
              {content.account.accounts.checkingLabel} · {formatMoney(user.balance.checking)}
            </option>
            <option value="savings">
              {content.account.accounts.savingsLabel} · {formatMoney(user.balance.savings)}
            </option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            {m.toLabel}
          </label>
          <select
            value={to}
            onChange={(e) => {
              const v = e.target.value as Account;
              setTo(v);
              if (v === from) setFrom(v === "checking" ? "savings" : "checking");
            }}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/20"
          >
            <option value="checking">
              {content.account.accounts.checkingLabel} · {formatMoney(user.balance.checking)}
            </option>
            <option value="savings">
              {content.account.accounts.savingsLabel} · {formatMoney(user.balance.savings)}
            </option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            {m.amountLabel}
          </label>
          <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-river-400 focus-within:ring-2 focus-within:ring-river-500/20">
            <span className="text-base font-semibold text-slate-500">$</span>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent px-2 py-3 text-sm text-slate-900 outline-none placeholder-slate-400"
            />
          </div>
        </div>

        {restricted && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">Heads up — restricted move</p>
            <p className="mt-1">{m.restrictionWarning}</p>
          </div>
        )}

        {/* Fee preview. Appears only after the first Continue, and only for a
            fixed-savings break. Both fields are read-only and recalculate from
            the amount above, so the customer can always see what they are
            about to confirm. */}
        {restricted && feeShown && (
          <div className="grid gap-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="breaking-fee"
                className="block text-xs font-semibold uppercase tracking-wider text-sky-900"
              >
                {m.breakingFeeLabel}
              </label>
              <input
                id="breaking-fee"
                type="text"
                readOnly
                aria-readonly="true"
                value={formatMoney(fee)}
                className="mt-2 w-full cursor-not-allowed rounded-xl border border-sky-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
              />
              <p className="mt-1 text-[11px] text-sky-800">
                {EARLY_WITHDRAWAL_FEE_RATE * 100}% of the amount.
              </p>
            </div>
            <div>
              <label
                htmlFor="withdraw-amount"
                className="block text-xs font-semibold uppercase tracking-wider text-sky-900"
              >
                {m.withdrawAmountLabel}
              </label>
              <input
                id="withdraw-amount"
                type="text"
                readOnly
                aria-readonly="true"
                value={formatMoney(net)}
                className="mt-2 w-full cursor-not-allowed rounded-xl border border-sky-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none"
              />
              <p className="mt-1 text-[11px] text-sky-800">
                Credited to Checking after the fee.
              </p>
            </div>

            {/* The button below both fields confirms the move, not another
                step. Saying so explicitly stops a second click being read as
                "next" when it actually moves the money. */}
            <p className="text-[11px] leading-relaxed text-sky-900 sm:col-span-2">
              <span className="font-semibold">Final confirmation.</span> Pressing{" "}
              {m.confirmLabel} will move{" "}
              <span className="font-semibold">{formatMoney(amt)}</span> out of Fixed savings and
              credit <span className="font-semibold">{formatMoney(net)}</span> to Checking. The{" "}
              {formatMoney(fee)} fee is retained.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <p className="font-semibold">Transfer failed</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={from === to || submitting}
          className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-river-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-river-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "Moving…"
            : restricted
              ? feeShown
                ? m.confirmLabel
                : m.continueLabel
              : m.submitLabel}
        </button>

        {restricted && feeShown && (
          <button
            type="button"
            onClick={() => setFeeShown(false)}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Back to amount
          </button>
        )}
      </form>

      {/* Warning modal for restricted move */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>
            <h3 className="mt-4 text-center text-lg font-semibold text-slate-900">
              Break the fixed savings term?
            </h3>
            <p className="mt-2 text-center text-sm text-slate-500">
              {m.restrictionWarning}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowWarning(false)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmBreak}
                className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Break & transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h3 className="mt-4 text-center text-lg font-semibold text-slate-900">
              {m.successHeadline}
            </h3>
            <p className="mt-2 text-center text-sm text-slate-500">{m.successBody}</p>
            <button
              onClick={onClose}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-river-700 px-5 py-3 text-sm font-semibold text-white hover:bg-river-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}