import { useContent } from "../admin/store";
import { homeImages } from "../lib/images";
import { IconArrowRight } from "./icons";

/**
 * The marketing homepage sections that sit under the hero.
 *
 * Every word on this page comes from `content.about` in the CMS — the same
 * object the standalone About page renders. Nothing here invents history,
 * figures, addresses or claims: the copy, the three values and the four
 * footprint figures are exactly what the admin already edits on the
 * "Landing · About" tab. Changing them there changes both pages.
 *
 * The photographs are decorative placeholders (see src/lib/images.ts).
 */

export default function HomepageSections({ onNavigate }: { onNavigate: (href: string) => void }) {
  const { content, version } = useContent(); // re-renders when the admin saves
  void version;
  const a = content.about;

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Story + head-office photograph */}
      {/* ------------------------------------------------------------------ */}
      <section id="home-story" className="relative overflow-hidden bg-river-50/50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-river-700">
                {a.storyEyebrow}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {a.storyHeadline}
              </h2>
              <div className="mt-5 space-y-4">
                {a.storyParagraphs.map((p, i) => (
                  <p key={i} className="text-base leading-relaxed text-slate-600">
                    {p}
                  </p>
                ))}
              </div>
              <button
                onClick={() => onNavigate("#about")}
                className="mt-7 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                Read our full story
                <IconArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="order-1 lg:order-2">
              <figure className="relative">
                <img
                  src={homeImages.bank}
                  alt="A bank building on a tree-lined city street"
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-3xl object-cover shadow-xl shadow-slate-900/10"
                />
                <figcaption className="mt-3 text-[11px] text-slate-500">
                  {a.eyebrow}
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Intro + values */}
      {/* ------------------------------------------------------------------ */}
      <section id="home-values" className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-river-700">
              {a.eyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {a.headline}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{a.intro}</p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {a.values.map((v, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-river-100 text-river-700">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Family-led section with two photographs */}
      {/* ------------------------------------------------------------------ */}
      <section id="home-family" className="relative overflow-hidden py-16 sm:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-cyan-100/50 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-river-100/60 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="grid grid-cols-2 gap-4">
              <img
                src={homeImages.advisor}
                alt="An advisor meeting with a young couple"
                loading="lazy"
                className="col-span-2 aspect-[16/10] w-full rounded-3xl object-cover shadow-lg shadow-slate-900/10"
              />
              <img
                src={homeImages.advice}
                alt="A close-up of a consultation across a desk"
                loading="lazy"
                className="col-span-2 aspect-[16/9] w-full rounded-3xl object-cover shadow-lg shadow-slate-900/10 sm:col-span-1 sm:aspect-square"
              />
              <div className="hidden flex-col justify-center rounded-3xl bg-gradient-to-br from-river-800 to-river-950 p-6 text-white sm:flex">
                <p className="text-3xl font-semibold tracking-tight">
                  {a.footprintStats[0]?.value ?? ""}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-river-200">
                  {a.footprintStats[0]?.label ?? ""}
                </p>
                <p className="mt-4 text-xs leading-relaxed text-river-100">{a.values[1]?.body ?? ""}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-river-700">
                {a.footprintEyebrow}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {a.values[0]?.title ?? a.headline}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                {a.values[0]?.body ?? a.intro}
              </p>

              <dl className="mt-8 grid grid-cols-2 gap-5">
                {a.footprintStats.map((s, i) => (
                  <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <dt className="text-[11px] uppercase tracking-wider text-slate-500">
                      {s.label}
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footprint band over the city photograph */}
      {/* ------------------------------------------------------------------ */}
      <section id="home-footprint" className="relative overflow-hidden">
        <img
          src={homeImages.city}
          alt="A city skyline at golden hour"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Overlay keeps the text readable regardless of the photograph. */}
        <div className="absolute inset-0 bg-gradient-to-br from-river-950/90 via-river-900/80 to-slate-950/85" />

        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-river-300">
              {a.footprintEyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {a.headline}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-river-100">{a.intro}</p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {a.footprintStats.map((s, i) => (
              <div key={i}>
                <p className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {s.value}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wider text-river-200">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Closing call to action */}
      {/* ------------------------------------------------------------------ */}
      <section id="home-cta" className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-xl shadow-slate-900/5 sm:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-river-700">
              {content.brand.name}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Talk to us about your next step.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-slate-600">
              Send a message and our customer relations team will get back to you — or read more
              about how we work.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => onNavigate("#contact")}
                className="inline-flex items-center gap-2 rounded-full bg-river-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-river-700/20 transition-all hover:-translate-y-0.5 hover:bg-river-800"
              >
                Send us a message
                <IconArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => onNavigate("#about")}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                About {content.brand.name}
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
