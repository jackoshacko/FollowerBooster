// client/src/pages/Register.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, apiUrl } from "../lib/api.js";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

function isEmail(v) {
  const s = String(v || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
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
    neutral: "border-white/10 bg-white/5 text-white/80",
    ok: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
    warn: "border-amber-500/25 bg-amber-500/10 text-amber-100",
    bad: "border-red-500/25 bg-red-500/10 text-red-100",
    info: "border-sky-500/25 bg-sky-500/10 text-sky-100",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-100",
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
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur-xl">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs text-zinc-300/70">{desc}</div>
    </div>
  );
}

export default function Register() {
  const nav = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [agree, setAgree] = useState(false);

  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Frontend anti-spam guard (still need backend for real protection)
  const [cooldown, setCooldown] = useState(0);
  const cdRef = useRef(null);
  const lastSubmitRef = useRef(0);

  // Honeypot (bots fill hidden inputs)
  const [website, setWebsite] = useState("");

  useEffect(() => {
    return () => window.clearInterval(cdRef.current);
  }, []);

  const score = useMemo(() => passwordScore(pw), [pw]);
  const scoreMeta = useMemo(() => scoreLabel(score), [score]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (cooldown > 0) return false;
    if (!agree) return false;
    if (!isEmail(email)) return false;
    if (String(pw).length < 8) return false;
    if (pw !== pw2) return false;
    return true;
  }, [loading, cooldown, agree, email, pw, pw2]);

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

  async function submit(e) {
    e.preventDefault();
    setErr("");

    // honeypot trigger
    if (website.trim()) {
      startCooldown(12);
      return;
    }

    // double-submit guard
    const now = Date.now();
    if (now - lastSubmitRef.current < 1200) return;
    lastSubmitRef.current = now;

    if (!isEmail(email)) return setErr("Please enter a valid email address.");
    if (String(pw).length < 8) return setErr("Password must be at least 8 characters.");
    if (pw !== pw2) return setErr("Passwords do not match.");
    if (!agree) return setErr("You must agree to Terms & Privacy Policy.");
    if (cooldown > 0) return;

    setLoading(true);
    try {
      // backend može ignorisati name ako ga još nema
      await api.register({
        email: email.trim(),
        password: pw,
        name: fullName.trim() || undefined,
      });

      startCooldown(8);
      nav("/login", { replace: true });
    } catch (e2) {
      setErr(e2?.message || "Register failed");
      startCooldown(12);
    } finally {
      setLoading(false);
    }
  }

  function googleSignup() {
    window.location.href = apiUrl("/auth/google");
  }

  return (
    // ✅ NO BACKGROUND HERE — PublicLayout already renders the galaxy background.
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1200px] 2xl:max-w-[1400px]">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
          {/* LEFT PANEL (desktop only) */}
          <div className="hidden lg:block">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_110px_rgba(0,0,0,0.55)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <span className="text-xs font-black">FB</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold tracking-tight text-white truncate">
                    FollowerBooster
                  </div>
                  <div className="text-[11px] text-zinc-300/70 truncate">
                    Premium social infrastructure • 2050 UI
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Pill tone="violet">2050</Pill>
                  <Pill tone="info">Secure signup</Pill>
                </div>
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight text-white">
                Create account. Start boosting.
              </h1>
              <p className="mt-2 text-sm text-zinc-300/75 leading-relaxed max-w-[56ch]">
                Public catalog is free to browse. Creating an account unlocks ordering, wallet top-ups,
                receipts, and live tracking.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Feature title="Instant onboarding" desc="Google or email signup. Ready in seconds." />
                <Feature title="Wallet-ready" desc="Top up, pay, audit trail — clean UX." />
                <Feature title="Order protection" desc="Idempotent payments + status tracking." />
                <Feature title="Support & policies" desc="FAQ, contact, terms, privacy & refunds." />
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-zinc-300/70">
                Tip: Use a strong password. Never reuse passwords from other sites.
              </div>

              <div className="mt-5 flex items-center justify-between text-xs text-zinc-300/60">
                <span>© {new Date().getFullYear()} FollowerBooster</span>
                <div className="flex gap-3">
                  <Link className="hover:text-white" to="/terms">Terms</Link>
                  <Link className="hover:text-white" to="/privacy">Privacy</Link>
                  <Link className="hover:text-white" to="/refund">Refunds</Link>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL (form) */}
          <div className="mx-auto w-full max-w-[560px]">
            <div className="rounded-3xl border border-white/12 bg-zinc-950/75 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_110px_rgba(0,0,0,0.55)] overflow-hidden">
              <div className="p-5 md:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Pill tone="violet">2050</Pill>
                    <Pill tone="info">Create account</Pill>
                  </div>
                  <button
                    type="button"
                    onClick={() => nav("/")}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10 hover:border-white/20 transition"
                  >
                    Home
                  </button>
                </div>

                <h2 className="mt-4 text-3xl font-black tracking-tight text-white">Welcome.</h2>
                <p className="mt-2 text-sm text-zinc-300/75">
                  Create your account to access dashboard, wallet, orders & tracking.
                </p>

                {err ? (
                  <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
                    {err}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={googleSignup}
                  disabled={loading || cooldown > 0}
                  className={cls(
                    "mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold",
                    "bg-white text-zinc-900 hover:bg-zinc-200 transition",
                    (loading || cooldown > 0) && "opacity-70 cursor-not-allowed"
                  )}
                >
                  Continue with Google
                </button>

                <div className="my-5 flex items-center gap-3 text-xs text-zinc-300/60">
                  <div className="h-px flex-1 bg-white/10" />
                  <span>or sign up with email</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <form onSubmit={submit} className="space-y-4">
                  {/* honeypot */}
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden="true"
                  />

                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-[0.18em] text-zinc-300/60">
                      Full name (optional)
                    </label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                      className={cls(
                        "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white",
                        "placeholder:text-zinc-300/35 outline-none focus:border-white/20 focus:bg-white/10"
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-[0.18em] text-zinc-300/60">
                      Email
                    </label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      inputMode="email"
                      className={cls(
                        "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white",
                        "placeholder:text-zinc-300/35 outline-none focus:border-white/20 focus:bg-white/10"
                      )}
                    />
                    {!email ? null : !isEmail(email) ? (
                      <div className="text-xs text-amber-200/80">Enter a valid email format.</div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-2">
                      <label className="text-[11px] uppercase tracking-[0.18em] text-zinc-300/60">
                        Password
                      </label>
                      <Pill tone={scoreMeta.tone}>{scoreMeta.text}</Pill>
                    </div>

                    <div className="relative">
                      <input
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        placeholder="Min 8 characters"
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        className={cls(
                          "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-20 text-sm text-white",
                          "placeholder:text-zinc-300/35 outline-none focus:border-white/20 focus:bg-white/10"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 hover:border-white/20 transition"
                      >
                        {showPw ? "Hide" : "Show"}
                      </button>
                    </div>

                    <div className="text-xs text-zinc-300/60">
                      Use at least 8 chars. For stronger security: add uppercase, number, symbol.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-[0.18em] text-zinc-300/60">
                      Confirm password
                    </label>
                    <div className="relative">
                      <input
                        value={pw2}
                        onChange={(e) => setPw2(e.target.value)}
                        placeholder="Repeat password"
                        type={showPw2 ? "text" : "password"}
                        autoComplete="new-password"
                        className={cls(
                          "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-20 text-sm text-white",
                          "placeholder:text-zinc-300/35 outline-none focus:border-white/20 focus:bg-white/10"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw2((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 hover:border-white/20 transition"
                      >
                        {showPw2 ? "Hide" : "Show"}
                      </button>
                    </div>
                    {pw2 && pw !== pw2 ? (
                      <div className="text-xs text-red-200/85">Passwords do not match.</div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-2 text-sm text-zinc-200/80 select-none">
                      <input
                        type="checkbox"
                        checked={agree}
                        onChange={(e) => setAgree(e.target.checked)}
                        className="h-4 w-4 accent-white"
                      />
                      <span>
                        I agree to the{" "}
                        <Link className="underline hover:text-white" to="/terms">Terms</Link>{" "}
                        and{" "}
                        <Link className="underline hover:text-white" to="/privacy">Privacy Policy</Link>.
                      </span>
                    </label>

                    <div className="text-xs text-zinc-300/60 whitespace-nowrap">
                      Token auth • secure
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={cls(
                      "w-full rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.99]",
                      canSubmit
                        ? "bg-white text-zinc-900 hover:bg-zinc-200"
                        : "bg-white/10 text-white/50 cursor-not-allowed"
                    )}
                  >
                    {loading
                      ? "Creating account…"
                      : cooldown > 0
                      ? `Please wait ${cooldown}s…`
                      : "Create account"}
                  </button>

                  <div className="text-center text-sm text-zinc-300/70">
                    Already have an account?{" "}
                    <Link className="font-semibold text-white hover:underline" to="/login">
                      Sign in
                    </Link>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-zinc-300/70">
                    By continuing, you acknowledge our policies. If you need help, visit{" "}
                    <Link className="underline hover:text-white" to="/faq">Help / FAQ</Link>{" "}
                    or{" "}
                    <Link className="underline hover:text-white" to="/contact">Contact</Link>.
                  </div>
                </form>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 bg-black/25 px-5 py-4 text-xs text-zinc-300/65">
                <span>Secure auth • token-only</span>
                <Link className="font-semibold text-white/80 hover:text-white" to="/contact">
                  Support
                </Link>
              </div>
            </div>

            <div className="mt-5 text-center text-xs text-zinc-300/60 lg:hidden">
              © {new Date().getFullYear()} FollowerBooster •{" "}
              <Link className="hover:text-white" to="/terms">Terms</Link> •{" "}
              <Link className="hover:text-white" to="/privacy">Privacy</Link> •{" "}
              <Link className="hover:text-white" to="/refund">Refunds</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
