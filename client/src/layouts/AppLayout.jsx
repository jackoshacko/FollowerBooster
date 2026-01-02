// client/src/layouts/AppLayout.jsx
import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar, { SidebarDrawer } from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import CookieNotice from "../components/CookieNotice.jsx";
import bgSmm from "../assets/backgroundsmm.jpg";

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();

  // hard reset: ako je nekad ostao body lock (drawer/modal), vrati ga čim layout mounta
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    body.style.overflow = "";
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    html.style.overscrollBehavior = "";

    if (body.dataset) body.dataset.scrollY = "";
  }, []);

  // kad promeniš stranicu -> zatvori drawer
  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-zinc-950 text-zinc-100">
      {/* background FIXED */}
      <div className="pointer-events-none fixed inset-0 z-0">
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

      <div className="relative z-10 flex h-[100dvh] w-full overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:block shrink-0">
          <Sidebar />
        </aside>

        {/* Mobile drawer sidebar */}
        <SidebarDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* MAIN */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Topbar sticky */}
          <div className="sticky top-0 z-40" id="app-topbar" data-topbar="app">
            <Topbar onOpenSidebar={() => setMobileOpen(true)} />
          </div>

          {/* ✅ SCROLL CONTAINER (umesto window scroll) */}
          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-clip overscroll-contain">
            <main
              className={[
                "mx-auto w-full min-w-0 max-w-[1200px] 2xl:max-w-[1400px]",
                "px-4 py-4 md:px-6 md:py-6",
                "pb-[calc(env(safe-area-inset-bottom)+24px)]",
              ].join(" ")}
            >
              <Outlet />
            </main>

            <CookieNotice />
          </div>
        </div>
      </div>
    </div>
  );
}
