import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar, { SidebarDrawer } from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import CookieNotice from "../components/CookieNotice.jsx";
import bgSmm from "../assets/backgroundsmm.jpg";

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  const topbarWrapRef = useRef(null);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  // Measure topbar height -> CSS var --topbar-h
  useLayoutEffect(() => {
    const el = topbarWrapRef.current;
    if (!el) return;

    const setVar = () => {
      const h = Math.ceil(el.getBoundingClientRect().height || 0);
      document.documentElement.style.setProperty("--topbar-h", `${h}px`);
    };

    setVar();

    let ro = null;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(() => setVar());
      ro.observe(el);
    } else {
      window.addEventListener("resize", setVar);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", setVar);
    };
  }, []);

  // Optional: lock body scroll when drawer open (mobile)
  useEffect(() => {
    if (!mobileOpen) return;
    const body = document.body;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-[100dvh] w-full bg-zinc-950 text-zinc-100">
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

      <div className="relative z-10 flex min-h-[100dvh] w-full">
        {/* Desktop sidebar */}
        <aside className="hidden md:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer sidebar */}
        <SidebarDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* MAIN */}
        <div className="relative flex min-h-[100dvh] min-w-0 flex-1 flex-col">
          {/* FIXED TOPBAR */}
          <div
            id="app-topbar"
            ref={topbarWrapRef}
            className="fixed left-0 right-0 top-0 z-50 md:left-[var(--sidebar-w,0px)]"
          >
            {/* NOTE: md:left var samo ako ti sidebar zauzima fiksnu širinu.
                Ako Sidebar nije fixed width, obriši md:left... */}
            <Topbar onOpenSidebar={() => setMobileOpen(true)} />
          </div>

          {/* Content gets padding-top equal to topbar height */}
          <div
            className="min-w-0 flex-1"
            style={{
              paddingTop: "calc(var(--topbar-h, 64px) + env(safe-area-inset-top))",
            }}
          >
            <div className="mx-auto w-full max-w-[1200px] 2xl:max-w-[1400px] px-4 py-4 md:px-6 md:py-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
              <Outlet />
            </div>
          </div>

          <CookieNotice />
        </div>
      </div>
    </div>
  );
}
