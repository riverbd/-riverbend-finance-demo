import { useState } from "react";
import { useContent } from "./store";

/**
 * Admin sign-in.
 *
 * Deliberately minimal: a heading, a blank username field, a blank password
 * field, a LOGIN button and a way back to the marketing homepage. No card, no
 * illustration, no promotional copy, and nothing prefilled — the username field
 * previously defaulted to the admin email address, which put the account name
 * on screen for anyone opening the page. Both fields start empty on every load.
 *
 * Authentication itself is unchanged: `loginAdmin` is the same function the
 * dashboard has always used.
 */
export default function AdminLogin() {
  const { loginAdmin, isAdmin } = useContent();
  const [username, setUsername] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");

  if (isAdmin) {
    // Will be redirected by parent — render nothing here
    return null;
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAdmin(username, pwd)) {
      setError("");
    } else {
      setError("Incorrect username or password.");
    }
  };

  // Take the visitor to the marketing homepage. `#top` resolves to the home
  // page in App's route table; App listens for hashchange, so this navigates.
  const goToLandingPage = () => {
    window.location.hash = "top";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-5 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-wide text-slate-900">
          LOGIN
        </h1>

        {/* autoComplete off/new-password keeps browsers from autofilling the
            fields, so they are genuinely empty when the page opens. */}
        <form onSubmit={onSubmit} className="mt-8 space-y-4" autoComplete="off">
          <input
            type="text"
            name="username"
            aria-label="Username"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-river-500 focus:ring-2 focus:ring-river-500/20"
          />

          <input
            type="password"
            name="password"
            aria-label="Password"
            placeholder="Password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-river-500 focus:ring-2 focus:ring-river-500/20"
          />

          <button
            type="submit"
            className="w-full rounded-lg bg-river-700 px-5 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-river-800"
          >
            LOGIN
          </button>
        </form>

        {/* Only rendered after a failed attempt, so the idle page is exactly the
            five required elements. aria-live announces it to screen readers. */}
        {error && (
          <p
            role="alert"
            aria-live="polite"
            className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={goToLandingPage}
          className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-50"
        >
          GO BACK TO LANDING PAGE
        </button>
      </div>
    </div>
  );
}
