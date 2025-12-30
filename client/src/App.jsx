// client/src/layouts/PublicLayout.jsx
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import CookieNotice from "../components/CookieNotice.jsx";
import bgSmm from "../assets/backgroundsmm.jpg";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

function linkCls(isActive) {
  return cls(
    "rounded-xl px-3 py-2 text-sm border border-white/10 hover:border-white/20 hover:bg-white/5",
    isActive && "bg-white/5"
  );
}

export default function PublicLayout() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-clip bg-zinc-950 text-zinc-100">
      {/* BACKGROUND (premium) - never blocks clicks */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-zinc-950" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-100"
          style={{ backgroundImage: `url(${bgSmm})` }}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/55 to-black/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50" />
        <div className="glow-animate absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-500/15 blur-3xl" />
        <div className="glow-animate-reverse absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      {/* TOPBAR */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/35 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] 2xl:max-w-[1400px] items-center justify-between px-4 py-3 md:px-6">
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => navigate("/")}
            title="Home"
          >
            <div className="h-9 w-9 rounded-xl bg-white/10 grid place-items-center font-semibold">
              FB
            </div>
            <div className="leading-tight">
              <div className="font-semibold">FollowerBooster</div>
              <div className="text-xs text-zinc-400">Premium panel</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NavLink to="/faq" className={({ isActive }) => linkCls(isActive)}>
              Help
            </NavLink>

            <NavLink to="/login" className={({ isActive }) => linkCls(isActive)}>
              Sign in
            </NavLink>

            <NavLink
              to="/register"
              className="rounded-xl px-3 py-2 text-sm bg-white text-zinc-900 hover:bg-zinc-200"
            >
              Create account
            </NavLink>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="relative z-10">
        <div className="mx-auto w-full max-w-[1200px] 2xl:max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
          {/* little “card” wrapper so pages look premium even if simple */}
          <div className="rounded-3xl border border-white/10 bg-white/5 shadow-soft p-6 md:p-8">
            <Outlet />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="relative z-10 border-t border-white/10 bg-black/25 backdrop-blur">
        <div className="mx-auto max-w-[1200px] 2xl:max-w-[1400px] px-4 py-6 md:px-6 text-sm text-zinc-400 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>© {new Date().getFullYear()} FollowerBooster</div>

          <div className="flex flex-wrap gap-3">
            <NavLink className="hover:text-zinc-200" to="/terms">
              Terms
            </NavLink>
            <NavLink className="hover:text-zinc-200" to="/privacy">
              Privacy
            </NavLink>
            <NavLink className="hover:text-zinc-200" to="/refund">
              Refunds
            </NavLink>
            <NavLink className="hover:text-zinc-200" to="/contact">
              Contact
            </NavLink>
          </div>
        </div>
      </div>

      {/* Cookie banner on public pages too */}
      <CookieNotice />
    </div>
  );
}
