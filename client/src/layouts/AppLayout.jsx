import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar, { SidebarDrawer } from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import CookieNotice from "../components/CookieNotice.jsx";
import bgSmm from "../assets/backgroundsmm.jpg";

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();

  // reset body hacks (iOS / old scroll locks)
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

  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  return (
    <div className="min-h-[100dvh] w-full overflow-x-clip bg-zinc-950 text-zinc-100">
      {/* FIXED BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-zinc-950" />
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgSmm})` }}
        />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/35 to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-500/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-[100dvh] w-full overflow-x-clip">
        {/* Desktop sidebar */}
        <aside className="hidden md:block">
          <Sidebar />
        </aside>

        {/* Mobile sidebar */}
        <SidebarDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* =======================
            MAIN APP SCROLL AREA
            ======================= */}
        <main
          id="app-main"
          className="relative flex min-h-[100dvh] min-w-0 flex-1 flex-col overflow-y-auto overflow-x-clip"
        >
          {/* TOPBAR (sticky to app-main) */}
          <div id="app-topbar" className="sticky top-0 z-40">
            <Topbar onOpenSidebar={() => setMobileOpen(true)} />
          </div>

          {/* PAGE CONTENT */}
          <div className="min-w-0 flex-1">
            <div className="w-full">
              <div className="mx-auto w-full max-w-[1200px] 2xl:max-w-[1400px] px-4 py-4 md:px-6 md:py-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
                <Outlet />
              </div>
            </div>
          </div>

          <CookieNotice />
        </main>
      </div>
    </div>
  );
}
