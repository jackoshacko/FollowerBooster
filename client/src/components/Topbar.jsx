// client/src/components/Topbar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, setToken, setUser } from "../lib/api.js";
import { Menu, LogOut, Search, Plus, Wallet, Shield } from "lucide-react";
import { SidebarDrawer } from "./Sidebar.jsx";

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function isInApp(pathname) {
  return String(pathname || "").startsWith("/app");
}

function routeLabel(pathname) {
  const p = String(pathname || "");

  // ✅ new routing: /app/...
  if (p.startsWith("/app/dashboard")) return "Dashboard";
  if (p.startsWith("/app/services")) return "Services";
  if (p.startsWith("/app/create-order")) return "Create order";
  if (p.startsWith("/app/orders")) return "Orders";
  if (p.startsWith("/app/wallet")) return "Wallet";
  if (p.startsWith("/app/admin")) return "Admin";

  // ✅ public
  if (p === "/") return "Home";
  if (p.startsWith("/services")) return "Public Services";
  if (p.startsWith("/faq")) return "Help";
  if (p.startsWith("/contact")) return "Contact";
  if (p.startsWith("/terms")) return "Terms";
  if (p.startsWith("/privacy")) return "Privacy";
  if (p.startsWith("/refund")) return "Refunds";

  return "App";
}

function initialsFromMe(me) {
  const s = String(me?.email || me?.username || me?.name || "U").trim();
  const p = s.split(/[\s@._-]+/).filter(Boolean);
  const a = (p[0]?.[0] || "U").toUpperCase();
  const b = (p[1]?.[0] || "").toUpperCase();
  return (a + b).slice(0, 2);
}

function RolePill({ role }) {
  const isAdmin = String(role || "").toLowerCase() === "admin";
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        "backdrop-blur-xl",
        isAdmin
          ? "border-sky-500/25 bg-sky-500/10 text-sky-100"
          : "border-white/10 bg-white/5 text-zinc-200/70"
      )}
    >
      {isAdmin ? "ADMIN" : "CUSTOMER"}
    </span>
  );
}

