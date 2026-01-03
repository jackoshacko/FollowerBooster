// client/src/pages/Login.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, apiUrl, clearAuthLocal, setToken } from "../lib/api.js";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

function getNextFromLocation(loc) {
  const qs = new URLSearchParams(loc?.search || "");
  return qs.get("next") || loc?.state?.from?.pathname || "";
}

function isValidEmail(v) {
  const s = String(v || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "border-white/10 bg-white/5 text-zinc-100/85",
    info: "border-sky-500/25 bg-sky-500/10 text-sky-100",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-100",
    ok: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  };
  return (
    <span
      className={cls(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-xl",
        tones[tone] || tones.neutral
      )}
    >
      {children}
    </span>
  );
}

function Field({ label, right, children }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-zinc-200/70">{label}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Feature({ title, desc }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs text-zinc-200/70">{desc}</div>
    </div>
  );
}

const inputCls = cls(
  "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white",
  "placeholder:text-zinc-300/40 backdrop-blur-xl outline-none transition",
  "focus:border-white/20 focus:bg-white/10"
);

/* =======================
   Cloudflare Turnstile
======================= */

// ✅ stavi tvoj SITE KEY ovde
const TURNSTILE_SITE_KEY = "0x4AAAAAAACkWeLnKEIxFJtcP";

