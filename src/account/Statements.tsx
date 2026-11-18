import { useMemo, useState } from "react";
import { useAuth } from "./auth";
import { useContent } from "../admin/store";
import { formatDateWithYear, formatMoney } from "./format";
import { todayISO } from "./activity";
import type { AccountKind } from "./types";
import {
  EMPTY_STATEMENT_MESSAGE,
  buildStatement,
  defaultPeriod,
  isValidPeriod,
  periodBounds,
  type StatementPeriod,
} from "./statement";
import { downloadStatementPdf } from "./statementPdf";

/** Masked account identifiers, matching the account cards. */
const ACCOUNT_NUMBER: Record<AccountKind, string> = {
  checking: "•••• 4218",
  savings: "•••• 1147",
};

/**
 * Statement download.
 *
 * Renders a real preview of the figures before the customer commits to a
 * download, so the numbers on the PDF are never a surprise. The PDF is
 * generated in the browser from data already on the session; nothing is
 * fetched and nothing is written back.
 */
export default function Statements({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { content } = useContent();
  const copy = content.account.accounts;
  const s = content.account.statements;

  const [account, setAccount] = useState<AccountKind>("checking");
  const [period, setPeriod] = useState<StatementPeriod>(() =>
    user
      ? defaultPeriod(user.transactions, "checking", user.memberSince, todayISO())
      : { start: "", end: "" }
  );
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const bounds = periodBounds(user.transactions, account, user.memberSince, todayISO());
  const valid = isValidPeriod(period);

  const statement = useMemo(() => {
    if (!valid) return null;
    return buildStatement({
      accountKind: account,
      accountLabel: account === "savings" ? copy.savingsLabel : copy.checkingLabel,
      accountNumber: ACCOUNT_NUMBER[account],
      customerName: user.fullName,
      memberId: user.memberId,
      period,
      currentBalance:
        account === "savings" ? user.balance.savings : user.balance.checking,
      transactions: user.transactions,
    });
  }, [account, copy.checkingLabel, copy.savingsLabel, period, user, valid]);

  const download = () => {
    if (!statement) return;
    setBusy(true);
    try {
      downloadStatementPdf(statement);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs font-medium text-river-700 hover:underline"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {s.back}
        </button>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{s.heading}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{s.sub}</p>
      </header>

      {/* ---- account choice ------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3">
        {(["checking", "savings"] as AccountKind[]).map((kind) => {
          const active = account === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setAccount(kind)}
              aria-pressed={active}
              data-testid={`statement-account-${kind}`}
              className={`rounded-2xl border p-4 text-left transition-all ${
                active
                  ? "border-river-300 bg-river-50/60 shadow-sm"
                  : "border-slate-200 bg-white"
              }`}
            >
              <p className="text-xs text-slate-500">
                {kind === "savings" ? copy.savingsLabel : copy.checkingLabel}
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {formatMoney(kind === "savings" ? user.balance.savings : user.balance.checking)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">{ACCOUNT_NUMBER[kind]}</p>
            </button>
          );
        })}
      </div>

      {/* ---- period -------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">{s.startLabel}</span>
            <input
              type="date"
              aria-label={s.startLabel}
              value={period.start}
              min={bounds.min}
              max={period.end || bounds.max}
              onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-900"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">{s.endLabel}</span>
            <input
              type="date"
              aria-label={s.endLabel}
              value={period.end}
              min={period.start || bounds.min}
              max={bounds.max}
              onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-900"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPeriod({ start: bounds.min, end: bounds.max })}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            {s.fullHistory}
          </button>
          <button
            type="button"
            onClick={() =>
              setPeriod({
                start: new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10),
                end: bounds.max,
              })
            }
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            {s.last90}
          </button>
        </div>
        {!valid && (
          <p className="mt-2 text-[11px] font-medium text-rose-700" data-testid="period-error">
            {s.invalidPeriod}
          </p>
        )}
      </div>

      {/* ---- preview ------------------------------------------------------- */}
      {statement && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="statement-preview">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              {statement.accountLabel} · {statement.accountNumber}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {formatDateWithYear(statement.period.start)} – {formatDateWithYear(statement.period.end)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {statement.customerName} · {statement.memberId}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-px bg-slate-100">
            {[
              [s.openingBalance, formatMoney(statement.openingBalance), "opening"],
              [s.totalReceived, formatMoney(statement.totalReceived), "received"],
              [s.totalSpent, formatMoney(statement.totalSpent), "spent"],
              [s.closingBalance, formatMoney(statement.closingBalance), "closing"],
            ].map(([label, value, key]) => (
              <div key={key} className="bg-white px-4 py-3">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900" data-testid={`stat-${key}`}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="px-4 py-3">
            {statement.lines.length === 0 ? (
              <p className="text-center text-sm text-slate-500">{EMPTY_STATEMENT_MESSAGE}</p>
            ) : (
              <p className="text-[11px] text-slate-500">
                {statement.lines.length} transaction{statement.lines.length === 1 ? "" : "s"} in this period
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={download}
        disabled={!statement || busy}
        data-testid="download-statement"
        className="w-full rounded-xl bg-river-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-river-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? s.generating : s.download}
      </button>
      <p className="px-1 text-[11px] leading-relaxed text-slate-400">{s.disclosure}</p>
    </div>
  );
}
