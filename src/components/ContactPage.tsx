import { useState } from "react";
import { useContent } from "../admin/store";
import { DatabaseError, submitContactMessage } from "../account/db";

export default function ContactPage() {
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const c = content.contact;
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [values, setValues] = useState({ fullName: "", email: "", message: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);

  const setValue = (key: "fullName" | "email" | "message", value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    // Clear this field's complaint as soon as the visitor edits it, so the form
    // is not nagging about something they have already fixed.
    setFieldErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;

    setFormError("");

    const fullName = values.fullName.trim();
    const email = values.email.trim();
    const message = values.message.trim();

    // Required-field and format checks. The same rules exist in Postgres; these
    // run first purely so the visitor gets a clear message next to the field.
    const errors: Record<string, string> = {};
    if (!fullName) errors.fullName = "Please enter your full name.";
    if (!email) errors.email = "Please enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      errors.email = "Please enter a valid email address, like name@example.com.";
    if (!message) errors.message = "Please write a message.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSending(true);
    try {
      // Only a resolved promise means the row is really stored. Anything else
      // throws and lands in the catch below — never in the success panel.
      await submitContactMessage({ fullName, email, message });
      setName(fullName.split(" ")[0] || fullName);
      setSubmitted(true);
      setValues({ fullName: "", email: "", message: "" });
      setFieldErrors({});
    } catch (err) {
      setFormError(
        err instanceof DatabaseError
          ? err.message
          : "We couldn't send your message just now. Please try again, or email us directly."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="contact-page" className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-river-100/60 blur-3xl" />
        <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-cyan-100/50 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-river-700">
            Contact us
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            We're here to listen.
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Send us a message and our customer relations team will get back to
            you. Or reach us directly through the channels below.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-5">
          <aside className="lg:col-span-2">
            <div className="rounded-3xl bg-gradient-to-br from-river-800 to-river-950 p-6 text-white shadow-xl sm:p-8">
              <h3 className="text-lg font-semibold">Reach us directly</h3>
              <p className="mt-1 text-sm text-river-100">
                We respond to all inquiries within one business day.
              </p>

              <ul className="mt-6 space-y-5 text-sm">
                <li className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-river-200">Address</p>
                    <p className="mt-0.5 leading-relaxed">{c.address}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-river-200">Phone</p>
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="mt-0.5 inline-block hover:text-white">
                      {c.phone}
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <path d="m22 6-10 7L2 6" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-river-200">Email</p>
                    <a href={`mailto:${c.email}`} className="mt-0.5 inline-block hover:text-white">
                      {c.email}
                    </a>
                  </div>
                </li>
              </ul>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-river-100">
                <p className="font-semibold text-white">Customer relations</p>
                <p className="mt-1">{c.hours}</p>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-3">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8"
            >
              {submitted ? (
                <SubmittedState name={name} onReset={() => setSubmitted(false)} />
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Send us a message
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">{c.formIntro}</p>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Full name"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      placeholder="Your full name"
                      value={values.fullName}
                      error={fieldErrors.fullName}
                      onChange={(v) => setValue("fullName", v)}
                    />
                    <Field
                      label="Email address"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={values.email}
                      error={fieldErrors.email}
                      onChange={(v) => setValue("email", v)}
                    />
                  </div>

                  <div className="mt-4">
                    <label
                      htmlFor="contact-message"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Message
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      rows={5}
                      placeholder="Tell us what's on your mind…"
                      value={values.message}
                      onChange={(e) => setValue("message", e.target.value)}
                      aria-invalid={fieldErrors.message ? true : undefined}
                      className={
                        "mt-2 w-full resize-none rounded-xl border bg-white px-3 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:ring-2 " +
                        (fieldErrors.message
                          ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/20"
                          : "border-slate-200 focus:border-river-400 focus:ring-river-500/20")
                      }
                    />
                    {fieldErrors.message && (
                      <p className="mt-1 text-xs text-rose-600">{fieldErrors.message}</p>
                    )}
                  </div>

                  {formError && (
                    <div
                      role="alert"
                      className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-800"
                    >
                      <p className="font-semibold">Your message was not sent.</p>
                      <p className="mt-1">{formError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sending}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-river-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-river-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? "Sending…" : "Send message"}
                  </button>
                  <p className="mt-3 text-center text-xs text-slate-400">
                    Your message goes directly to our customer relations team at{" "}
                    <span className="font-medium text-slate-600">{c.email}</span>.
                  </p>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  type,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const id = `contact-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        className={
          "mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:ring-2 " +
          (error
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/20"
            : "border-slate-200 focus:border-river-400 focus:ring-river-500/20")
        }
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function SubmittedState({ name, onReset }: { name: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h3 className="mt-4 text-xl font-semibold text-slate-900">Message sent, {name}.</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Thanks for reaching out — your message has been saved and our customer
        relations team can now see it in the admin dashboard.
      </p>
      <button
        onClick={onReset}
        className="mt-6 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        Send another message
      </button>
    </div>
  );
}