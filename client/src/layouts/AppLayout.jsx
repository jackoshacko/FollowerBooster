// client/src/layouts/AppLayout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";

import bgSmm from "../assets/backgroundsmm.jpg";

export default function AppLayout() {
  return (
    // Root shell: clamp width + prevent sideways drift everywhere
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-zinc-950 text-zinc-100">
      <div className="flex min-h-[100dvh] w-full overflow-x-hidden">
        {/* Sidebar (your component hides on mobile) */}
        <Sidebar />

        {/* MAIN (create stable stacking context + prevent flex overflow) */}
        <div className="relative flex min-h-[100dvh] min-w-0 flex-1 flex-col overflow-x-hidden isolate">
          {/* BACKGROUND — never capture touches */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute inset-0 bg-zinc-950" />

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

          {/* TOPBAR — sticky at viewport level (not inside a nested scroller) */}
          <div
            className={[
              "relative z-40",
              "sticky top-0",
              // iOS Safari: sticky + blur stability
              "will-change-transform",
              "transform-gpu",
              // safe area padding handled in Topbar already, but keep stable
              "backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl",
            ].join(" ")}
          >
            <Topbar />
          </div>

          {/* CONTENT SCROLLER — SINGLE vertical scroll source */}
          <div
            className={[
              "relative z-10",
              "min-w-0 flex-1",
              // the only scroll container
              "overflow-y-auto overflow-x-hidden",
              // iOS momentum scrolling
              "[-webkit-overflow-scrolling:touch]",
              // prevent the “rubber-band pulls layout sideways”
              "overscroll-y-contain",
              // only allow vertical panning gestures
              "touch-pan-y",
              // iOS: helps reduce scroll/blur glitches
              "transform-gpu",
            ].join(" ")}
          >
            {/* Inner width clamp (prevents any child from creating horizontal scroll) */}
            <div className="w-full min-w-0 overflow-x-hidden">
              <main
                className={[
                  "mx-auto w-full min-w-0",
                  // desktop clamp but always fluid
                  "max-w-[1200px] 2xl:max-w-[1400px]",
                  // padding safe for all devices
                  "px-4 py-4 md:px-6 md:py-6",
                ].join(" ")}
              >
                <Outlet />
              </main>

              {/* Bottom fade — pointer-events none so it never blocks scroll */}
              <div className="pointer-events-none sticky bottom-0 z-10 h-10 w-full bg-gradient-to-t from-black/55 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