// optional: add script if nije već u index.html
function ensureTurnstileScript() {
  if (typeof window === "undefined") return;
  if (window.turnstile) return;

  const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
  if (existing) return;

  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const next = useMemo(() => getNextFromLocation(loc), [loc]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [capsOn, setCapsOn] = useState(false);

  // ✅ Turnstile token + widget id (za reset)
  const [tsToken, setTsToken] = useState("");
  const [tsWidgetId, setTsWidgetId] = useState(null);

  useEffect(() => {
    if (!password) setCapsOn(false);
  }, [password]);

  // ✅ mount Turnstile (explicit render) kad se script učita
  useEffect(() => {
    ensureTurnstileScript();

    let tries = 0;
    let cancelled = false;

    const mount = () => {
      if (cancelled) return;

      const el = document.getElementById("cf-turnstile-login");
      if (!el) return;

      if (!window.turnstile || typeof window.turnstile.render !== "function") {
        tries += 1;
        if (tries < 120) setTimeout(mount, 100); // čekaj do ~12s
        return;
      }

      // ako je već renderovan, ne renderuj opet
      if (tsWidgetId != null) return;

      const wid = window.turnstile.render("#cf-turnstile-login", {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => {
          setTsToken(String(token || ""));
        },
        "expired-callback": () => {
          setTsToken("");
        },
        "error-callback": () => {
          setTsToken("");
        },
        // theme: "dark", // optional
      });

      setTsWidgetId(wid);
    };

    mount();

    return () => {
      cancelled = true;
      // ne radimo remove widget-a ovde da ne bug-uje na route transitions
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tsWidgetId]);

  async function submit(e) {
    e.preventDefault();
    setErr("");

    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) return setErr("Please enter your email.");
    if (!isValidEmail(normalizedEmail))
      return setErr("Please enter a valid email address (example: you@example.com).");
    if (!password) return setErr("Please enter your password.");

    // ✅ Turnstile check
    if (!tsToken) {
      return setErr("Please verify you are human (Turnstile).");
    }

    setLoading(true);

    try {
      // ✅ šaljemo turnstileToken backend-u
      const data = await api.login({
        email: normalizedEmail,
        password,
        turnstileToken: tsToken,
      });

      const accessToken = data?.accessToken || data?.token;
      if (!accessToken) throw new Error("Login response missing accessToken");

      setToken(accessToken);

      let user = data?.user || null;
      let role = data?.user?.role || data?.role || "";

      if (!role || !user) {
        const me = await api.me();
        user = me || user;
        role = me?.role || role || "user";
      }

      if (user) localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("role", role || "user");

      if (!remember) {
        // optional future: move token to sessionStorage
      }

      window.dispatchEvent(new Event("auth-changed"));

      const target = next || "/app/dashboard";
      const isAdminRoute = String(target).startsWith("/app/admin");

      if (isAdminRoute && role !== "admin") {
        nav("/app/dashboard", { replace: true });
        return;
      }

      nav(target, { replace: true });
    } catch (e2) {
      setErr(e2?.message || "Login failed");
      clearAuthLocal();

      // ✅ reset Turnstile posle fail-a (da ne ostane "stari" token)
      try {
        if (window.turnstile && tsWidgetId != null) window.turnstile.reset(tsWidgetId);
      } catch {}
      setTsToken("");
    } finally {
      setLoading(false);
    }
  }

  function googleLogin() {
    // ✅ IMPORTANT: send frontend origin so backend can redirect back correctly (no localhost on phone)
    const from = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (next) params.set("next", next);
    const qs = params.toString() ? `?${params.toString()}` : "";
    window.location.href = apiUrl(`/auth/google${qs}`);
  }

  const canSubmit = isValidEmail(email) && password.length > 0 && !loading && !!tsToken;

  return (
    // ✅ CONTENT-ONLY: PublicLayout already provides background + topbar + scroll container
    <div className="mx-auto w-full max-w-[1100px]">
      {/* ✅ Perfect spacing for all devices */}
      <div className="grid gap-5 lg:gap-6 lg:grid-cols-[1.05fr_0.95fr] items-start">
        {/* Left info card (hidden on mobile, shows on laptop+) */}
        <div className="hidden lg:block">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_40px_140px_rgba(0,0,0,0.55)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/25 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_55px_rgba(168,85,247,0.15)]">
                <span className="text-xs font-black tracking-tight text-white">FB</span>
              </div>
              <div className="min-w-0">
                <div className="text-lg font-black tracking-tight text-white truncate">
                  FollowerBooster
                </div>
                <div className="text-xs text-zinc-300/70 truncate">
                  Premium social infrastructure • 2050 UI
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="inline-flex items-center gap-2">
                <Pill tone="violet">2050</Pill>
                <Pill tone="info">Guest → Account</Pill>
                <Pill tone="ok">Secure</Pill>
              </div>

              <div className="text-2xl font-black tracking-tight text-white">
                Sign in. Buy in seconds.
              </div>

              <div className="text-sm text-zinc-200/70 leading-relaxed">
                Guest browsing is public. Ordering requires an account for security, receipts,
                wallet tracking, and support.
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Feature title="Instant access" desc="Fast login and secure session flow." />
                <Feature title="Live tracking" desc="Order status sync and history." />
                <Feature title="Wallet ready" desc="Top up, spend, audit trail." />
                <Feature title="Policies" desc="FAQ, contact, refunds, terms." />
              </div>

              {next ? (
                <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                  After login you’ll continue to:{" "}
                  <span className="font-semibold text-white/95">{next}</span>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-200/70">
                  You’ll land on{" "}
                  <span className="text-white/90 font-semibold">Dashboard</span> after sign in.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right auth card (always visible) */}
        <div className="w-full">
          <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-zinc-950/70 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_40px_140px_rgba(0,0,0,0.60)]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-purple-500/14 blur-3xl" />
              <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-cyan-500/12 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(900px_180px_at_15%_0%,rgba(255,255,255,0.10),transparent_70%)]" />
            </div>

            <div className="relative p-6 md:p-7">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2">
                    <Pill tone="violet">2050</Pill>
                    <Pill tone="info">Secure sign-in</Pill>
                  </div>
                  <h1 className="mt-3 text-2xl md:text-3xl font-black tracking-tight text-white">
                    Welcome back
                  </h1>
                  <p className="mt-1 text-sm text-zinc-200/70">
                    Sign in to access dashboard, wallet, orders & tracking.
                  </p>
                </div>

                <Link
                  to="/"
                  className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 hover:border-white/20 transition"
                >
                  Home
                </Link>
              </div>

              {err ? (
                <div className="mt-5 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-100">
                  <div className="font-semibold">Login failed</div>
                  <div className="mt-1 text-red-100/80">{err}</div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={googleLogin}
                disabled={loading}
                className={cls(
                  "mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  "border border-white/10 bg-white text-zinc-900 hover:bg-zinc-200",
                  "active:scale-[0.99]",
                  loading && "opacity-70 cursor-not-allowed"
                )}
              >
                {loading ? "Please wait…" : "Continue with Google"}
              </button>

              <div className="mt-5 flex items-center gap-3 text-xs text-zinc-300/60">
                <div className="h-px flex-1 bg-white/10" />
                <div>or sign in with email</div>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={submit} className="mt-5 grid gap-3">
                <Field
                  label="Email"
                  right={
                    email && !isValidEmail(email) ? (
                      <span className="text-[11px] font-semibold text-amber-200/90">
                        Enter a valid email
                      </span>
                    ) : null
                  }
                >
                  <input
                    className={inputCls}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </Field>

                <Field
                  label="Password"
                  right={
                    <div className="flex items-center gap-2">
                      {capsOn ? (
                        <span className="text-[11px] font-semibold text-amber-200/90">
                          Caps Lock is ON
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10 hover:border-white/20 transition"
                      >
                        {showPw ? "Hide" : "Show"}
                      </button>
                    </div>
                  }
                >
                  <input
                    className={inputCls}
                    placeholder="Your password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsOn(!!e.getModifierState?.("CapsLock"))}
                    autoComplete="current-password"
                  />
                </Field>

                {/* ✅ TURNSTILE (no UI redesign, just placed cleanly) */}
                <div className="pt-1">
                  <div
                    id="cf-turnstile-login"
                    className="min-h-[65px] rounded-2xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-xl"
                  />
                  <div className="mt-2 text-[11px] text-zinc-300/60">
                    Protected by Cloudflare Turnstile.
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <label className="flex items-center gap-2 text-sm text-zinc-200/75 select-none">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-black/30"
                    />
                    Remember me
                  </label>

                  <button
                    type="button"
                    onClick={() => setErr("If you forgot your password, contact support for now.")}
                    className="text-sm font-semibold text-cyan-200/80 hover:text-cyan-200 transition"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cls(
                    "mt-2 w-full rounded-2xl px-4 py-3 text-sm font-black transition active:scale-[0.99]",
                    canSubmit
                      ? "bg-white text-zinc-900 hover:bg-zinc-200"
                      : "bg-white/10 text-white/60 border border-white/10 cursor-not-allowed"
                  )}
                >
                  {loading ? "Authenticating…" : "Login"}
                </button>
              </form>

              <div className="mt-5 text-center text-sm text-zinc-200/70">
                No account?{" "}
                <Link
                  to={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
                  className="font-semibold text-white hover:underline"
                >
                  Create one
                </Link>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-zinc-300/70 leading-relaxed">
                By continuing, you agree to our{" "}
                <Link className="text-white/90 hover:underline" to="/terms">
                  Terms
                </Link>{" "}
                and{" "}
                <Link className="text-white/90 hover:underline" to="/privacy">
                  Privacy Policy
                </Link>
                . Refunds:{" "}
                <Link className="text-white/90 hover:underline" to="/refund">
                  Refund Policy
                </Link>
                .
              </div>
            </div>

            <div className="relative border-t border-white/10 bg-black/20 px-6 py-4 text-xs text-zinc-300/70 flex items-center justify-between">
              <span>Secure auth • token-only</span>
              <Link to="/contact" className="text-white/85 hover:text-white transition font-semibold">
                Support
              </Link>
            </div>
          </div>

          {/* Mobile helper card (only on small screens) */}
          <div className="mt-5 lg:hidden rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/25">
                <span className="text-xs font-black tracking-tight text-white">FB</span>
              </div>
              <div className="min-w-0">
                <div className="text-base font-black tracking-tight text-white truncate">
                  FollowerBooster
                </div>
                <div className="text-xs text-zinc-300/70 truncate">
                  Public browse • account required to order
                </div>
              </div>
            </div>

            {next ? (
              <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-xs text-cyan-100">
                After login you’ll continue to:{" "}
                <span className="font-semibold text-white/95">{next}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-zinc-400/70">
        © {new Date().getFullYear()} FollowerBooster •{" "}
        <Link className="hover:text-white" to="/terms">
          Terms
        </Link>{" "}
        •{" "}
        <Link className="hover:text-white" to="/privacy">
          Privacy
        </Link>{" "}
        •{" "}
        <Link className="hover:text-white" to="/refund">
          Refunds
        </Link>
      </div>
    </div>
  );
}
