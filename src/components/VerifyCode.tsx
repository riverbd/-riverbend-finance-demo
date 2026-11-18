import { useCallback, useEffect, useRef, useState } from "react";
import { RiverbendLogo, IconShield } from "./icons";
import { DatabaseError } from "../account/db";
import { fetchVerificationStatus } from "../account/db";
import { useAuth } from "../account/auth";

/**
 * Step 2 of sign-in: the admin-mediated six-digit code.
 *
 * The customer never receives the code from this app — the admin reads it off
 * the admin Users page and passes it on out-of-band. So this screen's job is to
 * take six digits, show how long they are good for, and offer a way to ask for
 * a fresh one.
 *
 * The code is never fetched here; `fetchVerificationStatus` returns timing and
 * status only. That is a deliberate boundary, not an oversight.
 */

const CODE_LENGTH = 6;

/** Seconds remaining, ticking down from the database's reported value. */
function useCountdown(initial: number) {
  const [seconds, setSeconds] = useState(initial);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    startedAt.current = Date.now();
    setSeconds(initial);
  }, [initial]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
      setSeconds(Math.max(initial - elapsed, 0));
    }, 250);
    return () => window.clearInterval(id);
  }, [initial]);

  return seconds;
}

function formatClock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VerifyCode({
  onVerified,
  onCancel,
}: {
  onVerified: () => void;
  onCancel: () => void;
}) {
  const { pendingChallenge, completeSignIn, cancelVerification } = useAuth();

  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [challengeKey, setChallengeKey] = useState(0);

  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const clock = useCountdown(secondsLeft);
  const expired = clock <= 0;

  // Read the real expiry from the database rather than assuming the default
  // 300s, and re-read whenever a replacement code is issued.
  useEffect(() => {
    if (!pendingChallenge) return;
    let cancelled = false;
    fetchVerificationStatus(pendingChallenge.challengeId)
      .then((snap) => {
        if (cancelled || !snap) return;
        setSecondsLeft(snap.secondsLeft);
        setAttemptsLeft(snap.attemptsLeft);
        setChallengeKey((k) => k + 1);
      })
      .catch(() => {
        // A status read failing must not block the customer from entering a
        // code; the countdown simply falls back to the default window.
      });
    return () => {
      cancelled = true;
    };
  }, [pendingChallenge]);

  useEffect(() => {
    // Focus the first box as soon as the screen appears.
    inputs.current[0]?.focus();
  }, [challengeKey]);

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    setError("");

    // Pasting the whole code into one box fills every box.
    if (clean.length > 1) {
      const next = Array(CODE_LENGTH).fill("");
      clean
        .slice(0, CODE_LENGTH)
        .split("")
        .forEach((d, i) => {
          next[i] = d;
        });
      setDigits(next);
      inputs.current[Math.min(clean.length, CODE_LENGTH - 1)]?.focus();
      return;
    }

    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });

    if (clean && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const submit = useCallback(
    async (code: string) => {
      if (submitting) return;
      setError("");
      setNotice("");
      setSubmitting(true);
      try {
        const ok = await completeSignIn(code);
        if (ok) {
          onVerified();
          return;
        }
        // The database returns the same failure for wrong, expired and used
        // codes, so the message covers all three without confirming which.
        setError(
          expired
            ? "That code has expired. Tap “Send me a new code” to get a fresh one."
            : "That code isn’t valid or has already been used. Check the six digits with our team, or send for a new code."
        );
        setDigits(Array(CODE_LENGTH).fill(""));
        inputs.current[0]?.focus();
        if (pendingChallenge) {
          const snap = await fetchVerificationStatus(pendingChallenge.challengeId).catch(() => null);
          if (snap) {
            setAttemptsLeft(snap.attemptsLeft);
            setSecondsLeft(snap.secondsLeft);
          }
        }
      } catch (e) {
        setError(
          e instanceof DatabaseError
            ? e.message
            : "We couldn’t check that code. Check your connection and try again."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [completeSignIn, expired, onVerified, pendingChallenge, submitting]
  );

  // Auto-submit once all six digits are in, which is what people expect from a
  // code screen and saves a tap on a phone.
  useEffect(() => {
    const code = digits.join("");
    if (code.length === CODE_LENGTH && !submitting) void submit(code);
    // `digits` is the trigger; submit identity changes every render by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const requestNewCode = async () => {
    if (resending || !pendingChallenge) return;
    setResending(true);
    setError("");
    setNotice("");
    try {
      // Re-opening the challenge needs the password again. The auth provider
      // does not cache it, so the customer is sent back to the password step
      // rather than this app silently holding a credential in memory.
      cancelVerification();
      onCancel();
      setNotice("");
    } finally {
      setResending(false);
    }
  };

  if (!pendingChallenge) return null;

  const firstName = pendingChallenge.displayName.split(" ")[0];

  return (
    <section id="verify-page" className="relative overflow-hidden py-16 sm:py-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-river-100/60 blur-3xl" />
        <div className="absolute right-0 top-32 h-64 w-64 rounded-full bg-cyan-100/50 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-md px-5 sm:px-8">
        <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">
          <div className="flex items-center gap-2 text-river-700">
            <RiverbendLogo className="h-7 w-7" />
            <span className="text-base font-semibold tracking-tight text-slate-900">Riverbend</span>
          </div>

          <div className="mt-5 flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-river-50 text-river-700">
              <IconShield className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Enter your code
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {firstName}, we sent a six-digit code to your phone. Ask our team if it hasn&rsquo;t
                arrived.
              </p>
            </div>
          </div>

          <form
            className="mt-7"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(digits.join(""));
            }}
          >
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Six-digit code
            </label>

            <div className="mt-2 flex justify-between gap-1.5 sm:gap-2">
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  value={digit}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit ${i + 1}`}
                  maxLength={CODE_LENGTH}
                  disabled={submitting}
                  className="h-14 w-full min-w-0 rounded-xl border border-slate-200 bg-white text-center text-xl font-semibold text-slate-900 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/20 disabled:opacity-60 sm:h-16 sm:text-2xl"
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              {expired ? (
                <span className="font-semibold text-rose-600">Code expired</span>
              ) : (
                <span className="text-slate-500">
                  Expires in{" "}
                  <span className="font-semibold tabular-nums text-slate-700">
                    {formatClock(clock)}
                  </span>
                </span>
              )}
              <span className="text-slate-400">
                {attemptsLeft} {attemptsLeft === 1 ? "try" : "tries"} left
              </span>
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">
                {error}
              </p>
            )}
            {notice && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || digits.join("").length !== CODE_LENGTH}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-river-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-river-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Checking…" : "Verify and sign in"}
            </button>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => void requestNewCode()}
                disabled={resending}
                className="text-xs font-semibold text-river-700 hover:text-river-800 disabled:opacity-60"
              >
                Send me a new code
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelVerification();
                  onCancel();
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Back to sign in
              </button>
            </div>
          </form>
        </div>

        <p className="mt-5 rounded-2xl border border-river-200 bg-river-50/60 p-4 text-[11px] leading-relaxed text-river-900">
          <span className="font-semibold">How this works.</span> For your security a member of our
          team reads your six-digit code to you directly. It is valid for five minutes and can only
          be used once.
        </p>
      </div>
    </section>
  );
}
