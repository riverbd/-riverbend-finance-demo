import { useEffect, useState } from "react";
import { RiverbendLogo, IconLock, IconShield } from "./icons";
import { useContent } from "../admin/store";
import { DatabaseError } from "../account/db";
import { useAuth, useDemoCustomers } from "../account/auth";
import VerifyCode from "./VerifyCode";

export default function LoginPage() {
  const { content, version } = useContent(); // version re-renders on save
  // Phase 2: once a challenge is open the password form steps aside for the
  // six-digit screen. Kept here rather than in App so every place that renders
  // LoginPage (marketing route and the dashboard gate) gets the same behaviour.
  const pending = useAuth().pendingChallenge;

  // Coming back from the code screen must leave a usable form, not one stuck on
  // the spinner the transition set.
  useEffect(() => {
    if (!pending) setSubmitting(false);
  }, [pending]);
  void version;
  const l = content.login;
  const loginCopy = content.account.login;
  const { signIn } = useAuth();
  // Sample-account hints come from Supabase; falls back to the local demo list
  // if the database cannot be read, so this marketing surface still renders.
  const { demoCustomers } = useDemoCustomers();
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const data = new FormData(e.currentTarget);
    const id = (data.get("identifier") as string).trim();
    const pwd = data.get("password") as string;
    setError("");

    // Phase 1: password only. On success a six-digit challenge opens and the
    // verification screen takes over — no session exists yet, so the dashboard
    // stays closed until the code is accepted.
    let ticket;
    try {
      ticket = await signIn(id, pwd);
    } catch (err) {
      // A database failure is NOT the same as a wrong password — say so.
      setError(
        err instanceof DatabaseError
          ? err.message
          : "We couldn't reach the database to sign you in. Please try again."
      );
      return;
    }

    if (!ticket) {
      setError("Those credentials don't match a sample account. Try the demo accounts shown below.");
      return;
    }

    // Brief spinner so the transition to the code screen reads as a step rather
    // than a flicker.
    setSubmitting(true);
  };

  const fillSample = (username: string, password: string) => {
    const form = document.querySelector("form") as HTMLFormElement | null;
    if (!form) return;
    (form.elements.namedItem("identifier") as HTMLInputElement).value = username;
    (form.elements.namedItem("password") as HTMLInputElement).value = password;
  };

  if (pending) {
    return (
      <VerifyCode
        onVerified={() => {
          window.location.hash = "dashboard";
        }}
        onCancel={() => {
          window.location.hash = "login";
        }}
      />
    );
  }

  return (
    <section id="login-page" className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-river-100/60 blur-3xl" />
        <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-cyan-100/50 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:items-start">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">
            <div className="flex items-center gap-2 text-river-700">
              <RiverbendLogo className="h-7 w-7" />
              <span className="text-base font-semibold tracking-tight text-slate-900">
                {content.brand.name}
              </span>
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {l.headline}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{l.body}</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Username or email
                </label>
                <input
                  name="identifier"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="alex or alex@riverbend.bank"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  <a href="#" className="text-xs font-medium text-river-700 hover:text-river-800">Forgot?</a>
                </div>
                <div className="relative mt-2">
                  <input
                    name="password"
                    type={showPwd ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 pr-12 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  >
                    {showPwd ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="remember"
                  className="h-4 w-4 rounded border-slate-300 text-river-600 focus:ring-river-500"
                />
                Keep me signed in
              </label>

              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-river-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-river-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-90"
              >
                {submitting ? (
                  <>
                    <Spinner />
                    {loginCopy.submittingLabel}
                  </>
                ) : (
                  "Sign in securely"
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-100" />
              New to {content.brand.name}?
              <span className="h-px flex-1 bg-slate-100" />
            </div>

            <a
              href="#signup"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Get started with {content.brand.name}
            </a>
          </div>

          {/* Sample accounts */}
          <div className="mt-5 rounded-2xl border border-river-200 bg-river-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-river-800">
              Sample accounts · click to fill
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {demoCustomers.map((a) => (
                <button
                  key={a.id}
                  onClick={() => fillSample(a.username, a.password)}
                  className="rounded-xl border border-river-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-sm font-semibold text-slate-900">{a.fullName}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Username: <code className="font-mono">{a.username}</code>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Password: <code className="font-mono">{a.password}</code>
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="rounded-3xl bg-gradient-to-br from-river-800 to-river-950 p-10 text-white">
            <IconShield className="h-10 w-10 text-river-300" />
            <h3 className="mt-6 text-2xl font-semibold tracking-tight">
              Bank-grade security, end to end.
            </h3>
            <p className="mt-3 text-sm text-river-100">
              Your credentials never leave your device unprotected. We use
              hardware-backed encryption and continuous fraud monitoring on
              every sign-in.
            </p>
            <ul className="mt-8 space-y-4 text-sm">
              {[
                { title: "Encrypted at rest and in transit", body: "256-bit TLS protects every byte of your data." },
                { title: "Multi-factor authentication", body: "Add an extra layer with biometrics or a one-time code." },
                { title: "Continuous fraud monitoring", body: "We flag suspicious activity the moment we detect it." },
              ].map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <IconLock className="h-3 w-3 text-river-200" />
                  </span>
                  <div>
                    <p className="font-semibold">{f.title}</p>
                    <p className="text-river-100">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-white"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}