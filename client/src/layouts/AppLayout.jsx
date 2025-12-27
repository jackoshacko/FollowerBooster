import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";

import bgSmm from "../assets/backgroundsmm.jpg";

export default function AppLayout() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <div className="flex min-h-[100dvh]">
        {/* Desktop sidebar only (Sidebar component already has hidden md:block inside) */}
        <Sidebar />

        {/* MAIN AREA */}
        <div className="relative flex min-h-[100dvh] flex-1 flex-col overflow-x-hidden">
          {/* ================= BACKGROUND ================= */}
          <div className="pointer-events-none absolute inset-0 z-0">
            {/* base fallback */}
            <div className="absolute inset-0 bg-zinc-950" />

            {/* main image */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-100"
              style={{ backgroundImage: `url(${bgSmm})` }}
            />

            {/* readability overlay */}
            <div className="absolute inset-0 bg-black/35" />

            {/* depth gradients */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/35 to-black/80" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50" />

            {/* premium glows */}
            <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-500/15 blur-3xl" />
            <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
          </div>

          {/* ================= TOPBAR (sticky) ================= */}
          <div className="relative z-20 sticky top-0">
            <Topbar />
          </div>

          {/* ================= CONTENT SCROLLER ================= */}
          {/* IMPORTANT: this is the scroll container, not the outer wrapper */}
          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto">
            <main className="p-4 md:p-6">
              <Outlet />
            </main>

            {/* bottom fade for premium look */}
            <div className="pointer-events-none sticky bottom-0 h-10 w-full bg-gradient-to-t from-black/55 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
