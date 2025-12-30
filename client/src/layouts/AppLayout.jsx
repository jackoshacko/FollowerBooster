// client/src/layouts/AppLayout.jsx
import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import CookieNotice from "../components/CookieNotice.jsx"; // ✅ ADD

import bgSmm from "../assets/backgroundsmm.jpg";

export default function AppLayout() {
  // ✅ hard reset: ako je nekad ostao body lock (drawer/modal), vrati ga čim layout mounta
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    // reset any leftover lock
    body.style.overflow = "";
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    html.style.overscrollBehavior = "";

    // also clear stored scrollY (from our lock hook)
    if (body.dataset) body.dataset.scrollY = "";
  }, []);

  return (
    <div className="min-h-[100dvh] w-full overflow-x-clip bg-zinc-950 text-zinc-100">
      <div className="flex min-h-[100dvh] w-full overflow-x-clip">
        {/* ✅ Desktop sidebar only */}
        <aside className="hidden md:block">
          <Sidebar />
        </aside>

        {/* MAIN */}
        <div className="relative flex min-h-[100dvh] min-w-0 flex-1 flex-col overflow-x-clip isolate">
          {/* BACKGROUND — never capture touches */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute inset-0 bg-zinc-950" />
            <div
              className="absolute inset-0 bg-cover bg-center opacity-100"
              style={{ backgroundImage: `url(${bgSmm})` }}
            />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/35 to-black/80" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50" />
            <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-500/15 blur-3xl" />
            <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
          </div>

          {/* ✅ Sticky Topbar: works best when BODY is the scroller */}
          <div
            className={[
              "relative z-40",
              "sticky top-0",
              "will-change-transform",
              "backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl",
            ].join(" ")}
          >
            <Topbar />
          </div>

          {/* ✅ CONTENT: NO inner overflow scroll (body scroll only) */}
          <div className="relative z-10 min-w-0 flex-1 overflow-x-clip">
            <div className="w-full min-w-0 overflow-x-clip">
              <main
                className={[
                  "mx-auto w-full min-w-0 max-w-[1200px] 2xl:max-w-[1400px]",
                  "px-4 py-4 md:px-6 md:py-6",
                  // little bottom padding for iOS safe area / home bar
                  "pb-[calc(env(safe-area-inset-bottom)+16px)]",
                ].join(" ")}
              >
                <Outlet />
              </main>

              {/* subtle bottom fade, doesn't block scroll */}
              <div className="pointer-events-none sticky bottom-0 z-10 h-10 w-full bg-gradient-to-t from-black/55 to-transparent" />
            </div>
          </div>

          {/* ✅ Cookie notice visible also inside the app */}
          <CookieNotice />
        </div>
      </div>
    </div>
  );
}
