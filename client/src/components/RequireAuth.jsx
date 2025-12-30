// client/src/components/RequireAuth.jsx
import React, { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "../lib/api.js"; // ✅ BITNO: lib/api.js

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

function buildNext(location) {
  const next = location.pathname + (location.search || "");
  return encodeURIComponent(next);
}

function clearAuth() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
  } catch {}
  try {
    window.dispatchEvent(new Event("auth-changed"));
  } catch {}
}

export default function RequireAuth({ children }) {
  const location = useLocation();

  const [ok, setOk] = useState(null); // null = loading, false = no, true = yes
  const checkingRef = useRef(false);

  async function checkAuth() {
    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setOk(false);
        return;
      }

      // ✅ token-only auth check (backend validates token)
      await api.get("/api/me");
      setOk(true);
    } catch {
      clearAuth();
      setOk(false);
    } finally {
      checkingRef.current = false;
    }
  }

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!alive) return;
      setOk(null);
      await checkAuth();
    };

    run();

    // login/logout in same tab
    const onAuthChanged = () => run();
    window.addEventListener("auth-changed", onAuthChanged);

    // token changed in other tab
    const onStorage = (e) => {
      if (e.key === "token") run();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      alive = false;
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Loading UI
  if (ok === null) {
    return (
      <div className="min-h-[40vh] w-full flex items-center justify-center">
        <div
          className={cls(
            "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl",
            "px-5 py-4 text-zinc-200/80",
            "shadow-soft"
          )}
        >
          <div className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 rounded-full bg-white/70 animate-pulse" />
            <span className="text-sm font-semibold">Checking session…</span>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Not authenticated → redirect with next
  if (!ok) {
    const next = buildNext(location);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
