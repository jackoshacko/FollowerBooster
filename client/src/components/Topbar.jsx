// client/src/components/Topbar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, setToken, setUser } from "../lib/api.js";
import { Menu, X, LogOut, Search, Plus, Wallet, Shield } from "lucide-react";
import Sidebar from "./Sidebar.jsx";

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function routeLabel(pathname) {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/services")) return "Services";
  if (pathname.startsWith("/create-order")) return "Create order";
  if (pathname.startsWith("/orders")) return "Orders";
  if (pathname.startsWith("/wallet")) return "Wallet";
  if (pathname.startsWith("/admin")) return "Admin";
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

  const [open, setOpen] = useState(false);

  // session
  const [me, setMe] = useState(null);
  const isAdmin = String(me?.role || "").toLowerCase() === "admin";

  // quick search
  const [q, setQ] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);

  function logout() {
    setToken("");
    setUser(null);
    nav("/login");
  }

  // close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  // body scroll lock when drawer open (mobile UX)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // load ME once (Topbar uses it for chip; Sidebar also fetches, but this is light)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.get("/auth/me");
        if (!alive) return;
        setMe(data || null);
      } catch {
        if (!alive) return;
        setMe(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // keyboard shortcuts: ESC closes, Ctrl/Cmd+K focuses search
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);

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

  // focus handling (tiny trick so we can focus after render)
  useEffect(() => {
    if (!focusSearch) return;
    const el = document.getElementById("topbar-search");
    if (el) el.focus();
    setFocusSearch(false);
  }, [focusSearch]);

  const userLabel = useMemo(() => {
    return me?.email || me?.username || me?.name || "User";
  }, [me]);

  const initials = useMemo(() => initialsFromMe(me), [me]);

  // simple client-side "command palette" behavior: route jump by typing
  function onSubmitSearch(e) {
    e.preventDefault();
    const s = q.trim().toLowerCase();
    if (!s) return;

    // quick routing
    if (s.startsWith("wal")) return nav("/wallet");
    if (s.startsWith("ord")) return nav("/orders");
    if (s.startsWith("ser")) return nav("/services");
    if (s.startsWith("cre") || s.startsWith("buy")) return nav("/create-order");
    if (s.startsWith("dash")) return nav("/dashboard");
    if (s.startsWith("adm") && isAdmin) return nav("/admin/dashboard");
  }

  return (
    <>
      <header className="sticky top-0 z-30">
        {/* GLASS BAR */}
        <div className="border-b border-white/10 bg-black/35 backdrop-blur-xl">
          {/* subtle highlight lines */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="h-px w-full bg-gradient-to-r from-transparent via-purple-300/20 to-transparent" />

          <div
            className={cn(
              "relative flex h-16 items-center justify-between px-4 md:px-6",
              // iOS safe-area
              "pt-[env(safe-area-inset-top)]"
            )}
          >
            {/* ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="glow-orb absolute -left-24 -top-24 h-64 w-64 rounded-full bg-purple-500/14 blur-3xl" />
              <div className="glow-orb2 absolute right-[-120px] top-[-40px] h-72 w-72 rounded-full bg-cyan-500/12 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(900px_120px_at_20%_0%,rgba(255,255,255,0.10),transparent_65%)]" />
            </div>

            {/* LEFT: burger + brand + route */}
            <div className="relative z-10 flex items-center gap-3 min-w-0">
              {/* MOBILE BURGER */}
              <button
                onClick={() => setOpen(true)}
                className={cn(
                  "md:hidden inline-flex items-center justify-center rounded-2xl p-2",
                  "border border-white/10 bg-white/5 text-zinc-100/85 backdrop-blur-xl",
                  "hover:bg-white/10 transition active:scale-[0.98]"
                )}
                title="Menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Brand */}
              <button
                onClick={() => nav("/dashboard")}
                className="flex items-center gap-3 min-w-0"
                title="Go to Dashboard"
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

              {/* Divider */}
              <div className="hidden sm:block h-9 w-px bg-white/10 shrink-0" />

              {/* Route badge */}
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

            {/* CENTER: search (desktop only) */}
            <div className="relative z-10 hidden lg:block w-[520px] max-w-[38vw]">
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

            {/* RIGHT: quick actions + user chip + logout */}
            <div className="relative z-10 flex items-center gap-2 md:gap-3 shrink-0">
              {/* quick actions (desktop) */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => nav("/wallet")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                    "border border-white/10 bg-white/5 hover:bg-white/10 text-white/90",
                    "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_16px_40px_rgba(168,85,247,0.18)]",
                    "active:scale-[0.99] transition"
                  )}
                  title="Wallet"
                >
                  <Wallet className="h-4 w-4" />
                  Wallet
                </button>

                <button
                  onClick={() => nav("/create-order")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                    "border border-white/10 bg-white/10 hover:bg-white/15 text-white",
                    "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_16px_40px_rgba(34,211,238,0.16)]",
                    "active:scale-[0.99] transition"
                  )}
                  title="Create order"
                >
                  <Plus className="h-4 w-4" />
                  Create
                </button>
              </div>

              {/* User chip */}
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
                  <div className="text-xs font-semibold text-zinc-100 truncate">{userLabel}</div>
                  <div className="mt-0.5">
                    <RolePill role={me?.role} />
                  </div>
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={logout}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl px-3 md:px-4 py-2 text-sm font-semibold text-white",
                  "border border-white/10 bg-white/5 hover:bg-white/10",
                  "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_16px_40px_rgba(168,85,247,0.25)]",
                  "active:scale-[0.99] transition"
                )}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          {/* panel */}
          <div className="absolute left-0 top-0 h-full w-[88%] max-w-[380px]">
            {/* close btn */}
            <div className="absolute right-3 top-3 z-50">
              <button
                onClick={() => setOpen(false)}
                className={cn(
                  "inline-flex items-center justify-center rounded-2xl p-2",
                  "border border-white/10 bg-white/5 text-zinc-100/85 backdrop-blur-xl",
                  "hover:bg-white/10 transition active:scale-[0.98]"
                )}
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* sidebar */}
            <Sidebar mobile onClose={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