export default function Topbar() {
  const nav = useNavigate();
  const loc = useLocation();
  const label = routeLabel(loc.pathname);

  const [sbOpen, setSbOpen] = useState(false);

  const [me, setMe] = useState(null);
  const isAdmin = String(me?.role || "").toLowerCase() === "admin";

  const [q, setQ] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);

  function hardLogout({ redirect = true } = {}) {
    setToken("");
    setUser(null);
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-changed"));

    // ✅ redirect to /login ONLY when inside /app
    const path = window.location.pathname || "/";
    if (redirect && isInApp(path)) nav("/login", { replace: true });
  }

  function logout() {
    hardLogout({ redirect: true });
  }

  // close drawer on route change
  useEffect(() => {
    setSbOpen(false);
  }, [loc.pathname]);

  // load me (SOFT on public, HARD only on /app)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("no token");

        const data = await api.get("/api/me");
        if (!alive) return;

        setMe(data || null);
        if (data?.role) localStorage.setItem("role", data.role);
      } catch {
        if (!alive) return;

        // ✅ Soft fail: just remove UI user info, DO NOT clear token here.
        setMe(null);

        // ✅ If you are inside /app and token is invalid → then logout + redirect
        const path = window.location.pathname || "/";
        if (isInApp(path)) {
          hardLogout({ redirect: true });
        }
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refresh me on auth-changed (never hardLogout here)
  useEffect(() => {
    let alive = true;

    const onAuthChanged = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("no token");
        const data = await api.get("/api/me");
        if (!alive) return;
        setMe(data || null);
        if (data?.role) localStorage.setItem("role", data.role);
      } catch {
        if (!alive) return;
        setMe(null);
      }
    };

    window.addEventListener("auth-changed", onAuthChanged);
    return () => {
      alive = false;
      window.removeEventListener("auth-changed", onAuthChanged);
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setSbOpen(false);
      const isK = e.key?.toLowerCase?.() === "k";
      const meta = e.metaKey || e.ctrlKey;
      if (meta && isK) {
        e.preventDefault();
        setFocusSearch(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!focusSearch) return;
    const el = document.getElementById("topbar-search");
    if (el) el.focus();
    setFocusSearch(false);
  }, [focusSearch]);

  const userLabel = useMemo(
    () => me?.email || me?.username || me?.name || "User",
    [me]
  );
  const initials = useMemo(() => initialsFromMe(me), [me]);

  function go(pathInApp, fallbackPublic = "/") {
    // If you are in /app → go inside /app; if you are on public → keep it public
    const cur = window.location.pathname || "/";
    if (isInApp(cur)) return nav(pathInApp);
    return nav(fallbackPublic);
  }

  function onSubmitSearch(e) {
    e.preventDefault();
    const s = q.trim().toLowerCase();
    if (!s) return;

    // ✅ if you’re in app, search routes go to /app/...
    const cur = window.location.pathname || "/";
    const inApp = isInApp(cur);

    const to = (appPath, publicPath) => (inApp ? appPath : publicPath);

    if (s.startsWith("wal")) return nav(to("/app/wallet", "/login"));
    if (s.startsWith("ord")) return nav(to("/app/orders", "/login"));
    if (s.startsWith("ser")) return nav(to("/app/services", "/services"));
    if (s.startsWith("cre") || s.startsWith("buy"))
      return nav(to("/app/create-order", "/login"));
    if (s.startsWith("dash")) return nav(to("/app/dashboard", "/login"));
    if (s.startsWith("adm") && isAdmin) return nav("/app/admin/dashboard");
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full overflow-x-clip">
        <div className="border-b border-white/10 bg-black/35 backdrop-blur-xl">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="h-px w-full bg-gradient-to-r from-transparent via-purple-300/20 to-transparent" />

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-purple-500/14 blur-3xl" />
            <div className="absolute right-[-120px] top-[-40px] h-72 w-72 rounded-full bg-cyan-500/12 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(900px_120px_at_20%_0%,rgba(255,255,255,0.10),transparent_65%)]" />
          </div>

          <div className="px-4 md:px-6 pt-[env(safe-area-inset-top)]">
            <div className="relative z-10 flex h-16 items-center justify-between min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSbOpen(true)}
                  className={cn(
                    "md:hidden inline-flex items-center justify-center rounded-2xl p-2",
                    "border border-white/10 bg-white/5 text-zinc-100/90 backdrop-blur-xl",
                    "hover:bg-white/10 transition active:scale-[0.98]"
                  )}
                  title="Menu"
                  type="button"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <button
                  onClick={() => go("/app/dashboard", "/")}
                  className="flex items-center gap-3 min-w-0"
                  title="Home / Dashboard"
                  type="button"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_18px_55px_rgba(168,85,247,0.12)] shrink-0">
                    <span className="text-xs font-black tracking-tight text-white">FB</span>
                  </div>

                  <div className="leading-tight min-w-0">
                    <div className="text-sm font-extrabold tracking-tight text-white truncate">
                      FollowerBooster
                    </div>
                    <div className="text-[11px] text-zinc-300/70 truncate">
                      Premium panel • wallet-ready
                    </div>
                  </div>
                </button>

                <div className="hidden sm:block h-9 w-px bg-white/10 shrink-0" />

                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-100",
                      "shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                    )}
                  >
                    {label}
                  </span>

                  {isAdmin ? (
                    <span
                      className={cn(
                        "rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-100",
                        "shadow-[0_0_0_1px_rgba(14,165,233,0.10)]"
                      )}
                      title="Admin mode"
                    >
                      <Shield className="inline-block h-3.5 w-3.5 -mt-[1px] mr-1" />
                      Admin
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="hidden lg:block w-[520px] max-w-[38vw]">
                <form onSubmit={onSubmitSearch} className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300/60" />
                  <input
                    id="topbar-search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search… (Ctrl/⌘ K)   e.g. wallet, orders, services"
                    className={cn(
                      "w-full rounded-2xl border border-white/10 bg-white/5 px-10 py-2 text-sm text-zinc-100",
                      "placeholder:text-zinc-300/40 backdrop-blur-xl outline-none",
                      "focus:border-white/18 focus:bg-white/7"
                    )}
                  />
                  <span
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2",
                      "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-200/55"
                    )}
                  >
                    ⌘K
                  </span>
                </form>
              </div>

              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                <div className="hidden md:flex items-center gap-2">
                  <button
                    onClick={() => nav("/app/wallet")}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                      "border border-white/10 bg-white/5 hover:bg-white/10 text-white/90",
                      "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_16px_40px_rgba(168,85,247,0.18)]",
                      "active:scale-[0.99] transition"
                    )}
                    title="Wallet"
                    type="button"
                  >
                    <Wallet className="h-4 w-4" />
                    Wallet
                  </button>

                  <button
                    onClick={() => nav("/app/create-order")}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                      "border border-white/10 bg-white/10 hover:bg-white/15 text-white",
                      "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_16px_40px_rgba(34,211,238,0.16)]",
                      "active:scale-[0.99] transition"
                    )}
                    title="Create order"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Create
                  </button>
                </div>

                <div
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border border-white/10",
                    "bg-white/5 px-3 py-2 backdrop-blur-xl",
                    "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_70px_rgba(168,85,247,0.10)]"
                  )}
                  title={userLabel}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-xs font-black text-white">
                    {initials}
                  </div>

                  <div className="hidden md:block leading-tight max-w-[180px]">
                    <div className="text-xs font-semibold text-zinc-100 truncate">
                      {userLabel}
                    </div>
                    <div className="mt-0.5">
                      <RolePill role={me?.role} />
                    </div>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-3 md:px-4 py-2 text-sm font-semibold text-white",
                    "border border-white/10 bg-white/5 hover:bg-white/10",
                    "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_16px_40px_rgba(168,85,247,0.25)]",
                    "active:scale-[0.99] transition"
                  )}
                  title="Logout"
                  type="button"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>

            <div className="lg:hidden pb-3">
              <div
                className={cn(
                  "flex items-center gap-2",
                  "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl",
                  "px-3 py-2 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_70px_rgba(168,85,247,0.10)]"
                )}
              >
                <button
                  onClick={() => nav("/app/wallet")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                    "border border-white/10 bg-white/5 hover:bg-white/10 text-white/90",
                    "active:scale-[0.99] transition"
                  )}
                  type="button"
                >
                  <Wallet className="h-4 w-4" />
                  Wallet
                </button>

                <button
                  onClick={() => nav("/app/create-order")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                    "border border-white/10 bg-white/10 hover:bg-white/15 text-white",
                    "active:scale-[0.99] transition"
                  )}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  Create
                </button>

                <form onSubmit={onSubmitSearch} className="relative flex-1 min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300/60" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search… (wallet, orders, services)"
                    className={cn(
                      "w-full rounded-2xl border border-white/10 bg-white/5 px-10 py-2 text-sm text-zinc-100",
                      "placeholder:text-zinc-300/40 backdrop-blur-xl outline-none",
                      "focus:border-white/18 focus:bg-white/7"
                    )}
                  />
                </form>
              </div>
            </div>
          </div>
        </div>
      </header>

      <SidebarDrawer open={sbOpen} onClose={() => setSbOpen(false)} />
    </>
  );
}
