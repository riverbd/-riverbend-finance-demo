import { IconArrowRight, IconChart } from "./icons";
import { useContent } from "../admin/store";

type Props = {
  onNavigate: (href: string) => void;
};

export default function Hero({ onNavigate }: Props) {
  const { content, version } = useContent(); // version re-renders on save
  void version;
  const h = content.hero;

  return (
    <section id="top" className="relative overflow-hidden pt-20 sm:pt-24">
      {/* Soft decorative gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-river-200/40 blur-3xl" />
        <div className="absolute -right-24 top-40 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-100/50 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-12 pt-8 sm:px-8 sm:pb-16 sm:pt-12">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left: copy */}
          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-river-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-river-800 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-river-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-river-600" />
              </span>
              {h.badge}
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              {h.headline}{" "}
              <span className="text-gradient-river">{h.headlineAccent}</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
              {h.body}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onNavigate("#contact")}
                className="inline-flex items-center gap-2 rounded-full bg-river-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-river-700/20 transition-all hover:-translate-y-0.5 hover:bg-river-800 hover:shadow-xl"
              >
                {h.primaryCta}
                <IconArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => onNavigate("#about")}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                {h.secondaryCta}
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {h.trustBadges.map((b, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/60 px-3 py-1.5 backdrop-blur"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      i === 0 ? "bg-emerald-500" : i === 1 ? "bg-river-500" : "bg-amber-500"
                    }`}
                  />
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Right: decorative phone preview */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative mx-auto h-[560px] w-[280px] rounded-[42px] border border-slate-200 bg-slate-900 p-2 shadow-2xl shadow-river-900/20 sm:h-[600px] sm:w-[300px]">
              <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-white">
                {/* Notch */}
                <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />

                {/* Status bar */}
                <div className="flex items-center justify-between px-6 pt-3 text-[11px] font-semibold text-slate-700">
                  <span>9:41</span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                    <span className="h-1.5 w-2 rounded-sm bg-slate-700" />
                    <span className="h-1.5 w-3 rounded-sm bg-slate-700" />
                  </span>
                </div>

                {/* App content */}
                <div className="mt-6 px-5">
                  {/* Balance card (no greeting, no bell) */}
                  <div className="rounded-2xl bg-gradient-to-br from-river-700 to-river-900 p-4 text-white shadow-lg shadow-river-900/30">
                    <p className="text-xs text-river-100">Total balance</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      $12,480.<span className="text-base text-river-200">50</span>
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-river-100">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                        <IconChart className="h-3 w-3" />
                        +4.2% this month
                      </span>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {[
                      { label: "Send", color: "bg-river-100 text-river-700" },
                      { label: "Save", color: "bg-emerald-100 text-emerald-700" },
                      { label: "Cards", color: "bg-amber-100 text-amber-700" },
                      { label: "More", color: "bg-slate-100 text-slate-700" },
                    ].map((a) => (
                      <div key={a.label} className="flex flex-col items-center gap-1.5">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.color}`}
                        >
                          <span className="text-[10px] font-bold">{a.label[0]}</span>
                        </div>
                        <span className="text-[10px] font-medium text-slate-600">
                          {a.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Transactions */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Recent</p>
                      <p className="text-xs text-river-700">See all</p>
                    </div>
                    <div className="mt-3 space-y-3">
                      {[
                        {
                          name: "Coffee & Co.",
                          cat: "Food",
                          amt: "-$4.80",
                          color: "bg-amber-100 text-amber-700",
                        },
                        {
                          name: "Payroll",
                          cat: "Income",
                          amt: "+$3,200",
                          color: "bg-emerald-100 text-emerald-700",
                        },
                        {
                          name: "Grocery",
                          cat: "Shop",
                          amt: "-$62.30",
                          color: "bg-violet-100 text-violet-700",
                        },
                      ].map((t, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${t.color}`}
                            >
                              {t.name[0]}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-900">
                                {t.name}
                              </p>
                              <p className="text-[10px] text-slate-500">{t.cat}</p>
                            </div>
                          </div>
                          <p
                            className={`text-xs font-semibold ${
                              t.amt.startsWith("+") ? "text-emerald-600" : "text-slate-700"
                            }`}
                          >
                            {t.amt}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating savings card (decorative) */}
            <div className="animate-float-slow absolute -left-6 top-24 hidden w-56 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl sm:block">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <IconChart className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-900">
                    Savings goal reached
                  </p>
                  <p className="text-[10px] text-slate-500">Emergency fund</p>
                </div>
              </div>
            </div>

            {/* Floating global reach badge */}
            <div className="animate-float-slower absolute -right-6 bottom-32 hidden w-52 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl sm:block">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-river-100 text-river-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18" />
                    <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-900">23 countries</p>
                  <p className="text-[10px] text-slate-500">4 continents</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wave divider */}
      <div className="relative h-12 overflow-hidden text-river-50 sm:h-16">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </section>
  );
}