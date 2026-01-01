// client/src/components/Sidebar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  ListChecks,
  Wallet,
  Wrench,
  Shield,
  LogOut,
  Users,
  Receipt,
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Bell,
  BadgeCheck,
  AlertCircle,
  Clock,
  ArrowUpRight,
  LifeBuoy,
  FileText,
  Mail,
  X,
} from "lucide-react";

import { api, setToken, setUser } from "../lib/api.js";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

const IS_IOS =
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent || "");

const DESKTOP_BLUR = IS_IOS ? "" : "backdrop-blur-xl";

/* =========================
   iOS-safe scroll lock
========================= */
function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;

    const body = document.body;
    const html = document.documentElement;

    const y = window.scrollY || 0;
    body.dataset.scrollY = String(y);

    // iOS-friendly: freeze body
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    html.style.overscrollBehavior = "none";

    return () => {
      const yy = Number(body.dataset.scrollY || "0");
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";
      html.style.overscrollBehavior = "";
      window.scrollTo(0, yy);
    };
  }, [locked]);
}

/* =========================
   Mobile Drawer (PORTAL)
   - key fix: render into document.body
========================= */
function MobileDrawer({ open, onClose, children }) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] md:hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* overlay */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Close sidebar"
      />

      {/* slide panel */}
      <div
        className={cls(
          "absolute left-0 top-0 h-[100dvh] w-[86vw] max-w-[360px]",
          "translate-x-0"
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/* =========================
   UI atoms
========================= */
function RenderIcon({ icon, className }) {
  if (!icon) return null;
  const IconComp = icon;
  return <IconComp className={className || "h-4 w-4"} />;
}

function Chip({ children, tone = "neutral", title }) {
  const tones = {
    neutral: "border-white/12 bg-white/6 text-zinc-100/85",
    ok: "border-emerald-500/25 bg-emerald-500/12 text-emerald-100",
    warn: "border-amber-500/25 bg-amber-500/12 text-amber-100",
    bad: "border-red-500/25 bg-red-500/12 text-red-100",
    violet: "border-violet-500/25 bg-violet-500/12 text-violet-100",
  };

  return (
    <span
      title={title}
      className={cls(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        tones[tone] || tones.neutral
      )}
    >
      {children}
    </span>
  );
}

function Item({ to, icon, label, collapsed, right, onClick }) {
  return (
    <NavLink
      to={to}
      end
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={({ isActive }) =>
        cls(
          "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
          "border overflow-hidden select-none",
          isActive
            ? cls(
                "border-white/14 bg-white/10 text-white",
                "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_55px_rgba(168,85,247,0.22)]"
              )
            : cls(
                "border-transparent text-zinc-200/85",
                "hover:text-white hover:border-white/12 hover:bg-white/8"
              )
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cls(
              "pointer-events-none absolute left-0 top-1/2 h-9 w-[4px] -translate-y-1/2 rounded-full",
              "bg-gradient-to-b from-cyan-300/0 via-purple-300/70 to-cyan-300/0",
              "shadow-[0_0_16px_rgba(168,85,247,0.45)]",
              isActive ? "opacity-100" : "opacity-0"
            )}
          />
          <span
            className={cls(
              "grid h-9 w-9 place-items-center rounded-2xl border shrink-0 transition",
              isActive
                ? "border-white/14 bg-white/10"
                : "border-white/10 bg-white/6 group-hover:bg-white/10"
            )}
          >
            <RenderIcon icon={icon} className="h-4 w-4 text-white/90" />
          </span>

          {!collapsed ? (
            <span className="font-semibold tracking-tight">{label}</span>
          ) : null}
          {!collapsed && right ? right : null}
        </>
      )}
    </NavLink>
  );
}

function Section({ title, icon, collapsed, children, mobile }) {
  return (
    <div className="mt-5">
      {!collapsed ? (
        <div className="mb-2 flex items-center gap-2 px-2">
          <span
            className={cls(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
              mobile
                ? "border-white/12 bg-white/6 text-zinc-100/80"
                : cls("border-white/10 bg-white/5 text-zinc-100/80", DESKTOP_BLUR)
            )}
          >
            {icon ? <RenderIcon icon={icon} className="h-3.5 w-3.5" /> : null}
            <span>{title}</span>
          </span>
        </div>
      ) : (
        <div className="mb-2 px-2">
          <div className="h-px w-full bg-white/10" />
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/* =========================
   Sidebar shell
   - Mobile: SOLID BG, NO BLUR
   - Desktop: premium blur
========================= */
function SidebarShell({
  children,
  collapsed,
  setCollapsed,
  onLogout,
  loading,
  title,
  subtitle,
  statusPills,
  footer,
  mobile,
  onClose,
}) {
  return (
    <aside
      className={cls(
        "relative text-zinc-100",
        mobile ? "h-[100dvh] w-[86vw] max-w-[360px]" : "h-screen",
        mobile
          ? cls(
              "bg-zinc-950", // ✅ HARD FIX: solid bg (no grey washed overlay)
              "border-r border-white/12",
              "shadow-[0_25px_90px_rgba(0,0,0,0.75)]"
            )
          : cls(
              "border-r border-white/10",
              "bg-black/35",
              DESKTOP_BLUR,
              "shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]",
              collapsed ? "w-[98px]" : "w-[310px]"
            ),
        "overflow-x-clip"
      )}
    >
      {/* background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-purple-500/16 blur-3xl" />
        <div className="absolute -left-10 bottom-10 h-72 w-72 rounded-full bg-cyan-500/14 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_140px_at_18%_0%,rgba(255,255,255,0.10),transparent_70%)]" />
      </div>

      {/* safe-area top */}
      <div className="pt-[calc(env(safe-area-inset-top)+12px)] px-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cls(
                "grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/6 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] shrink-0",
                mobile ? "" : DESKTOP_BLUR
              )}
            >
              <span className="text-xs font-black tracking-tight text-white">
                FB
              </span>
            </div>

            {!collapsed ? (
              <div className="leading-tight min-w-0">
                <div className="text-sm font-extrabold tracking-tight text-white truncate">
                  {title || "FollowerBooster"}
                </div>
                <div className="text-xs text-zinc-200/70 truncate">
                  {loading ? "Loading…" : subtitle || "Authenticated"}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {mobile ? (
              <button
                onClick={onClose}
                className={cls(
                  "inline-flex items-center justify-center rounded-2xl p-2",
                  "border border-white/10 bg-white/6 text-zinc-100/85",
                  "hover:bg-white/10 hover:text-white transition"
                )}
                title="Close"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setCollapsed((v) => !v)}
                className={cls(
                  "inline-flex items-center justify-center rounded-2xl p-2",
                  "border border-white/10 bg-white/5 text-zinc-100/80",
                  DESKTOP_BLUR,
                  "hover:bg-white/10 hover:text-white transition"
                )}
                title={collapsed ? "Expand" : "Collapse"}
                type="button"
              >
                {collapsed ? (
                  <ChevronsRight className="h-4 w-4" />
                ) : (
                  <ChevronsLeft className="h-4 w-4" />
                )}
              </button>
            )}

            <button
              onClick={onLogout}
              className={cls(
                "inline-flex items-center justify-center rounded-2xl p-2",
                "border border-white/10 bg-white/6 text-zinc-100/85",
                mobile ? "" : DESKTOP_BLUR,
                "hover:bg-white/10 hover:text-white transition"
              )}
              title="Logout"
              type="button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!collapsed && statusPills ? (
          <div className="mb-3 flex flex-wrap gap-2">{statusPills}</div>
        ) : null}

        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>

      <div className="mt-3 flex flex-col min-h-0 px-4">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
          {children}
        </div>

        {footer ? (
          <div className="mt-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">
            {footer}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

/* =========================
   data + helpers
========================= */
function fmtMoney(n, cur = "EUR") {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${Math.round(v * 100) / 100} ${cur}`;
  }
}

function useSidebarData(onClose) {
  const navigate = useNavigate();
  const loc = useLocation();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sb_collapsed") === "1"
  );
  const [me, setMe] = useState(null);
  const [myOrdersCount, setMyOrdersCount] = useState(null);
  const [walletSnap, setWalletSnap] = useState({ balance: null, currency: "EUR" });
  const [opsSnap, setOpsSnap] = useState({
    active: null,
    pending: null,
    processing: null,
    failed: null,
  });
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const pollRef = useRef(null);

  const isAdmin = me?.role === "admin";
  const isOnAdmin = loc.pathname.startsWith("/admin");
  const authed = !!localStorage.getItem("token");

  useEffect(() => {
    localStorage.setItem("sb_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  function hardLogout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("role");
    onClose?.();
    navigate("/login", { replace: true });
  }

  function guard(to) {
    const needsAuth = [
      "/dashboard",
      "/create-order",
      "/orders",
      "/wallet",
      "/admin/dashboard",
      "/admin/services",
      "/admin/users",
      "/admin/orders",
      "/admin/transactions",
    ];
    if (!authed && needsAuth.some((p) => String(to).startsWith(p))) {
      onClose?.();
      navigate("/login", { replace: true });
      return false;
    }
    return true;
  }

  const navClick = (to) => {
    if (!guard(to)) return;
    onClose?.();
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setMe(null);
          return;
        }
        const data = await api.get("/api/me");
        if (!alive) return;
        setMe(data);
        localStorage.setItem("role", data?.role || "");
      } catch {
        if (!alive) return;
        setMe(null);
        hardLogout();
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSidebarMetrics({ silent = false } = {}) {
    try {
      const [orders, wallet] = await Promise.allSettled([
        api.get("/orders"),
        api.get("/wallet"),
      ]);

      if (orders.status === "fulfilled") {
        const list = Array.isArray(orders.value) ? orders.value : [];
        setMyOrdersCount(list.length);

        let pending = 0;
        let processing = 0;
        let failed = 0;
        for (const o of list) {
          const st = String(o?.status || "").toLowerCase();
          if (st === "pending") pending++;
          else if (st === "processing") processing++;
          else if (st === "failed") failed++;
        }
        const active = pending + processing;
        setOpsSnap({ active, pending, processing, failed });
      } else if (!silent) {
        setMyOrdersCount(null);
      }

      if (wallet.status === "fulfilled") {
        const w = wallet.value || {};
        setWalletSnap({
          balance:
            typeof w?.balance === "number" ? w.balance : Number(w?.balance ?? 0),
          currency: w?.currency || "EUR",
        });
      } else if (!silent) {
        setWalletSnap({ balance: null, currency: "EUR" });
      }
    } catch {
      if (!silent) {
        setMyOrdersCount(null);
        setWalletSnap({ balance: null, currency: "EUR" });
      }
    }
  }

  useEffect(() => {
    if (!me) return;
    let alive = true;
    (async () => {
      await loadSidebarMetrics();
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.role]);

  useEffect(() => {
    if (!me) return;
    if (!live) return;

    const ms = isOnAdmin ? 15000 : 22000;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      loadSidebarMetrics({ silent: true });
    }, ms);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [me, live, isOnAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const emailLabel = useMemo(() => {
    const email = me?.email || me?.username || me?.name;
    return email || (authed ? "Authenticated" : "Guest");
  }, [me, authed]);

  const statusPills = (
    <>
      <Chip tone="violet" title="Premium UI mode">
        <Sparkles className="h-3.5 w-3.5" /> 2050
      </Chip>

      <Chip
        tone={walletSnap.balance == null ? "neutral" : walletSnap.balance > 0 ? "ok" : "warn"}
        title="Wallet snapshot"
      >
        <Wallet className="h-3.5 w-3.5" />{" "}
        {walletSnap.balance == null
          ? "Wallet —"
          : fmtMoney(walletSnap.balance, walletSnap.currency)}
      </Chip>

      <Chip
        tone={
          (opsSnap.failed || 0) > 0
            ? "bad"
            : (opsSnap.pending || 0) + (opsSnap.processing || 0) > 0
            ? "warn"
            : "ok"
        }
        title="Orders health"
      >
        {(opsSnap.failed || 0) > 0 ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (opsSnap.pending || 0) + (opsSnap.processing || 0) > 0 ? (
          <Clock className="h-3.5 w-3.5" />
        ) : (
          <BadgeCheck className="h-3.5 w-3.5" />
        )}
        {(opsSnap.failed || 0) > 0
          ? "Issues"
          : (opsSnap.pending || 0) + (opsSnap.processing || 0) > 0
          ? "Active"
          : "Clean"}
      </Chip>

      <button
        type="button"
        onClick={() => setLive((v) => !v)}
        className={cls(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition",
          live
            ? "border-emerald-500/25 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18"
            : "border-white/12 bg-white/6 text-zinc-100/75 hover:bg-white/10"
        )}
        title="Toggle live"
      >
        <Bell className="h-3.5 w-3.5" /> {live ? "Live" : "Paused"}
      </button>
    </>
  );

  const footer = (
    <div className="rounded-2xl border border-white/12 bg-white/6 p-3 text-xs text-zinc-200/75">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-zinc-100 truncate">FollowerBooster</div>
          <div className="mt-1 text-[11px] text-zinc-200/70 truncate">
            {me?.email || emailLabel}
          </div>
        </div>
        <button
          onClick={() => (authed ? navigate("/wallet") : navigate("/login"))}
          className="inline-flex items-center gap-1 rounded-2xl border border-white/12 bg-white/6 px-3 py-2 text-[11px] font-semibold hover:bg-white/10 transition"
          type="button"
        >
          <ArrowUpRight className="h-4 w-4" /> {authed ? "Wallet" : "Login"}
        </button>
      </div>
      {myOrdersCount != null ? (
        <div className="mt-2 text-[11px] text-zinc-200/60">
          Orders tracked: <span className="text-zinc-100/90 font-semibold">{myOrdersCount}</span>
        </div>
      ) : null}
    </div>
  );

  const content = (
    <>
      <Section title="Browse" icon={Sparkles} collapsed={collapsed} mobile={false}>
        <Item
          to="/services"
          icon={ListChecks}
          label="Services"
          collapsed={collapsed}
          onClick={() => navClick("/services")}
        />
      </Section>

      <Section title="User" icon={Shield} collapsed={collapsed} mobile={false}>
        <Item
          to={authed ? "/dashboard" : "/login"}
          icon={LayoutDashboard}
          label="Dashboard"
          collapsed={collapsed}
          onClick={() => navClick("/dashboard")}
        />
        <Item
          to={authed ? "/create-order" : "/login"}
          icon={ShoppingCart}
          label="Create order"
          collapsed={collapsed}
          onClick={() => navClick("/create-order")}
        />
        <Item
          to={authed ? "/orders" : "/login"}
          icon={ListChecks}
          label="Orders"
          collapsed={collapsed}
          onClick={() => navClick("/orders")}
        />
        <Item
          to={authed ? "/wallet" : "/login"}
          icon={Wallet}
          label="Wallet"
          collapsed={collapsed}
          onClick={() => navClick("/wallet")}
        />
      </Section>

      {authed && isAdmin ? (
        <Section title="Admin" icon={Wrench} collapsed={collapsed} mobile={false}>
          <Item
            to="/admin/dashboard"
            icon={BarChart3}
            label="Dashboard"
            collapsed={collapsed}
            onClick={() => navClick("/admin/dashboard")}
          />
          <Item
            to="/admin/services"
            icon={Wrench}
            label="Services"
            collapsed={collapsed}
            onClick={() => navClick("/admin/services")}
          />
          <Item
            to="/admin/users"
            icon={Users}
            label="Users"
            collapsed={collapsed}
            onClick={() => navClick("/admin/users")}
          />
          <Item
            to="/admin/orders"
            icon={ListChecks}
            label="Orders"
            collapsed={collapsed}
            onClick={() => navClick("/admin/orders")}
          />
          <Item
            to="/admin/transactions"
            icon={Receipt}
            label="Transactions"
            collapsed={collapsed}
            onClick={() => navClick("/admin/transactions")}
          />
        </Section>
      ) : null}

      <Section title="Support" icon={LifeBuoy} collapsed={collapsed} mobile={false}>
        <Item to="/faq" icon={Bell} label="Help / FAQ" collapsed={collapsed} onClick={() => navClick("/faq")} />
        <Item to="/contact" icon={Mail} label="Contact" collapsed={collapsed} onClick={() => navClick("/contact")} />
      </Section>

      <Section title="Legal" icon={FileText} collapsed={collapsed} mobile={false}>
        <Item to="/terms" icon={Receipt} label="Terms" collapsed={collapsed} onClick={() => navClick("/terms")} />
        <Item to="/privacy" icon={Shield} label="Privacy" collapsed={collapsed} onClick={() => navClick("/privacy")} />
        <Item to="/refund" icon={AlertCircle} label="Refunds" collapsed={collapsed} onClick={() => navClick("/refund")} />
      </Section>
    </>
  );

  return { collapsed, setCollapsed, hardLogout, loading, emailLabel, statusPills, footer, content };
}

/* =========================
   Desktop sidebar
========================= */
export default function Sidebar() {
  const { collapsed, setCollapsed, hardLogout, loading, emailLabel, statusPills, footer, content } =
    useSidebarData();

  return (
    <div className="sticky top-0 hidden md:block">
      <SidebarShell
        mobile={false}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={hardLogout}
        loading={loading}
        title="FollowerBooster"
        subtitle={emailLabel}
        statusPills={statusPills}
        footer={footer}
      >
        {content}
      </SidebarShell>
    </div>
  );
}

/* =========================
   Mobile drawer sidebar
========================= */
export function SidebarDrawer({ open, onClose }) {
  const { hardLogout, loading, emailLabel, statusPills, footer, content } =
    useSidebarData(onClose);

  return (
    <MobileDrawer open={open} onClose={onClose}>
      <SidebarShell
        mobile
        collapsed={false}
        setCollapsed={() => {}}
        onLogout={hardLogout}
        loading={loading}
        title="FollowerBooster"
        subtitle={emailLabel}
        statusPills={statusPills}
        footer={footer}
        onClose={onClose}
      >
        {content}
      </SidebarShell>
    </MobileDrawer>
  );
}
