// client/src/pages/Register.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, apiUrl } from "../lib/api.js";

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

function passwordScore(pw) {
  const p = String(pw || "");
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[a-z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  return score; // 0..5
}

function scoreLabel(s) {
  if (s <= 1) return { text: "Weak", tone: "bad" };
  if (s === 2) return { text: "Okay", tone: "warn" };
  if (s === 3) return { text: "Good", tone: "info" };
  return { text: "Strong", tone: "ok" };
}

function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "border-white/10 bg-white/5 text-zinc-100/85",
    info: "border-sky-500/25 bg-sky-500/10 text-sky-100",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-100",
    ok: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
    warn: "border-amber-500/25 bg-amber-500/10 text-amber-100",
    bad: "border-red-500/25 bg-red-500/10 text-red-100",
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
   Turnstile (script is in index.html)
======================= */
const TURNSTILE_SITE_KEY =
  import.meta?.env?.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAACKWeLnKEIxFJtqP";

function safeStr(v) {
  const s = String(v || "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

export default function Register() {
  const nav = useNavigate();
  const loc = useLocation();
  const next = useMemo(() => getNextFromLocation(loc), [loc]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [agree, setAgree] = useState(false);

  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Honeypot for bots
  const [website, setWebsite] = useState("");

  // Frontend cooldown
  const [cooldown, setCooldown] = useState(0);
  const cdRef = useRef(null);
  const lastSubmitRef = useRef(0);

  // Turnstile state
  const [tsToken, setTsToken] = useState("");
  const [tsStatus, setTsStatus] = useState("loading"); // loading | ready | verified | error
  const tsBoxRef = useRef(null);
  const tsWidgetIdRef = useRef(null);

  useEffect(() => {
    return () => window.clearInterval(cdRef.current);
  }, []);

  const score = useMemo(() => passwordScore(pw), [pw]);
  const scoreMeta = useMemo(() => scoreLabel(score), [score]);

  function startCooldown(sec = 10) {
    window.clearInterval(cdRef.current);
    setCooldown(sec);
    cdRef.current = window.setInterval(() => {
      setCooldown((v) => {
        if (v <= 1) {
          window.clearInterval(cdRef.current);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  // ✅ mount Turnstile (same style as Login.jsx)
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const MAX_TRIES = 240;

    function cleanup() {
      try {
        if (window.turnstile && tsWidgetIdRef.current != null) {
          window.turnstile.remove(tsWidgetIdRef.current);
        }
      } catch {}
      tsWidgetIdRef.current = null;
      setTsToken("");
    }

    function waitForTurnstile() {
      if (cancelled) return;
      if (!tsBoxRef.current) return;

      if (window.turnstile && typeof window.turnstile.render === "function") {
        try {
          const wid = window.turnstile.render(tsBoxRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            size: "normal",
            theme: "dark",
            callback: (token) => {
              if (cancelled) return;
              const t = safeStr(token);
              setTsToken(t);
              setTsStatus(t ? "verified" : "ready");
            },
            "expired-callback": () => {
              if (cancelled) return;
              setTsToken("");
              setTsStatus("ready");
            },
            "error-callback": () => {
              if (cancelled) return;
              setTsToken("");
              setTsStatus("error");
            },
          });

          tsWidgetIdRef.current = wid;
          setTsStatus("ready");
        } catch {
          setTsStatus("error");
        }
        return;
      }

      tries += 1;
      if (tries > MAX_TRIES) {
        setTsStatus("error");
        return;
      }
      setTimeout(waitForTurnstile, 50);
    }

    setTsStatus("loading");
    cleanup();
    waitForTurnstile();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [loc.key]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (cooldown > 0) return false;
    if (!agree) return false;
    if (!isValidEmail(email)) return false;
    if (String(pw).length < 8) return false;
    if (pw !== pw2) return false;
    if (!tsToken) return false;
    return true;
  }, [loading, cooldown, agree, email, pw, pw2, tsToken]);

  async function submit(e) {
    e.preventDefault();
    setErr("");

    // honeypot hit
    if (website.trim()) {
      startCooldown(12);
      return;
    }

    // double submit guard
    const now = Date.now();
    if (now - lastSubmitRef.current < 1200) return;
    lastSubmitRef.current = now;

    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) return setErr("Please enter your email.");
    if (!isValidEmail(normalizedEmail))
      return setErr("Please enter a valid email address (example: you@example.com).");
    if (String(pw || "").length < 8) return setErr("Password must be at least 8 characters.");
    if (pw !== pw2) return setErr("Passwords do not match.");
    if (!agree) return setErr("You must agree to Terms & Privacy Policy.");
    if (!tsToken) return setErr("Please verify you are human (Turnstile).");
    if (cooldown > 0) return;

    setLoading(true);
    try {
      const out = await api.register({
        email: normalizedEmail,
        password: pw,
        name: fullName.trim() || undefined,

        // ✅ send token (backend can accept either key)
        turnstileToken: tsToken,
        cfTurnstileToken: tsToken,
      });

      startCooldown(8);

      // If backend returns token -> you are already logged in, go to app
      const hasToken =
        !!out?.accessToken || !!out?.token || !!localStorage.getItem("token");

      if (hasToken) {
        const target = next || "/app/dashboard";
        nav(target, { replace: true });
        return;
      }

      // Otherwise go to login
      const loginUrl = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
      nav(loginUrl, { replace: true });
    } catch (e2) {
      setErr(e2?.message || "Register failed");
      startCooldown(12);

      // reset widget on fail
      try {
        if (window.turnstile && tsWidgetIdRef.current != null) {
          window.turnstile.reset(tsWidgetIdRef.current);
        }
      } catch {}
      setTsToken("");
      setTsStatus("ready");
    } finally {
      setLoading(false);
    }
  }

  function googleSignup() {
    const from = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (next) params.set("next", next);
    const qs = params.toString() ? `?${params.toString()}` : "";
    window.location.href = apiUrl(`/auth/google${qs}`);
  }

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <div className="grid gap-5 lg:gap-6 lg:grid-cols-[1.05fr_0.95fr] items-start">
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
                Create account. Start boosting.
              </div>

              <div className="text-sm text-zinc-200/70 leading-relaxed">
                Public browsing is open. Creating an account unlocks ordering, wallet top-ups,
                receipts, and live tracking.
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Feature title="Instant onboarding" desc="Google or email signup. Ready in seconds." />
                <Feature title="Wallet ready" desc="Top up, spend, audit trail." />
                <Feature title="Order tracking" desc="History + status sync." />
                <Feature title="Support" desc="FAQ, contact, policies." />
              </div>

              {next ? (
                <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                  After signup you’ll continue to:{" "}
                  <span className="font-semibold text-white/95">{next}</span>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-200/70">
                  You’ll sign in next, then land on{" "}
                  <span className="text-white/90 font-semibold">Dashboard</span>.
                </div>
              )}
            </div>
          </div>
        </div>

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
                    <Pill tone="info">Secure signup</Pill>
                  </div>
                  <h1 className="mt-3 text-2xl md:text-3xl font-black tracking-tight text-white">
                    Create your account
                  </h1>
                  <p className="mt-1 text-sm text-zinc-200/70">
                    Sign up to access dashboard, wallet, orders & tracking.
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
                  <div className="font-semibold">Sign up failed</div>
                  <div className="mt-1 text-red-100/80">{err}</div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={googleSignup}
                disabled={loading || cooldown > 0}
                className={cls(
                  "mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  "border border-white/10 bg-white text-zinc-900 hover:bg-zinc-200",
                  "active:scale-[0.99]",
                  (loading || cooldown > 0) && "opacity-70 cursor-not-allowed"
                )}
              >
                {cooldown > 0 ? `Please wait ${cooldown}s…` : "Continue with Google"}
              </button>

              <div className="mt-5 flex items-center gap-3 text-xs text-zinc-300/60">
                <div className="h-px flex-1 bg-white/10" />
                <div>or sign up with email</div>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={submit} className="mt-5 grid gap-3">
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />

                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-zinc-200/70">
                      Full name <span className="text-zinc-400/60">(optional)</span>
                    </div>
                    <Pill tone="neutral">Profile later</Pill>
                  </div>
                  <input
                    className={inputCls}
                    placeholder="Your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    inputMode="text"
                  />
                </div>

                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-zinc-200/70">Email</div>
                    {email && !isValidEmail(email) ? (
                      <span className="text-[11px] font-semibold text-amber-200/90">
                        Enter a valid email
                      </span>
                    ) : null}
                  </div>
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
                </div>

                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-zinc-200/70">Password</div>
                    <Pill tone={scoreMeta.tone}>{scoreMeta.text}</Pill>
                  </div>

                  <div className="relative">
                    <input
                      className={cls(inputCls, "pr-20")}
                      placeholder="Min 8 characters"
                      type={showPw ? "text" : "password"}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10 hover:border-white/20 transition"
                    >
                      {showPw ? "Hide" : "Show"}
                    </button>
                  </div>

                  <div className="text-xs text-zinc-300/60 leading-relaxed">
                    For strong security: add uppercase, number, and a symbol. Don’t reuse passwords.
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-zinc-200/70">Confirm password</div>
                    {pw2 && pw !== pw2 ? (
                      <span className="text-[11px] font-semibold text-red-200/90">
                        Doesn’t match
                      </span>
                    ) : null}
                  </div>

                  <div className="relative">
                    <input
                      className={cls(inputCls, "pr-20")}
                      placeholder="Repeat password"
                      type={showPw2 ? "text" : "password"}
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw2((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10 hover:border-white/20 transition"
                    >
                      {showPw2 ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* ✅ TURNSTILE */}
                <div className="pt-1">
                  <div
                    ref={tsBoxRef}
                    className="min-h-[78px] rounded-2xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-xl"
                  />
                  <div className="mt-2 text-[11px] text-zinc-300/60 flex items-center justify-between gap-3">
                    <span>Protected by Cloudflare Turnstile.</span>
                    <span className="text-zinc-200/70">
                      {tsStatus === "loading" ? "Loading…" : null}
                      {tsStatus === "ready" ? "Ready" : null}
                      {tsStatus === "verified" ? "Verified" : null}
                      {tsStatus === "error" ? "Error" : null}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-400/60">
                    Token: {tsToken ? `${tsToken.length} chars` : "—"}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3 pt-1">
                  <label className="flex items-start gap-2 text-sm text-zinc-200/75 select-none">
                    <input
                      type="checkbox"
                      checked={agree}
                      onChange={(e) => setAgree(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30"
                    />
                    <span className="leading-snug">
                      I agree to the{" "}
                      <Link className="text-white/90 hover:underline" to="/terms">
                        Terms
                      </Link>{" "}
                      and{" "}
                      <Link className="text-white/90 hover:underline" to="/privacy">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>

                  <Pill tone={tsToken ? "ok" : "warn"}>
                    {tsToken ? "Verified" : "Verify"}
                  </Pill>
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
                  {loading
                    ? "Creating…"
                    : cooldown > 0
                      ? `Please wait ${cooldown}s…`
                      : "Create account"}
                </button>

                <div className="mt-1 text-center text-sm text-zinc-200/70">
                  Already have an account?{" "}
                  <Link
                    to={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
                    className="font-semibold text-white hover:underline"
                  >
                    Sign in
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
                  . Need help?{" "}
                  <Link className="text-white/90 hover:underline" to="/contact">
                    Support
                  </Link>
                  .
                </div>
              </form>
            </div>

            <div className="relative border-t border-white/10 bg-black/20 px-6 py-4 text-xs text-zinc-300/70 flex items-center justify-between">
              <span>Secure signup</span>
              <Link to="/faq" className="text-white/85 hover:text-white transition font-semibold">
                Help / FAQ
              </Link>
            </div>
          </div>

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
                  Create account • then sign in
                </div>
              </div>
            </div>

            {next ? (
              <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-xs text-cyan-100">
                After signup you’ll continue to:{" "}
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
