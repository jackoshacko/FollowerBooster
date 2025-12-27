// client/src/components/RequireAuth.jsx
import React, { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { api } from "../lib/api.js"; // ✅ BITNO: lib/api.js

export default function RequireAuth({ children }) {
  const location = useLocation();
  const [ok, setOk] = useState(null);

  async function checkAuth() {
    const token = localStorage.getItem("token");

    if (!token) {
      setOk(false);
      return;
    }

    try {
      // ✅ token-only auth check
      await api.get("/api/me");
      setOk(true);
    } catch (e) {
      // cleanup ako token nije validan
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      setOk(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      setOk(null);
      await checkAuth();
    };

    run();

    // kad se login / logout desi
    const onAuthChanged = () => run();
    window.addEventListener("auth-changed", onAuthChanged);

    // ako se token promijeni u drugom tabu
    const onStorage = (e) => {
      if (e.key === "token") run();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mounted = false;
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // loading state
  if (ok === null) {
    return (
      <div className="p-6 text-zinc-300">
        Checking session…
      </div>
    );
  }

  // not authenticated
  if (!ok) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // authenticated
  return children;
}
