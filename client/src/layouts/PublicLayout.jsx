// client/src/layouts/PublicLayout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import CookieNotice from "../components/CookieNotice.jsx";
import bgSmm from "../assets/backgroundsmm.jpg";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;

    const body = document.body;
    const html = document.documentElement;

    const prevOverflow = body.style.overflow;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevLeft = body.style.left;
    const prevRight = body.style.right;
    const prevWidth = body.style.width;

    // lock (prevents iOS bounce too)
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    body.dataset.scrollY = String(scrollY);

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    html.style.overscrollBehavior = "none";

    return () => {
      // unlock
      const y = Number(body.dataset.scrollY || "0");

      body.style.overflow = prevOverflow;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.left = prevLeft;
      body.style.right = prevRight;
      body.style.width = prevWidth;
      html.style.overscrollBehavior = "";

      body.dataset.scrollY = "";
      window.scrollTo(0, y);
    };
  }, [locked]);
}

function NavBtn({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cls(
          "rounded-2xl px-3 py-2 text-sm font-semibold",
          "border border-white/10 bg-white/5 text-white/90",
          "hover:bg-white/10 hover:border-white/20",
          "active:scale-[0.99] transition",
          isActive && "bg-white/10 border-white/20"
        )
      }
    >
      {children}
    </NavLink>
  );
}

function PrimaryBtn({ to, children }) {
  return (
    <NavLink
      to={to}
      className={cls(
        "rounded-2xl px-3 py-2 text-sm font-semibold",
        "bg-white text-zinc-900 hover:bg-zinc-200",
        "active:scale-[0.99] transition"
      )}
    >
      {children}
    </NavLink>
  );
}

export default function PublicLayout() {
  const nav = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  useBodyScrollLock(mobileOpen);

  // zatvori drawer kad promeniš rutu
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // reset ako je nekad ostao body lock (staro stanje)
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

  const isGlassBar = useMemo(
    () =>
      cls(
        "border-b border-white/10",
        "bg-black/45 backdrop-blur-xl",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_60px_rgba(0,0,0,0.35)]"
      ),
    []
  );

  return (
    <div className="h-[100dvh] w-full bg-zinc-950 text-zinc-100 overflow-hidden">
      <div className="relative h-full w-full isolate">
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

        {/* ✅ SHELL: header fixed, only content scrolls */}
        <div className="relative z-10 h-full flex flex-col min-w-0">
          {/* TOPBAR */}
          <header className="shrink-0">
            <div className={isGlassBar}>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <div className="px-4 md:px-6 pt-[env(safe-area-inset-top)]">
                <div className="flex h-16 items-center justify-between min-w-0 gap-3">
                  {/* LEFT: BRAND */}
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

                  {/* RIGHT: DESKTOP NAV */}
                  <nav className="hidden md:flex items-center gap-2 shrink-0">
                    <NavBtn to="/services">Services</NavBtn>
                    <NavBtn to="/faq">Help</NavBtn>
                    <NavBtn to="/login">Sign in</NavBtn>
                    <PrimaryBtn to="/register">Create account</PrimaryBtn>
                  </nav>

                  {/* MOBILE: CTA + BURGER */}
                  <div className="md:hidden flex items-center gap-2 shrink-0">
                    <NavLink
                      to="/login"
                      className={cls(
                        "rounded-2xl px-3 py-2 text-sm font-semibold",
                        "border border-white/10 bg-white/5 text-white/90",
                        "hover:bg-white/10 hover:border-white/20 transition"
                      )}
                    >
                      Sign in
                    </NavLink>

                    <button
                      onClick={() => setMobileOpen(true)}
                      className={cls(
                        "rounded-2xl px-3 py-2 text-sm font-semibold",
                        "border border-white/10 bg-white/5 text-white/90",
                        "hover:bg-white/10 hover:border-white/20 transition",
                        "active:scale-[0.99]"
                      )}
                      aria-label="Open menu"
                      title="Menu"
                    >
                      ☰
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MOBILE DRAWER */}
            {mobileOpen ? (
              <div className="fixed inset-0 z-[999] md:hidden">
                <div
                  className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                  onClick={() => setMobileOpen(false)}
                />
                <div
                  className={cls(
                    "absolute right-0 top-0 h-full w-[86%] max-w-[360px]",
                    "border-l border-white/10 bg-zinc-950/92 backdrop-blur-2xl",
                    "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_120px_rgba(0,0,0,0.65)]"
                  )}
                >
                  <div className="pt-[env(safe-area-inset-top)]" />
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold tracking-tight text-white">
                        Menu
                      </div>
                      <button
                        onClick={() => setMobileOpen(false)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 hover:border-white/20 transition"
                        aria-label="Close menu"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-4 grid gap-2">
                      <NavLink
                        to="/services"
                        className={({ isActive }) =>
                          cls(
                            "rounded-2xl px-4 py-3 text-sm font-semibold",
                            "border border-white/10 bg-white/5 text-white/90",
                            "hover:bg-white/10 hover:border-white/20 transition",
                            isActive && "bg-white/10 border-white/20"
                          )
                        }
                      >
                        Services
                      </NavLink>

                      <NavLink
                        to="/faq"
                        className={({ isActive }) =>
                          cls(
                            "rounded-2xl px-4 py-3 text-sm font-semibold",
                            "border border-white/10 bg-white/5 text-white/90",
                            "hover:bg-white/10 hover:border-white/20 transition",
                            isActive && "bg-white/10 border-white/20"
                          )
                        }
                      >
                        Help
                      </NavLink>

                      <NavLink
                        to="/login"
                        className={({ isActive }) =>
                          cls(
                            "rounded-2xl px-4 py-3 text-sm font-semibold",
                            "border border-white/10 bg-white/5 text-white/90",
                            "hover:bg-white/10 hover:border-white/20 transition",
                            isActive && "bg-white/10 border-white/20"
                          )
                        }
                      >
                        Sign in
                      </NavLink>

                      <NavLink
                        to="/register"
                        className={cls(
                          "rounded-2xl px-4 py-3 text-sm font-semibold",
                          "bg-white text-zinc-900 hover:bg-zinc-200 transition",
                          "active:scale-[0.99]"
                        )}
                      >
                        Create account
                      </NavLink>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-200/70">
                      Guest mode: browse services publicly. Create an account to order.
                    </div>
                  </div>

                  <div className="pb-[env(safe-area-inset-bottom)]" />
                </div>
              </div>
            ) : null}
          </header>

          {/* ✅ ONLY THIS SCROLLS */}
          <div
            className="flex-1 overflow-y-auto overscroll-y-contain"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <main
              className={cls(
                "mx-auto w-full max-w-[1200px] 2xl:max-w-[1400px]",
                "px-4 py-6 md:px-6 md:py-10",
                "pb-[calc(env(safe-area-inset-bottom)+120px)]"
              )}
            >
              <Outlet />
            </main>

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

            <CookieNotice />
          </div>
        </div>
      </div>
    </div>
  );
}
