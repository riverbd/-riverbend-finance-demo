import { useEffect, useState } from "react";
import { RiverbendLogo, IconMenu, IconClose } from "./icons";
import { useContent } from "../admin/store";

const navLinks = [
  { label: "Contact", href: "#contact" },
  { label: "About", href: "#about" },
  { label: "Login", href: "#login" },
  { label: "Sign up", href: "#signup" },
];

export default function TopBar({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { content } = useContent();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNav = (href: string) => {
    setOpen(false);
    onNavigate(href);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/85 backdrop-blur-md shadow-[0_1px_0_0_rgba(15,23,42,0.06)]"
          : "bg-white/0"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:h-18 sm:px-8">
        <button
          onClick={() => handleNav("#top")}
          className="flex items-center gap-2 text-river-700"
        >
          <RiverbendLogo className="h-7 w-7" />
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            {content.brand.name}
          </span>
        </button>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <button
              key={l.href}
              onClick={() => handleNav(l.href)}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-river-700"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button
            onClick={() => handleNav("#login")}
            className="text-sm font-medium text-slate-700 transition-colors hover:text-river-700"
          >
            Sign in
          </button>
          <button
            onClick={() => handleNav("#signup")}
            className="inline-flex items-center justify-center rounded-full bg-river-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-river-800 hover:shadow-md"
          >
            Get started
          </button>
        </div>

        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 md:hidden"
        >
          {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden ${
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        } overflow-hidden transition-all duration-300 ease-out`}
      >
        <div className="mx-3 mb-3 rounded-2xl border border-slate-100 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-col">
            {navLinks.map((l) => (
              <button
                key={l.href}
                onClick={() => handleNav(l.href)}
                className="rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {l.label}
              </button>
            ))}
            <div className="my-2 h-px bg-slate-100" />
            <button
              onClick={() => handleNav("#login")}
              className="rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign in
            </button>
            <button
              onClick={() => handleNav("#signup")}
              className="mt-1 inline-flex items-center justify-center rounded-xl bg-river-700 px-3 py-3 text-sm font-semibold text-white hover:bg-river-800"
            >
              Get started
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}