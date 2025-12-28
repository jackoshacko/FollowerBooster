// client/src/pages/AuthCallback.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, setToken } from "../lib/api.js";

export default function AuthCallback() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");

    if (!token) {
      setError("Missing token from Google login");
      return;
    }

    async function finishLogin() {
      try {
        // 1️⃣ snimi token
        setToken(token);

        // 2️⃣ povuci user info
        const me = await api.me();
        if (me) {
          localStorage.setItem("user", JSON.stringify(me));
          localStorage.setItem("role", me.role || "user");
        }

        // 3️⃣ obavesti app
        window.dispatchEvent(new Event("auth-changed"));

        // 4️⃣ redirect
        nav("/dashboard", { replace: true });
      } catch (e) {
        console.error(e);
        setError("Failed to finalize Google login");
      }
    }

    finishLogin();
  }, [params, nav]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      {!error ? (
        <div className="opacity-80">Signing you in with Google…</div>
      ) : (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
