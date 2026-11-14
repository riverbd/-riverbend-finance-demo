import { useState } from "react";
import { useContent, ADMIN_EMAIL } from "./store";
import { RiverbendLogo } from "../components/icons";

export default function AdminLogin() {
  const { loginAdmin, isAdmin } = useContent();
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");

  if (isAdmin) {
    // Will be redirected by parent — render nothing here
    return null;
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginAdmin(email, pwd)) {
      setError("Incorrect password.");
    } else {
      setError("");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-river-700/30 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-cyan-700/20 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-12">
        <div className="flex items-center gap-2 text-river-300">
          <RiverbendLogo className="h-7 w-7" />
          <span className="text-lg font-semibold tracking-tight">RIVERBEND</span>
        </div>

        <div className="mt-8 w-full rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-river-300">
            Admin
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Sign in to the admin panel
          </h1>
          <p className="mt-1 text-sm text-river-100">
            Edit the landing page copy from one place.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-river-200">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                placeholder="admin@example.com"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-river-200">
                Password
              </label>
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/30"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-river-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-river-500 hover:shadow-lg"
            >
              Sign in
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-[11px] leading-relaxed text-river-100">
            <p className="font-semibold text-white">Admin account</p>
            <p className="mt-0.5">
              Email: <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-river-200">
                {ADMIN_EMAIL}
              </code>
            </p>
            <p className="mt-1 text-slate-400">
              Browser-based demo sign-in is retained for now. Database authentication can be connected later.
            </p>
          </div>
        </div>

        <a
          href="#top"
          className="mt-6 text-xs text-river-200 hover:text-white"
        >
          ← Back to the landing page
        </a>
      </div>
    </div>
  );
}