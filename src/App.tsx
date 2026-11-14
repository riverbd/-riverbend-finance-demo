import { useEffect, useState, type ReactNode } from "react";
import TopBar from "./components/TopBar";
import Hero from "./components/Hero";
import ContactPage from "./components/ContactPage";
import LoginPage from "./components/LoginPage";
import SignupPage from "./components/SignupPage";
import AboutPage from "./components/AboutPage";
import Footer from "./components/Footer";
import AdminLogin from "./admin/AdminLogin";
import AdminDashboard from "./admin/AdminDashboard";
import { useContent } from "./admin/store";
import { useAuth } from "./account/auth";
import AccountShell, { type DashPage } from "./account/AccountShell";
import Dashboard from "./account/Dashboard";
import Accounts from "./account/Accounts";
import Cards from "./account/Cards";
import Profile from "./account/Profile";
import SendPage from "./account/SendPage";
import MovePage from "./account/MovePage";

type PageId =
  | "home"
  | "contact"
  | "login"
  | "signup"
  | "about"
  | "admin"
  | "dashboard"
  | "accounts"
  | "cards"
  | "profile"
  | "send"
  | "move";

function parseHash(hash: string): PageId {
  const h = hash.replace("#", "");
  if (h === "contact" || h === "contact-page") return "contact";
  if (h === "login" || h === "login-page") return "login";
  if (h === "signup" || h === "signup-page" || h === "enroll") return "signup";
  if (h === "about" || h === "about-page") return "about";
  if (h === "admin") return "admin";
  if (h === "dashboard" || h === "") return "dashboard";
  if (h === "accounts") return "accounts";
  if (h === "cards") return "cards";
  if (h === "profile") return "profile";
  if (h === "send") return "send";
  if (h === "move") return "move";
  return "home";
}

export default function App() {
  const [page, setPage] = useState<PageId>(parseHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setPage(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (href: string) => {
    const id = href.replace("#", "");
    window.location.hash = id;
    setPage(parseHash(href));
    setTimeout(() => {
      if (id === "top" || id === "home" || id === "admin") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 30);
  };

  if (page === "admin") return <AdminGate />;

  if (
    page === "dashboard" ||
    page === "accounts" ||
    page === "cards" ||
    page === "profile" ||
    page === "send" ||
    page === "move"
  ) {
    return <AccountGate active={page} />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <TopBar onNavigate={navigate} />
      <main>
        {page === "home" && <Hero onNavigate={navigate} />}
        {page === "contact" && <ContactPage />}
        {page === "login" && <LoginPage />}
        {page === "signup" && <SignupPage />}
        {page === "about" && <AboutPage />}
      </main>
      <Footer />
    </div>
  );
}

function AdminGate(): ReactNode {
  const { isAdmin } = useContent();
  return isAdmin ? <AdminDashboard /> : <AdminLogin />;
}

function AccountGate({ active }: { active: PageId }): ReactNode {
  const { user, loading, error, signOut } = useAuth();
  const [dashPage, setDashPage] = useState<DashPage>(
    (active as DashPage) ?? "dashboard"
  );

  useEffect(() => {
    if (
      active === "dashboard" ||
      active === "accounts" ||
      active === "cards" ||
      active === "profile" ||
      active === "send" ||
      active === "move"
    ) {
      setDashPage(active as DashPage);
    }
  }, [active]);

  // While the saved session is being re-validated against Supabase, do not
  // bounce to the login screen — that would look like a random sign-out.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-river-200 border-t-river-700" />
          <p className="text-sm text-slate-500">Loading your accounts…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white text-slate-900 antialiased">
        <TopBar onNavigate={(h) => (window.location.hash = h.replace("#", ""))} />
        <main>
          {error && (
            <div className="mx-auto mt-6 max-w-md px-5">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
                <p className="font-semibold">We couldn't load your account</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          )}
          <LoginPage />
        </main>
        <Footer />
      </div>
    );
  }

  const go = (p: DashPage) => {
    setDashPage(p);
    window.location.hash = p;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSignOut = () => {
    signOut();
    window.location.hash = "top";
    window.location.reload();
  };

  return (
    <AccountShell active={dashPage} onNavigate={go} onSignOut={handleSignOut}>
      {dashPage === "dashboard" && <Dashboard onGoTo={go} />}
      {dashPage === "accounts" && <Accounts />}
      {dashPage === "cards" && <Cards />}
      {dashPage === "profile" && <Profile />}
      {dashPage === "send" && <SendPage />}
      {dashPage === "move" && <MovePage />}
    </AccountShell>
  );
}