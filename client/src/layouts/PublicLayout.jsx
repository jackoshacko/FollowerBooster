// client/src/layouts/PublicLayout.jsx
import React, { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import CookieNotice from "../components/CookieNotice.jsx";
import bgSmm from "../assets/backgroundsmm.jpg";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

const HEADER_H = 64; // h-16

export default function PublicLayout() {
  const nav = useNavigate();

  // hard reset: ako je nekad ostao body lock (drawer/modal) iz app-a
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    body.style.overflow = "";
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    html.style.overscrollBehavior = "";

    if (body.dataset) body.dataset.scrollY = "";
  }, []);

  return (
    <div className="min-h-[100dvh] w-full bg-zinc-950 text-zinc-100">
      {/* ✅ IMPORTANT: do NOT put overflow-x-clip on parents of fixed header */}
      <div className="relative min-h-[100dvh] w-full isolate">
        {/* BACKGROUND */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-zinc-950" />
          <div
            className="absolute inset-0 bg-cover bg-center opacity-100"
            style={{ backgroundImage: `url(${bgSmm})` }}
          />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/35 to-black/80" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50" />
          <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-500/15 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
        </div>

        {/* ✅ FIXED TOPBAR (iOS safe) */}
        <header
          className="fixed inset-x-0 top-0 z-[9999]"
          style={{
            WebkitTransform: "translate3d(0,0,0)", // helps some iOS cases
            transform: "translate3d(0,0,0)",
          }}
        >
          <div className="border-b border-white/10 bg-black/50">
            {/* ✅ keep blur on inner layer, not the header wrapper */}
            <div className="backdrop-blur-xl">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="px-4 md:px-6 pt-[env(safe-area-inset-top)]">
                <div className="flex h-16 items-center justify-between min-w-0">
                  <button
                    onClick={() => nav("/")}
                    className="flex items-center gap-3 min-w-0"
                    title="Home"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_18px_55px_rgba(168,85,247,0.12)] shrink-0">
                      <span className="text-xs font-black tracking-tight text-white">FB</span>
                    </div>

                    <div className="leading-tight min-w-0 text-left">
                      <div className="text-sm font-extrabold tracking-tight text-white truncate">
                        FollowerBooster
                      </div>
                      <div className="text-[11px] text-zinc-300/70 truncate">
                        Premium panel • public access
                      </div>
                    </div>
                  </button>

                  <nav className="flex items-center gap-2 shrink-0">
                    {/* ✅ Services beside Sign in */}
                    <NavLink
                      to="/services"
                      className={({ isActive }) =>
                        cls(
                          "rounded-2xl px-3 py-2 text-sm font-semibold",
                          "border border-white/10 bg-white/5 hover:bg-white/10 text-white/90",
                          "active:scale-[0.99] transition",
                          isActive && "bg-white/10"
                        )
                      }
                    >
                      Services
                    </NavLink>

                    <NavLink
                      to="/faq"
                      className={({ isActive }) =>
                        cls(
                          "rounded-2xl px-3 py-2 text-sm font-semibold",
                          "border border-white/10 bg-white/5 hover:bg-white/10 text-white/90",
                          "active:scale-[0.99] transition",
                          isActive && "bg-white/10"
                        )
                      }
                    >
                      Help
                    </NavLink>

                    <NavLink
                      to="/login"
                      className={({ isActive }) =>
                        cls(
                          "rounded-2xl px-3 py-2 text-sm font-semibold",
                          "border border-white/10 bg-white/5 hover:bg-white/10 text-white/90",
                          "active:scale-[0.99] transition",
                          isActive && "bg-white/10"
                        )
                      }
                    >
                      Sign in
                    </NavLink>

                    <NavLink
                      to="/register"
                      className={cls(
                        "rounded-2xl px-3 py-2 text-sm font-semibold",
                        "bg-white text-zinc-900 hover:bg-zinc-200",
                        "active:scale-[0.99] transition"
                      )}
                    >
                      Create account
                    </NavLink>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ✅ spacer for fixed header (safe-area + 64px) */}
        <div style={{ height: `calc(env(safe-area-inset-top) + ${HEADER_H}px)` }} />

        {/* CONTENT */}
        <div className="relative z-10">
          <main
            className={cls(
              "mx-auto w-full max-w-[1200px] 2xl:max-w-[1400px]",
              "px-4 py-6 md:px-6 md:py-10",
              "pb-[calc(env(safe-area-inset-bottom)+120px)]"
            )}
          >
            <Outlet />
          </main>

          {/* FOOTER */}
          <footer className="border-t border-white/10 bg-black/25 backdrop-blur-xl">
            <div className="mx-auto max-w-[1200px] 2xl:max-w-[1400px] px-4 md:px-6 py-6 text-sm text-zinc-300/70 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>© {new Date().getFullYear()} FollowerBooster</div>
              <div className="flex flex-wrap gap-4">
                <NavLink className="hover:text-white" to="/terms">
                  Terms
                </NavLink>
                <NavLink className="hover:text-white" to="/privacy">
                  Privacy
                </NavLink>
                <NavLink className="hover:text-white" to="/refund">
                  Refunds
                </NavLink>
                <NavLink className="hover:text-white" to="/contact">
                  Contact
                </NavLink>
              </div>
            </div>
          </footer>
        </div>

        <CookieNotice />
      </div>
    </div>
  );
}
