// client/src/components/RequireAuth.jsx
import React, { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { api } from "../api.js";

export default function RequireAuth({ children }) {
  const loc = useLocation();
  const [ok, setOk] = useState(null);

  async function check() {
    const token = localStorage.getItem("token");
    if (!token) {
      setOk(false);
      return;
    }

    try {
      await api.get("/auth/me");
      setOk(true);
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
      setOk(false);
    }
  }

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!alive) return;
      setOk(null);
      await check();
    };

    run();

    // 🔥 kad god se login/logout desi
    const onAuth = () => run();
    window.addEventListener("auth-changed", onAuth);

    // (bonus) ako se token promeni u drugom tabu
    const onStorage = (e) => {
      if (e.key === "token") run();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      alive = false;
      window.removeEventListener("auth-changed", onAuth);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (ok === null) {
    return <div className="p-6 text-zinc-300">Checking session…</div>;
  }

  if (!ok) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  return children;
}
