// client/src/layouts/PublicLayout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import CookieNotice from "../components/CookieNotice.jsx";
import bgSmm from "../assets/backgroundsmm.jpg";
import { api, getToken, clearAuthLocal, setToken, setUser, setRole } from "../lib/api.js";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

/** iOS-safe body lock (keeps scroll pos) */
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

function NavBtn({ to, children, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
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

function PrimaryBtn({ to, children, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
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

function Chip({ children }) {
  return (
    <span
      className={cls(
        "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
        "border border-white/10 bg-white/5 text-white/90 backdrop-blur-xl",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
      )}
    >
      {children}
    </span>
  );
}

export default function PublicLayout() {
  const nav = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  useBodyScrollLock(mobileOpen);

  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(true);

  // close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // cleanup any stale body lock
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

  // ✅ Auth-aware on PUBLIC: if token exists -> try /api/me
  // IMPORTANT: if it fails with 401 here, DO NOT clear token (public pages must not "log you out")
  useEffect(() => {
    let alive = true;
    (async () => {
      setChecking(true);
      try {
        const t = getToken();
        if (!t) {
          if (!alive) return;
          setMe(null);
          return;
        }
        const data = await api.get("/api/me");
        if (!alive) return;
        setMe(data || null);
        if (data?.role) setRole(data.role);
      } catch (e) {
        // Keep it soft on public pages.
        if (!alive) return;
        setMe(null);
      } finally {
        if (!alive) return;
        setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // update auth state if something changes (login/logout callback)
  useEffect(() => {
    let alive = true;
    const onAuth = async () => {
      try {
        const t = getToken();
        if (!t) {
          if (!alive) return;
          setMe(null);
          return;
        }
        const data = await api.get("/api/me");
        if (!alive) return;
        setMe(data || null);
        if (data?.role) setRole(data.role);
      } catch {
        if (!alive) return;
        setMe(null);
      }
    };
    window.addEventListener("auth-changed", onAuth);
    return () => {
      alive = false;
      window.removeEventListener("auth-changed", onAuth);
    };
  }, []);

  const authed = !!getToken() && !!me;
  const userLabel = useMemo(() => me?.email || me?.username || me?.name || "", [me]);

  function logout() {
    // Public logout should be real logout
    clearAuthLocal();
    setToken("");
    setUser(null);
    setRole("");
    setMe(null);
    window.dispatchEvent(new Event("auth-changed"));
    nav("/login", { replace: true });
  }

  // Optional: if user is authed and clicks "Services" on public, jump into /app/services
  function goServices() {
    if (authed) nav("/app/services");
    else nav("/services");
  }
  function goHelp() {
    nav("/faq");
  }

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

        {/* SHELL */}
        <div className="relative z-10 h-full flex flex-col min-w-0">
          {/* TOPBAR */}
          <header className="shrink-0">
            <div className={isGlassBar}>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <div className="px-4 md:px-6 pt-[env(safe-area-inset-top)]">
                <div className="flex h-16 items-center justify-between min-w-0 gap-3">
                  {/* BRAND */}
                  <button
                    onClick={() => nav("/")}
                    className="flex items-center gap-3 min-w-0"
                    title="Home"
                    type="button"
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

                  {/* DESKTOP NAV */}
                  <nav className="hidden md:flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={goServices}
                      className={cls(
                        "rounded-2xl px-3 py-2 text-sm font-semibold",
                        "border border-white/10 bg-white/5 text-white/90",
                        "hover:bg-white/10 hover:border-white/20",
                        "active:scale-[0.99] transition"
                      )}
                    >
                      Services
                    </button>

                    <NavBtn to="/faq" onClick={goHelp}>
                      Help
                    </NavBtn>

                    {authed ? (
                      <>
                        <Chip>{checking ? "Checking…" : userLabel || "Authenticated"}</Chip>
                        <NavBtn to="/app/dashboard">Open App</NavBtn>
                        <button
                          type="button"
                          onClick={logout}
                          className={cls(
                            "rounded-2xl px-3 py-2 text-sm font-semibold",
                            "border border-white/10 bg-white/5 text-white/90",
                            "hover:bg-white/10 hover:border-white/20",
                            "active:scale-[0.99] transition"
                          )}
                        >
                          Logout
                        </button>
                      </>
                    ) : (
                      <>
                        <NavBtn to="/login">Sign in</NavBtn>
                        <PrimaryBtn to="/register">Create account</PrimaryBtn>
                      </>
                    )}
                  </nav>

                  {/* MOBILE */}
                  <div className="md:hidden flex items-center gap-2 shrink-0">
                    {authed ? (
                      <button
                        onClick={() => nav("/app/dashboard")}
                        className={cls(
                          "rounded-2xl px-3 py-2 text-sm font-semibold",
                          "border border-white/10 bg-white/5 text-white/90",
                          "hover:bg-white/10 hover:border-white/20 transition"
                        )}
                        type="button"
                      >
                        Open App
                      </button>
                    ) : (
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
                    )}

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
                      type="button"
                    >
                      ☰
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ MOBILE DRAWER (scrollable) */}
            {mobileOpen ? (
              <div className="fixed inset-0 z-[999] md:hidden">
                <div
                  className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                  onClick={() => setMobileOpen(false)}
                />

                <div
                  className={cls(
                    "absolute right-0 top-0 h-[100dvh] w-[86%] max-w-[360px]",
                    "border-l border-white/10 bg-zinc-950/92 backdrop-blur-2xl",
                    "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_120px_rgba(0,0,0,0.65)]",
                    "overflow-y-auto overscroll-contain"
                  )}
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <div className="pt-[env(safe-area-inset-top)]" />

                  <div className="p-4 pb-[calc(env(safe-area-inset-bottom)+18px)]">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold tracking-tight text-white">
                        Menu
                      </div>
                      <button
                        onClick={() => setMobileOpen(false)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 hover:border-white/20 transition"
                        aria-label="Close menu"
                        type="button"
                      >
                        ✕
                      </button>
                    </div>

                    {authed ? (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-200/70">
                        Logged in as <span className="text-white/90 font-semibold">{userLabel}</span>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-200/70">
                        Guest mode: browse services publicly. Create an account to order.
                      </div>
                    )}

                    <div className="mt-4 grid gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileOpen(false);
                          goServices();
                        }}
                        className={cls(
                          "w-full text-left rounded-2xl px-4 py-3 text-sm font-semibold",
                          "border border-white/10 bg-white/5 text-white/90",
                          "hover:bg-white/10 hover:border-white/20 transition"
                        )}
                      >
                        Services
                      </button>

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
                        onClick={() => setMobileOpen(false)}
                      >
                        Help / FAQ
                      </NavLink>

                      {authed ? (
                        <>
                          <NavLink
                            to="/app/dashboard"
                            className={cls(
                              "rounded-2xl px-4 py-3 text-sm font-semibold",
                              "border border-white/10 bg-white/10 text-white",
                              "hover:bg-white/15 transition",
                              "active:scale-[0.99]"
                            )}
                            onClick={() => setMobileOpen(false)}
                          >
                            Open App
                          </NavLink>

                          <button
                            type="button"
                            onClick={() => {
                              setMobileOpen(false);
                              logout();
                            }}
                            className={cls(
                              "rounded-2xl px-4 py-3 text-sm font-semibold",
                              "border border-white/10 bg-white/5 text-white/90",
                              "hover:bg-white/10 hover:border-white/20 transition"
                            )}
                          >
                            Logout
                          </button>
                        </>
                      ) : (
                        <>
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
                            onClick={() => setMobileOpen(false)}
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
                            onClick={() => setMobileOpen(false)}
                          >
                            Create account
                          </NavLink>
                        </>
                      )}

                      <div className="mt-2 h-px w-full bg-white/10" />

                      <NavLink
                        to="/terms"
                        className="rounded-2xl px-4 py-3 text-sm font-semibold border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 hover:border-white/20 transition"
                        onClick={() => setMobileOpen(false)}
                      >
                        Terms
                      </NavLink>
                      <NavLink
                        to="/privacy"
                        className="rounded-2xl px-4 py-3 text-sm font-semibold border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 hover:border-white/20 transition"
                        onClick={() => setMobileOpen(false)}
                      >
                        Privacy
                      </NavLink>
                      <NavLink
                        to="/refund"
                        className="rounded-2xl px-4 py-3 text-sm font-semibold border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 hover:border-white/20 transition"
                        onClick={() => setMobileOpen(false)}
                      >
                        Refunds
                      </NavLink>
                      <NavLink
                        to="/contact"
                        className="rounded-2xl px-4 py-3 text-sm font-semibold border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 hover:border-white/20 transition"
                        onClick={() => setMobileOpen(false)}
                      >
                        Contact
                      </NavLink>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </header>

          {/* ONLY CONTENT SCROLLS */}
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
