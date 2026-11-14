import { useContent } from "../admin/store";

export default function AboutPage() {
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const a = content.about;

  return (
    <section id="about-page" className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-river-100/60 blur-3xl" />
        <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-cyan-100/50 blur-3xl" />
      </div>

      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-river-700">
            {a.eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            {a.headline}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            {a.intro}
          </p>
        </div>

        <div className="mt-12 rounded-3xl border border-slate-100 bg-white p-7 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-river-700">
            {a.storyEyebrow}
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {a.storyHeadline}
          </h3>
          <div className="mt-4 space-y-4">
            {a.storyParagraphs.map((p, i) => (
              <p key={i} className="text-base leading-relaxed text-slate-600">
                {p}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {a.values.map((v, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-river-100 text-river-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h4 className="mt-3 text-base font-semibold text-slate-900">{v.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{v.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-3xl bg-gradient-to-br from-river-800 to-river-950 p-7 text-white sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-river-200">
            {a.footprintEyebrow}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {a.footprintStats.map((s, i) => (
              <div key={i}>
                <p className="text-3xl font-semibold tracking-tight sm:text-4xl">{s.value}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-river-200">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}