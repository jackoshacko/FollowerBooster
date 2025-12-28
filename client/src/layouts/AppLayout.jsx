// client/src/layouts/AppLayout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";

import bgSmm from "../assets/backgroundsmm.jpg";

export default function AppLayout() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 overflow-x-hidden">
      {/* App shell */}
      <div className="flex min-h-[100dvh] overflow-x-hidden">
        {/* Sidebar (your component already hides on mobile) */}
        <Sidebar />

        {/* MAIN */}
        <div
          className={[
            "relative flex min-h-[100dvh] flex-1 flex-col",
            "overflow-x-hidden",
            "min-w-0", // critical for preventing flex overflow on mobile
            "isolate", // safer stacking context
          ].join(" ")}
        >
          {/* BACKGROUND (must never capture touches) */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute inset-0 bg-zinc-950" />

            <div
              className="absolute inset-0 bg-cover bg-center opacity-100"
              style={{ backgroundImage: `url(${bgSmm})` }}
            />

            <div className="absolute inset-0 bg-black/35" />

            <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/35 to-black/80" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50" />

            {/* premium glows */}
            <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-500/15 blur-3xl" />
            <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
          </div>

          {/* Sticky Topbar */}
          <header
            className={[
              "relative z-30",
              "sticky top-0",
              "supports-[backdrop-filter]:backdrop-blur-xl",
              "border-b border-white/10",
              // helps iOS Safari sticky rendering
              "will-change-transform",
            ].join(" ")}
          >
            <Topbar />
          </header>

          {/* Scroll container (ONLY vertical, stable on iOS) */}
          <div
            className={[
              "relative z-10",
              "flex-1 min-h-0 min-w-0",
              "overflow-y-auto overflow-x-hidden",
              // iOS momentum scroll
              "[webkit-overflow-scrolling:touch]",
              // stop page bounce / weird pull behavior
              "overscroll-y-contain",
              // prevent horizontal gestures from shifting layout
              "touch-pan-y",
            ].join(" ")}
          >
            <main
              className={[
                "mx-auto w-full min-w-0",
                // controlled max width for desktop, but fluid on mobile
                "max-w-[1200px] 2xl:max-w-[1400px]",
                "px-4 py-4 md:px-6 md:py-6",
              ].join(" ")}
            >
              <Outlet />
            </main>

            {/* bottom fade */}
            <div className="pointer-events-none sticky bottom-0 z-10 h-10 w-full bg-gradient-to-t from-black/55 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
