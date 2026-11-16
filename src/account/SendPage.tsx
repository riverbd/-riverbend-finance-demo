import { useState } from "react";
import { useAuth, formatMoney } from "./auth";
import { DatabaseError } from "./db";
import { useContent } from "../admin/store";

export default function SendPage() {
  const { user, sendMoney } = useAuth();
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const s = content.account.send;
  // External transfers leave from Checking only. Fixed savings is not offered
  // here, and riverbend_send() in the database rejects it regardless of what a
  // caller sends, so this is a UI simplification rather than the only guard.
  const from = "checking" as const;
  const [recipientName, setRecipientName] = useState("");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [recipientBank, setRecipientBank] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  // An admin can suspend the Checking account. When inactive the database
  // refuses external transfers, and the form is blocked here so the customer
  // gets an explanation instead of a failed submission.
  const checkingInactive = user.status.checking === "inactive";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkingInactive || submitting) return; // inactive checking cannot send
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (amt > user.balance[from]) {
      setError(
        `Insufficient funds — your ${content.account.accounts.checkingLabel.toLowerCase()} balance is ${formatMoney(
          user.balance.checking
        )}.`
      );
      return;
    }

    const recipientLabel = recipientName
      ? `${recipientName} · ${recipientBank || "External bank"}`
      : recipientAccount || "External transfer";

    setError(null);
    setSubmitting(true);
    try {
      // Atomic: the debit and the ledger row commit together in Postgres, then
      // the account is reloaded from the database.
      await sendMoney({
        from,
        amount: amt,
        merchant: `Transfer to ${recipientLabel}`,
      });
      setShowSuccess(true);
    } catch (err) {
      setError(
        err instanceof DatabaseError
          ? err.message
          : "We couldn't complete that transfer. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onClose = () => {
    setShowSuccess(false);
    setError(null);
    setRecipientName("");
    setRecipientAccount("");
    setRecipientBank("");
    setAmount("");
    setNote("");
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">{s.heading}</h2>
        <p className="text-sm text-slate-500">{s.sub}</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            {s.fromLabel}
          </label>
          <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
            <span className="text-sm font-medium text-slate-900">
              {content.account.accounts.checkingLabel}
            </span>
            <span className="text-sm font-semibold text-slate-700">
              {formatMoney(user.balance.checking)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            External transfers are sent from your Checking account.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {s.toLabel}
          </p>
          <Field
            label={s.recipientNameLabel}
            value={recipientName}
            onChange={setRecipientName}
            placeholder="e.g. Ada Lovelace"
          />
          <Field
            label={s.recipientAccountLabel}
            value={recipientAccount}
            onChange={setRecipientAccount}
            placeholder="0000 0000 0000 0000"
            inputMode="numeric"
          />
          <Field
            label={s.recipientBankLabel}
            value={recipientBank}
            onChange={setRecipientBank}
            placeholder="e.g. Barclays, Chase, SEB…"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            {s.amountLabel}
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

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            {s.noteLabel}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's this for?"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/20"
          />
        </div>

        {checkingInactive && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <p className="font-semibold">Heads up — Checking account inactive</p>
            {/* Admin-editable copy: ContentState.account.send.inactiveCheckingWarning */}
            <p className="mt-1">{s.inactiveCheckingWarning}</p>
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
          disabled={checkingInactive || submitting}
          aria-disabled={checkingInactive || submitting}
          className={
            "mt-2 inline-flex w-full items-center justify-center rounded-xl bg-river-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all " +
            (checkingInactive
              ? "cursor-not-allowed opacity-40 blur-[1.5px]"
              : "hover:-translate-y-0.5 hover:bg-river-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50")
          }
        >
          {submitting ? "Sending…" : s.submitLabel}
        </button>
      </form>

      {showSuccess && (
        <SuccessModal
          headline={s.successHeadline}
          body={s.successBody}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric";
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <input
        type="text"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/20"
      />
    </div>
  );
}

function SuccessModal({
  headline,
  body,
  onClose,
}: {
  headline: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h3 className="mt-4 text-center text-lg font-semibold text-slate-900">{headline}</h3>
        <p className="mt-2 text-center text-sm text-slate-500">{body}</p>
        <button
          onClick={onClose}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-river-700 px-5 py-3 text-sm font-semibold text-white hover:bg-river-800"
        >
          Done
        </button>
      </div>
    </div>
  );
}