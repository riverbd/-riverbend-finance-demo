import { useState } from "react";
import { useAuth, getSampleAccounts } from "./auth";
import { useContent } from "../admin/store";
import { IconSnow, IconLock, IconCheck } from "./icons";

export default function Cards() {
  const { user, updateAccount, version: authVersion, refreshUser } = useAuth();
  const { content, version: contentVersion } = useContent();
  void authVersion;
  void contentVersion;
  const c = content.account.cards;
  const [toggling, setToggling] = useState<string | null>(null);

  // Always read the freshest data from the persistent cache, NOT from React state.
  // This bypasses any stale-state issue where the auth context's `user` hasn't
  // been updated after admin edits.
  const cachedAccounts = getSampleAccounts();
  const cachedUser = user
    ? cachedAccounts.find((a) => a.id === user.id)
    : undefined;

  if (!user || !cachedUser) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">User data unavailable</p>
        <p className="mt-1 text-xs">
          Sign in again to refresh your card list.
        </p>
        <button
          onClick={() => refreshUser()}
          className="mt-3 inline-flex items-center justify-center rounded-xl bg-river-700 px-4 py-2 text-xs font-semibold text-white hover:bg-river-800"
        >
          Refresh
        </button>
      </div>
    );
  }

  const cards = cachedUser.cards;

  const toggleFreeze = (id: string) => {
    setToggling(id);
    setTimeout(() => {
      const next = cards.map((card) =>
        card.id === id ? { ...card, frozen: !card.frozen } : card
      );
      updateAccount({ cards: next });
      setToggling(null);
    }, 350);
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">{c.heading}</h2>
        <p className="text-sm text-slate-500">{c.sub}</p>
      </header>

      <div className="space-y-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
              card.frozen ? "border-slate-200 bg-slate-100" : "border-slate-200 bg-white"
            }`}
          >
            <div
              className={`relative h-32 overflow-hidden rounded-xl p-4 text-white ${
                card.frozen
                  ? "bg-gradient-to-br from-slate-600 to-slate-800"
                  : "bg-gradient-to-br from-river-700 to-river-900"
              }`}
            >
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
                  {card.network}
                </p>
                {card.frozen && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
                    <IconSnow className="h-3 w-3" />
                    {c.frozenBadge}
                  </span>
                )}
              </div>
              <p className="mt-3 font-mono text-base tracking-widest">
                •••• •••• •••• {card.last4}
              </p>
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-[10px]">
                <div>
                  <p className="text-white/70">Member</p>
                  <p className="font-semibold">{card.cardholderName ?? user.fullName}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/70">Valid thru</p>
                  <p className="font-semibold">{card.expiry}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{card.label}</p>
                <p className="text-[11px] text-slate-500">•••• {card.last4}</p>
              </div>
              <button
                onClick={() => toggleFreeze(card.id)}
                disabled={toggling === card.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  card.frozen
                    ? "bg-river-100 text-river-700 hover:bg-river-200"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {toggling === card.id
                  ? "…"
                  : card.frozen
                  ? (
                    <>
                      <IconCheck className="h-3 w-3" /> {c.unfreezeButton}
                    </>
                  )
                  : (
                    <>
                      <IconSnow className="h-3 w-3" /> {c.freezeButton}
                    </>
                  )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-river-100 bg-river-50/50 p-4 text-xs text-river-900">
        <IconLock className="mt-0.5 h-4 w-4 text-river-700" />
        <p>{c.securityNote}</p>
      </div>
    </div>
  );
}