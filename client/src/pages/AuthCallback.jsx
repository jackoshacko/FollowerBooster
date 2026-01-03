// client/src/pages/AuthCallback.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, clearAuthLocal, setRole, setToken, setUser } from "../lib/api.js";

function safe(v) {
  const s = String(v || "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

export default function AuthCallback() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = safe(params.get("token")) || safe(params.get("accessToken")) || safe(params.get("access_token"));
    const next = safe(params.get("next")) || "/app/dashboard";

    if (!token) {
      clearAuthLocal();
      setError("Missing token from Google login");
      // vrati na login i prenesi next
      nav(`/login?next=${encodeURIComponent(next)}`, { replace: true });
      return;
    }

    let cancelled = false;

    async function finishLogin() {
      try {
        // 1) snimi token odmah
        setToken(token);

        // 2) probaj povući user info (ako pukne, i dalje nastavi)
        try {
          const me = await api.me();
          if (me && !cancelled) {
            setUser(me);
            setRole(me.role || "user");
          }
        } catch (e) {
          // ignorisi: bitno je da token ostane snimljen
        }

        // 3) obavesti app
        window.dispatchEvent(new Event("auth-changed"));

        // 4) redirect (uvek na /app/..)
        if (!cancelled) nav(next, { replace: true });
      } catch (e) {
        console.error(e);
        clearAuthLocal();
        if (!cancelled) setError("Failed to finalize Google login");
      }
    }

    finishLogin();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.key]); // loc.key da se rerun ako dođeš opet na callback

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      {!error ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-white/80 backdrop-blur-2xl">
          Signing you in with Google…
        </div>
      ) : (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded text-red-100">
          {error}
        </div>
      )}
    </div>
  );
}
