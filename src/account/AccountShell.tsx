import type { ReactNode } from "react";
import { RiverbendLogo } from "../components/icons";
import {
  IconHome,
  IconAccounts,
  IconCards,
  IconProfile,
  IconLogout,
} from "./icons";

export type DashPage =
  | "dashboard"
  | "accounts"
  | "cards"
  | "profile"
  | "send"
  | "move";

const navItems: { id: DashPage; label: string; Icon: typeof IconHome }[] = [
  { id: "dashboard", label: "Home", Icon: IconHome },
  { id: "accounts", label: "Accounts", Icon: IconAccounts },
  { id: "cards", label: "Cards", Icon: IconCards },
  { id: "profile", label: "Profile", Icon: IconProfile },
];

export default function AccountShell({
  active,
  onNavigate,
  onSignOut,
  children,
}: {
  active: DashPage;
  onNavigate: (p: DashPage) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <div className="flex items-center gap-2 text-river-700">
            <RiverbendLogo className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              RIVERBEND
            </span>
          </div>
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            aria-label="Sign out"
          >
            <IconLogout className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5 pb-2">
          {navItems.map((it) => {
            const isActive = active === it.id;
            return (
              <button
                key={it.id}
                onClick={() => onNavigate(it.id)}
                className="flex flex-1 flex-col items-center gap-0.5 py-1.5"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                    isActive ? "bg-river-100 text-river-700" : "text-slate-500"
                  }`}
                >
                  <it.Icon className="h-5 w-5" />
                </span>
                <span
                  className={`text-[10px] font-medium ${
                    isActive ? "text-river-700" : "text-slate-500"
                  }`}
                >
                  {it.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}