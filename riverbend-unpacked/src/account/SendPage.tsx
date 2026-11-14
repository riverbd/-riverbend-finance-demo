import { useState } from "react";
import { useAuth, formatMoney } from "./auth";
import { useContent } from "../admin/store";

export default function SendPage() {
  const { user, updateAccount } = useAuth();
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const s = content.account.send;
  const [from, setFrom] = useState<"checking" | "savings">("checking");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [recipientBank, setRecipientBank] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  if (!user) return null;

  const restricted = from === "savings";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (restricted) return; // hard-block sending from Fixed savings
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (amt > user.balance[from]) return;

    const newBalance = { ...user.balance };
    newBalance[from] = +(newBalance[from] - amt).toFixed(2);

    const recipientLabel = recipientName
      ? `${recipientName} · ${recipientBank || "External bank"}`
      : recipientAccount || "External transfer";

    const newTx = {
      id: `tx-${Date.now()}`,
      merchant: `Transfer to ${recipientLabel}`,
      category: "Transfer",
      amount: -amt,
      date: new Date().toISOString().slice(0, 10),
      account: from,
    };
    updateAccount({
      balance: newBalance,
      transactions: [newTx, ...user.transactions],
    });
    setShowSuccess(true);
  };

  const onClose = () => {
    setShowSuccess(false);
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
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value as "checking" | "savings")}
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

        {restricted && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <p className="font-semibold">Heads up — sending from {content.account.accounts.savingsLabel} is not allowed</p>
            <p className="mt-1">{s.fixedSavingsWarning}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={restricted}
          className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-river-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-river-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {s.submitLabel}
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