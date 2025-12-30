// client/src/pages/HomePublic.jsx
import React from "react";
import { Navigate, NavLink } from "react-router-dom";

export default function HomePublic() {
  const token = localStorage.getItem("token");

  // Ako je ulogovan, vodi pravo u panel
  if (token) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-3xl font-semibold tracking-tight">
          Social media promotion, built like a real SaaS.
        </div>
        <div className="mt-3 text-zinc-300 max-w-2xl">
          Manage services, orders and wallet top-ups in one place. Transparent status,
          clean UX, and privacy-first authentication.
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <NavLink
            to="/login"
            className="rounded-xl px-4 py-2 bg-white text-zinc-900 hover:bg-zinc-200 text-sm font-medium"
          >
            Sign in
          </NavLink>
          <NavLink
            to="/register"
            className="rounded-xl px-4 py-2 border border-white/10 hover:border-white/20 hover:bg-white/5 text-sm font-medium"
          >
            Create account
          </NavLink>
          <NavLink
            to="/services"
            className="rounded-xl px-4 py-2 border border-white/10 hover:border-white/20 hover:bg-white/5 text-sm font-medium"
            title="Requires login"
          >
            View panel
          </NavLink>
        </div>

        <div className="mt-6 text-xs text-zinc-400">
          Not affiliated with Instagram, TikTok, Meta, Google or any third-party platforms.
          Results may vary.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="font-semibold">Secure sessions</div>
          <div className="mt-2 text-sm text-zinc-300">
            Token-based auth. You stay signed in. You can sign out anytime.
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="font-semibold">Clear payments</div>
          <div className="mt-2 text-sm text-zinc-300">
            Wallet top-ups with provider verification and event idempotency.
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="font-semibold">Support ready</div>
          <div className="mt-2 text-sm text-zinc-300">
            Help center, contact page and policies available publicly.
          </div>
        </div>
      </div>
    </div>
  );
}
