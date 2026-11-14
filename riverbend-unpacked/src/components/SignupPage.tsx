import { useContent } from "../admin/store";

export default function SignupPage() {
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const s = content.signup;
  const c = content.contact;

  return (
    <section id="signup-page" className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-river-100/60 blur-3xl" />
      </div>

      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-river-100 text-river-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>

          <h2 className="mt-6 text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {s.headline}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-slate-600">
            {s.body}
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-river-700 text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <path d="M9 22V12h6v10" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Visit a branch</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Stop by our flagship office in Vilnius to meet a member advisor
                and complete your membership in person.
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {c.address}
              </p>
              <p className="mt-1 text-xs text-slate-500">{c.hours}</p>
            </div>

            <div className="rounded-2xl border border-river-200 bg-river-50/60 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-river-700 text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  <path d="M8 9h8M8 13h5" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Contact us first</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Reach our customer relations team and we'll guide you through the
                next steps and book an appointment for you.
              </p>
              <div className="mt-4 space-y-1 text-xs">
                <p>
                  <span className="font-semibold text-slate-700">Phone:</span>{" "}
                  <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="text-river-700 hover:text-river-800">
                    {c.phone}
                  </a>
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Email:</span>{" "}
                  <a href={`mailto:${c.email}`} className="text-river-700 hover:text-river-800">
                    {c.email}
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-100 bg-white p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Already a member?
            </p>
            <a
              href="#login"
              className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-river-700 hover:text-river-800"
            >
              Sign in to your account →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}