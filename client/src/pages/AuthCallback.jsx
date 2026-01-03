// client/src/pages/AuthCallback.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, clearAuthLocal, setRole, setToken, setUser } from "../lib/api.js";

/* =========================
   helpers (safe + compare)
========================= */

function safeStr(v) {
  const s = String(v ?? "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

function startsWithOneOf(str, prefixes) {
  const s = String(str || "");
  for (const p of prefixes) {
    if (s.startsWith(p)) return true;
  }
  return false;
}

function normalizeNext(rawNext) {
  const n = safeStr(rawNext);

  // default
  if (!n) return "/app/dashboard";

  // ✅ only allow internal paths
  // block: "https://...", "//evil.com", "javascript:..."
  if (!n.startsWith("/")) return "/app/dashboard";
  if (n.startsWith("//")) return "/app/dashboard";
  if (/^\/\s*javascript:/i.test(n)) return "/app/dashboard";

  // ✅ if someone sends old routes ("/dashboard"), force into "/app/dashboard"
  if (n === "/dashboard") return "/app/dashboard";
  if (startsWithOneOf(n, ["/orders", "/wallet", "/create-order", "/admin"])) {
    return `/app${n}`;
  }

  // ✅ already correct app route
  if (n.startsWith("/app")) return n;

  // ✅ allow some public pages too (optional)
  if (startsWithOneOf(n, ["/services", "/login", "/register", "/terms", "/privacy", "/refund", "/contact"])) {
    return n;
  }

  // everything else -> safest
  return "/app/dashboard";
}

function pickToken(params) {
  // try several keys
  return (
    safeStr(params.get("token")) ||
    safeStr(params.get("accessToken")) ||
    safeStr(params.get("access_token")) ||
    ""
  );
}

/* =========================
   component
========================= */

export default function AuthCallback() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();

  const [error, setError] = useState("");
  const [stage, setStage] = useState("init"); // init | saving | fetching | redirecting | done | error

  const onceRef = useRef(false);

  // compute target safely
  const next = useMemo(() => {
    // allow next from query OR state (if you ever pass it)
    const fromQuery = safeStr(params.get("next"));
    const fromState = safeStr(loc?.state?.next);
    return normalizeNext(fromQuery || fromState);
  }, [params, loc?.state?.next]);

  useEffect(() => {
    // ✅ avoid double-run issues in React strict mode
    if (onceRef.current) return;
    onceRef.current = true;

    const token = pickToken(params);

    if (!token) {
      clearAuthLocal();
      setStage("error");
      setError("Missing token from Google login.");
      // go back to login with next
      nav(`/login?next=${encodeURIComponent(next)}`, { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setStage("saving");

        // 1) store token immediately
        setToken(token);

        // 2) fetch me (non-fatal if fails)
        setStage("fetching");
        try {
          const me = await api.me();
          if (!cancelled && me) {
            setUser(me);
            setRole(me.role || "user");
          }
        } catch (e) {
          // keep token anyway, do not hard fail
          // (optional) you can console.log, but no need
        }

        // 3) notify app
        try {
          window.dispatchEvent(new Event("auth-changed"));
        } catch {}

        // 4) redirect
        setStage("redirecting");
        if (!cancelled) nav(next, { replace: true });

        setStage("done");
      } catch (e) {
        console.error(e);
        clearAuthLocal();
        if (!cancelled) {
          setStage("error");
          setError(e?.message || "Failed to finalize Google login.");
          nav(`/login?next=${encodeURIComponent(next)}`, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // rerun only if callback URL changes (new token)
  }, [loc.key, params, nav, next]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      {!error ? (
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-white/85 backdrop-blur-2xl">
          <div className="text-lg font-black text-white">Signing you in…</div>
          <div className="mt-2 text-sm text-zinc-200/70">
            Finishing Google authentication and redirecting you securely.
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-zinc-200/70">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="font-semibold text-white/90">
                {stage === "init"
                  ? "Initializing"
                  : stage === "saving"
                  ? "Saving token"
                  : stage === "fetching"
                  ? "Loading profile"
                  : stage === "redirecting"
                  ? "Redirecting"
                  : stage === "done"
                  ? "Done"
                  : "…"}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-zinc-300/60">
              Target: <span className="text-white/90 font-semibold">{next}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">
          <div className="text-lg font-black">Login failed</div>
          <div className="mt-2 text-sm text-red-100/80">{error}</div>
          <div className="mt-4 text-xs text-red-100/70">
            Redirecting you back to login…
          </div>
        </div>
      )}
    </div>
  );
}
