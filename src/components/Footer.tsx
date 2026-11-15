import { useState } from "react";
import { RiverbendLogo } from "./icons";
import { useContent } from "../admin/store";
import { DatabaseError, submitContactMessage } from "../account/db";

export default function Footer() {
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const c = content.contact;

  return (
    <footer id="contact" className="relative bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Brand block */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2 text-white">
              <RiverbendLogo className="h-7 w-7" />
              <span className="text-lg font-semibold tracking-tight">
                {content.brand.name}
              </span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-slate-400">
              {content.brand.tagline}.
            </p>
          </div>

          {/* Contact details */}
          <div className="lg:col-span-4">
            <p className="text-sm font-semibold text-white">Contact us</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-river-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <span className="leading-relaxed">{c.address}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-river-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </span>
                <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:text-white">
                  {c.phone}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-river-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="m22 6-10 7L2 6" />
                  </svg>
                </span>
                <a href={`mailto:${c.email}`} className="hover:text-white">
                  {c.email}
                </a>
              </li>
            </ul>
          </div>

          {/* Inquiry form */}
          <div className="lg:col-span-4">
            <p className="text-sm font-semibold text-white">Send us a message</p>
            <p className="mt-1 text-xs text-slate-400">
              We'll route your message to the right team.
            </p>
            <FooterInquiryForm />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-slate-800 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} {content.brand.name}. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#" className="hover:text-white">Privacy</a>
            <a href="#" className="hover:text-white">Terms</a>
            <a href="#" className="hover:text-white">Accessibility</a>
            <a href="#admin" className="hover:text-white">Admin</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterInquiryForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  // This footer form used to console.log and then claim the message was sent.
  // It now writes to the same contact_messages table the homepage form uses, so
  // the claim is only made once the row really exists.
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "sending") return;
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const fullName = ((data.get("name") as string) || "").trim();
    const email = ((data.get("email") as string) || "").trim();
    const message = ((data.get("message") as string) || "").trim();

    setError("");
    if (!fullName || !email || !message) {
      setError("Please fill in your name, email and message.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setState("sending");
    try {
      await submitContactMessage({ fullName, email, message });
      form.reset();
      setState("sent");
    } catch (err) {
      setError(
        err instanceof DatabaseError
          ? err.message
          : "We couldn't send your message just now. Please try again."
      );
      setState("idle");
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
      <input
        name="name"
        type="text"
        placeholder="Your name"
        autoComplete="name"
        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/30"
      />
      <input
        name="email"
        type="email"
        placeholder="Your email address"
        autoComplete="email"
        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/30"
      />
      <textarea
        name="message"
        rows={3}
        placeholder="How can we help?"
        className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-river-400 focus:ring-2 focus:ring-river-500/30"
      />

      {error && (
        <p role="alert" className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}
      {state === "sent" && (
        <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200">
          Thanks — your message has been saved for our customer relations team.
        </p>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-river-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-river-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
