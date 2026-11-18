import { useState } from "react";
import { useAuth } from "./auth";
import { DatabaseError } from "./db";
import { useContent } from "../admin/store";
import { IconSnow, IconLock, IconCheck } from "./icons";

export default function Cards() {
  const { user, freezeCard } = useAuth();
  const { content, version: contentVersion } = useContent();
  void contentVersion;
  const c = content.account.cards;
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">User data unavailable</p>
        <p className="mt-1 text-xs">Sign in again to refresh your card list.</p>
      </div>
    );
  }

  const cards = user.cards;

  const toggleFreeze = async (id: string, frozen: boolean) => {
    setToggling(id);
    setError(null);
    try {
      // Persists to Supabase, then reloads the account so this view reflects
      // what the database actually holds.
      await freezeCard(id, !frozen);
    } catch (e) {
      setError(
        e instanceof DatabaseError
          ? e.message
          : "We couldn't update that card. Please try again."
      );
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">{c.heading}</h2>
        <p className="text-sm text-slate-500">{c.sub}</p>
      </header>

      <div className="space-y-3">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <p className="font-semibold">Card update failed</p>
            <p className="mt-1">{error}</p>
          </div>
        )}
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
                  <p className="text-white/70">{c.expiresLabel}</p>
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
                onClick={() => toggleFreeze(card.id, card.frozen)}
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