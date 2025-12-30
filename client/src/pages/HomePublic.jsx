// client/src/pages/HomePublic.jsx
import React from "react";
import { Navigate, NavLink } from "react-router-dom";

function Card({ title, desc }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft shadow-hover">
      <div className="font-semibold text-zinc-100">{title}</div>
      <div className="mt-2 text-sm text-zinc-300">{desc}</div>
    </div>
  );
}

export default function HomePublic() {
  const token = localStorage.getItem("token");
  if (token) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-10">
      {/* HERO */}
      <div className="rounded-3xl border border-white/10 bg-black/35 backdrop-blur p-8 md:p-10 shadow-soft">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200">
          Premium panel • Secure top-ups • Live order tracking
        </div>

        <h1 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-tight">
          Social media promotion, built like a real SaaS.
        </h1>

        <p className="mt-4 max-w-2xl text-zinc-300">
          Manage services, orders and wallet top-ups in one place. Clean UX, transparent status,
          and privacy-first authentication.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <NavLink
            to="/login"
            className="rounded-xl px-5 py-3 bg-white text-zinc-900 hover:bg-zinc-200 text-sm font-semibold"
          >
            Sign in
          </NavLink>
          <NavLink
            to="/register"
            className="rounded-xl px-5 py-3 border border-white/10 hover:border-white/20 hover:bg-white/5 text-sm font-semibold"
          >
            Create account
          </NavLink>
          <NavLink
            to="/faq"
            className="rounded-xl px-5 py-3 border border-white/10 hover:border-white/20 hover:bg-white/5 text-sm font-semibold"
          >
            Help / FAQ
          </NavLink>
        </div>

        <div className="mt-6 text-xs text-zinc-400">
          Not affiliated with Instagram, TikTok, Meta, Google or any third-party platforms. Results may vary.
        </div>
      </div>

      {/* FEATURES */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Wallet & payments"
          desc="Top up via payment provider, track transactions, and keep your balance ready for orders."
        />
        <Card
          title="Orders with status"
          desc="Place orders fast, monitor progress, and keep everything organized in one dashboard."
        />
        <Card
          title="Support & policies"
          desc="Public Help, Contact and legal policies included for a professional, compliant launch."
        />
      </div>

      {/* HOW IT WORKS */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-xl font-semibold">How it works</div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <div className="text-sm text-zinc-400">Step 1</div>
            <div className="font-semibold">Create account</div>
            <div className="mt-2 text-sm text-zinc-300">Register and sign in to access the panel.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <div className="text-sm text-zinc-400">Step 2</div>
            <div className="font-semibold">Top up wallet</div>
            <div className="mt-2 text-sm text-zinc-300">Add funds and track your transactions.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <div className="text-sm text-zinc-400">Step 3</div>
            <div className="font-semibold">Place orders</div>
            <div className="mt-2 text-sm text-zinc-300">Choose a service, submit details, monitor status.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
