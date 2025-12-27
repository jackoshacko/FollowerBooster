import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "../api.js";

export default function RequireAdmin({ children }) {
  const loc = useLocation();
  const [allowed, setAllowed] = useState(null);

  async function check() {
    const token = localStorage.getItem("token");
    if (!token) {
      setAllowed(false);
      return;
    }

    try {
      const me = await api.get("/auth/me"); // mora vrati role
      localStorage.setItem("role", me?.role || "user");
      localStorage.setItem("user", JSON.stringify(me || {}));
      setAllowed(me?.role === "admin");
    } catch {
      setAllowed(false);
    }
  }

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!alive) return;
      setAllowed(null);
      await check();
    };

    run();

    const onAuth = () => run();
    window.addEventListener("auth-changed", onAuth);

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

  if (allowed === null) {
    return <div className="p-6 text-zinc-300">Checking admin access…</div>;
  }

  if (!allowed) {
    return <Navigate to="/no-access" replace state={{ from: loc }} />;
  }

  return children;
}
