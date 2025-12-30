// client/src/layouts/PublicLayout.jsx
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function PublicLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* topbar */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div
            className="flex items-center gap-3 cursor-pointer"
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
            <NavLink
              to="/faq"
              className={({ isActive }) =>
                cls(
                  "rounded-xl px-3 py-2 text-sm border border-white/10 hover:border-white/20 hover:bg-white/5",
                  isActive && "bg-white/5"
                )
              }
            >
              Help
            </NavLink>
            <NavLink
              to="/login"
              className={({ isActive }) =>
                cls(
                  "rounded-xl px-3 py-2 text-sm border border-white/10 hover:border-white/20 hover:bg-white/5",
                  isActive && "bg-white/5"
                )
              }
            >
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

      {/* content */}
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <Outlet />
      </div>

      {/* footer (LEGAL LINKS) */}
      <div className="border-t border-white/10 bg-zinc-950/60">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-zinc-400 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
    </div>
  );
}
