// client/src/components/RequireAdmin.jsx
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "../lib/api.js"; // ✅ BITNO: lib/api.js

export default function RequireAdmin({ children }) {
  const location = useLocation();
  const [allowed, setAllowed] = useState(null);

  async function checkAdmin() {
    const token = localStorage.getItem("token");

    if (!token) {
      setAllowed(false);
      return;
    }

    try {
      // ✅ token-only endpoint
      const me = await api.get("/api/me");

      // optional cache
      if (me) {
        localStorage.setItem("user", JSON.stringify(me));
        if (me.role) localStorage.setItem("role", me.role);
      }

      setAllowed(me?.role === "admin");
    } catch (e) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      setAllowed(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      setAllowed(null);
      await checkAdmin();
    };

    run();

    // login / logout
    const onAuthChanged = () => run();
    window.addEventListener("auth-changed", onAuthChanged);

    // token change (other tab)
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

  // loading
  if (allowed === null) {
    return (
      <div className="p-6 text-zinc-300">
        Checking admin access…
      </div>
    );
  }

  // not admin
  if (!allowed) {
    return (
      <Navigate
        to="/no-access"
        replace
        state={{ from: location }}
      />
    );
  }

  // admin
  return children;
}
