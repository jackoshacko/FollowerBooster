import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  Settings,
  BadgeCheck,
  AlertCircle,
  Clock,
  ArrowUpRight,
  LifeBuoy,
  FileText,
  Mail,
} from "lucide-react";

import { api, setToken, setUser } from "../lib/api.js";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

function RenderIcon({ icon, className }) {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  const IconComp = icon;
  return <IconComp className={className || "h-4 w-4"} />;
}

function Badge({ children, tone = "zinc", title }) {
  const toneCls =
    tone === "red"
      ? "border-red-500/30 bg-red-500/10 text-red-100"
      : tone === "amber"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
      : tone === "blue"
      ? "border-blue-500/30 bg-blue-500/10 text-blue-100"
      : tone === "green"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      : "border-white/10 bg-white/5 text-zinc-100";

  return (
    <span
      title={title}
      className={cls(
        "ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        "backdrop-blur-xl",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

function Chip({ children, tone = "neutral", title }) {
  const tones = {
    neutral: "border-white/10 bg-white/5 text-zinc-100/85",
    ok: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
    warn: "border-amber-500/25 bg-amber-500/10 text-amber-100",
    bad: "border-red-500/25 bg-red-500/10 text-red-100",
    info: "border-sky-500/25 bg-sky-500/10 text-sky-100",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-100",
  };

  return (
    <span
      title={title}
      className={cls(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        "backdrop-blur-xl",
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
                "border-white/12 bg-white/10 text-white",
                "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_55px_rgba(168,85,247,0.26)]"
              )
            : cls(
                "border-transparent text-zinc-200/80",
                "hover:text-white hover:border-white/10 hover:bg-white/6"
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
              "pointer-events-none absolute inset-0",
              "bg-[radial-gradient(1200px_180px_at_10%_0%,rgba(255,255,255,0.10),transparent_60%)]",
              "transition",
              isActive ? "opacity-100" : "opacity-0"
            )}
          />

          <span
            className={cls(
              "grid h-9 w-9 place-items-center rounded-2xl border shrink-0 transition",
              "backdrop-blur-xl",
              isActive
                ? "border-white/14 bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_35px_rgba(168,85,247,0.20)]"
                : "border-white/10 bg-white/5 group-hover:bg-white/10"
            )}
          >
            <RenderIcon icon={icon} className="h-4 w-4 text-white/90" />
          </span>

          {!collapsed ? <span className="font-semibold tracking-tight">{label}</span> : null}
          {!collapsed && right ? right : null}

          <span
            className={cls(
              "pointer-events-none absolute -inset-10 opacity-0 transition",
              "bg-gradient-to-r from-white/0 via-white/10 to-white/0",
              "rotate-12",
              "group-hover:opacity-100"
            )}
          />
        </>
      )}
    </NavLink>
  );
}

function Section({ title, icon, collapsed, children }) {
  return (
    <div className="mt-5">
      {!collapsed ? (
        <div className="mb-2 flex items-center gap-2 px-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-100/80 backdrop-blur-xl">
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
}) {
  return (
    <aside
      className={cls(
        "relative p-4",
        mobile ? "h-[100dvh]" : "h-screen",
        mobile
          ? "border-r border-white/10 bg-zinc-950/95 backdrop-blur-2xl"
          : "border-r border-white/10 bg-black/35 backdrop-blur-xl",
        "shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]",
        "overflow-x-clip",
        collapsed ? "w-[98px]" : "w-[310px]"
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-purple-500/14 blur-3xl" />
        <div className="absolute -left-10 bottom-10 h-72 w-72 rounded-full bg-cyan-500/12 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_140px_at_18%_0%,rgba(255,255,255,0.10),transparent_70%)]" />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] shrink-0 backdrop-blur-xl">
            <span className="text-xs font-black tracking-tight text-white">FB</span>
          </div>

          {!collapsed ? (
            <div className="leading-tight min-w-0">
              <div className="text-sm font-extrabold tracking-tight text-white truncate">
                {title || "FollowerBooster"}
              </div>
              <div className="text-xs text-zinc-200/60 truncate">
                {loading ? "Loading…" : subtitle || "Authenticated"}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {!mobile ? (
            <button
              onClick={() => setCollapsed((v) => !v)}
              className={cls(
                "inline-flex items-center justify-center rounded-2xl p-2",
                "border border-white/10 bg-white/5 text-zinc-100/80 backdrop-blur-xl",
                "hover:bg-white/10 hover:text-white transition",
                "shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
              )}
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          ) : null}

          <button
            onClick={onLogout}
            className={cls(
              "inline-flex items-center justify-center rounded-2xl p-2",
              "border border-white/10 bg-white/5 text-zinc-100/80 backdrop-blur-xl",
              "hover:bg-white/10 hover:text-white transition"
            )}
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && statusPills ? <div className="mb-3 flex flex-wrap gap-2">{statusPills}</div> : null}

      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="mt-3 flex flex-col min-h-0">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
          {children}
        </div>
        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
    </aside>
  );
}

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

export default function Sidebar({ mobile = false, onClose }) {
  const navigate = useNavigate();
  const loc = useLocation();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sb_collapsed") === "1");

  const [me, setMe] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [myOrdersCount, setMyOrdersCount] = useState(null);

  const [walletSnap, setWalletSnap] = useState({ balance: null, currency: "EUR" });
  const [opsSnap, setOpsSnap] = useState({ active: null, pending: null, processing: null, failed: null });

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
    if (typeof onClose === "function") onClose();
    navigate("/login", { replace: true });
  }

  // ✅ if guest clicks protected routes: go login
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
      if (mobile && typeof onClose === "function") onClose();
      navigate("/login", { replace: true });
      return false;
    }
    return true;
  }

  const navClick = (to) => {
    if (!guard(to)) return;
    if (mobile && typeof onClose === "function") onClose();
  };

  // Load me only if token exists (prevents useless redirects when not logged)
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
        // only logout redirect inside app; sidebar is mostly used in app anyway
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
      const [orders, wallet] = await Promise.allSettled([api.get("/orders"), api.get("/wallet")]);

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
          balance: typeof w?.balance === "number" ? w.balance : Number(w?.balance ?? 0),
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

  async function loadAdminStats({ silent = false } = {}) {
    if (!isAdmin) return;
    try {
      const s = await api.get("/admin/stats");
      setAdminStats(s);
    } catch {
      if (!silent) setAdminStats(null);
    }
  }

  useEffect(() => {
    if (!me) return;
    let alive = true;
    (async () => {
      await loadSidebarMetrics();
      await loadAdminStats();
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
      loadAdminStats({ silent: true });
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

  const roleLabel = useMemo(() => {
    const r = String(me?.role || "customer").toUpperCase();
    return r === "ADMIN" ? "ADMIN" : authed ? "CUSTOMER" : "GUEST";
  }, [me, authed]);

  const pendingOrders = Number(adminStats?.ordersActive ?? adminStats?.pendingOrders ?? 0);
  const revenue30d = adminStats?.revenue30d ?? adminStats?.revenue ?? null;

  const walletTone = walletSnap.balance == null ? "neutral" : walletSnap.balance > 0 ? "ok" : "warn";
  const riskTone =
    (opsSnap.failed || 0) > 0 ? "bad" : (opsSnap.pending || 0) + (opsSnap.processing || 0) > 0 ? "warn" : "ok";

  const statusPills = (
    <>
      <Chip tone="violet" title="Premium UI mode">
        <Sparkles className="h-3.5 w-3.5" /> 2050
      </Chip>

      <Chip tone={walletTone} title="Wallet balance snapshot">
        <Wallet className="h-3.5 w-3.5" />{" "}
        {walletSnap.balance == null ? "Wallet —" : fmtMoney(walletSnap.balance, walletSnap.currency)}
      </Chip>

      <Chip tone={riskTone} title="Orders health (approx)">
        {(opsSnap.failed || 0) > 0 ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (opsSnap.pending || 0) + (opsSnap.processing || 0) > 0 ? (
          <Clock className="h-3.5 w-3.5" />
        ) : (
          <BadgeCheck className="h-3.5 w-3.5" />
        )}
        {riskTone === "ok" ? "Clean" : riskTone === "warn" ? "Active" : "Issues"}
      </Chip>

      <button
        type="button"
        onClick={() => setLive((v) => !v)}
        className={cls(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
          "backdrop-blur-xl transition",
          live
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
            : "border-white/10 bg-white/5 text-zinc-100/70 hover:bg-white/10"
        )}
        title="Toggle live polling"
      >
        <Bell className="h-3.5 w-3.5" /> {live ? "Live" : "Paused"}
      </button>
    </>
  );

  const footer = !collapsed ? (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-200/70 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-zinc-100 truncate">FollowerBooster</div>
            <Chip tone={roleLabel === "ADMIN" ? "info" : "neutral"}>{roleLabel}</Chip>
          </div>
          <div className="mt-1 text-[11px] text-zinc-200/60 truncate">
            {me?.email || (authed ? "Authenticated • Wallet-ready • Premium UI" : "Guest • Browse services")}
          </div>
        </div>

        <button
          onClick={() => (authed ? navigate("/wallet") : navigate("/login"))}
          className={cls(
            "inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold",
            "border border-white/10 bg-white/5 hover:bg-white/10 transition"
          )}
          title="Go to Wallet"
        >
          <ArrowUpRight className="h-4 w-4" /> {authed ? "Wallet" : "Login"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => (authed ? navigate("/create-order") : navigate("/login"))}
          className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-semibold text-white hover:bg-white/15 transition"
        >
          {authed ? "Create order" : "Sign in"}
        </button>
        <button
          onClick={() => navigate("/services")}
          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/90 hover:bg-white/10 transition"
        >
          Services
        </button>
      </div>

      {isAdmin ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-zinc-200/70">Admin (30d)</div>
            <Chip tone="neutral">
              <BarChart3 className="h-3.5 w-3.5" />{" "}
              {revenue30d != null ? `${Number(revenue30d).toFixed?.(2) ?? revenue30d} EUR` : "—"}
            </Chip>
          </div>
        </div>
      ) : null}
    </div>
  ) : (
    <div className="mt-3 flex justify-center">
      <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl" />
    </div>
  );

  const content = (
    <>
      {/* ✅ GUEST CAN SEE SERVICES ALWAYS */}
      <Section title="Browse" icon={Sparkles} collapsed={collapsed}>
        <Item to="/services" icon={ListChecks} label="Services" collapsed={collapsed} onClick={() => navClick("/services")} />
      </Section>

      {/* ✅ Protected section (requires login) */}
      <Section title="User" icon={Shield} collapsed={collapsed}>
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
          right={
            authed && myOrdersCount !== null ? (
              <Badge
                title="Your orders"
                tone={(opsSnap.failed || 0) > 0 ? "red" : (opsSnap.active || 0) > 0 ? "amber" : "zinc"}
              >
                {myOrdersCount}
              </Badge>
            ) : null
          }
        />

        <Item
          to={authed ? "/wallet" : "/login"}
          icon={Wallet}
          label="Wallet"
          collapsed={collapsed}
          onClick={() => navClick("/wallet")}
          right={
            authed && !collapsed && walletSnap.balance != null ? (
              <Badge title="Balance" tone={walletSnap.balance > 0 ? "green" : "amber"}>
                {fmtMoney(walletSnap.balance, walletSnap.currency)}
              </Badge>
            ) : null
          }
        />
      </Section>

      {/* Account card only if authed */}
      {authed ? (
        <Section title="Account" icon={Settings} collapsed={collapsed}>
          <div
            className={cls(
              "rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-100/75 backdrop-blur-xl",
              collapsed ? "hidden" : ""
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-white/90 truncate">{emailLabel}</div>
                <div className="mt-0.5 text-[11px] text-zinc-200/60">Role: {roleLabel}</div>
              </div>
              <button
                onClick={hardLogout}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/90 hover:bg-white/10 transition"
                title="Logout"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </div>
        </Section>
      ) : null}

      {/* Admin only */}
      {authed && isAdmin ? (
        <Section title="Admin" icon={Wrench} collapsed={collapsed}>
          <Item to="/admin/dashboard" icon={BarChart3} label="Dashboard" collapsed={collapsed} onClick={() => navClick("/admin/dashboard")} />
          <Item to="/admin/services" icon={Wrench} label="Services" collapsed={collapsed} onClick={() => navClick("/admin/services")} />
          <Item to="/admin/users" icon={Users} label="Users" collapsed={collapsed} onClick={() => navClick("/admin/users")} />

          <Item
            to="/admin/orders"
            icon={ListChecks}
            label="Orders"
            collapsed={collapsed}
            onClick={() => navClick("/admin/orders")}
            right={
              Number.isFinite(pendingOrders) && pendingOrders > 0 ? (
                <Badge tone="amber" title="Pending/Processing orders">
                  {pendingOrders}
                </Badge>
              ) : (
                <Badge title="Pending/Processing orders">0</Badge>
              )
            }
          />

          <Item to="/admin/transactions" icon={Receipt} label="Transactions" collapsed={collapsed} onClick={() => navClick("/admin/transactions")} />
        </Section>
      ) : null}

      {/* ✅ Support + Legal (available to everyone) */}
      <Section title="Support" icon={LifeBuoy} collapsed={collapsed}>
        <Item to="/faq" icon={Bell} label="Help / FAQ" collapsed={collapsed} onClick={() => navClick("/faq")} />
        <Item to="/contact" icon={Mail} label="Contact" collapsed={collapsed} onClick={() => navClick("/contact")} />
      </Section>

      <Section title="Legal" icon={FileText} collapsed={collapsed}>
        <Item to="/terms" icon={Receipt} label="Terms" collapsed={collapsed} onClick={() => navClick("/terms")} />
        <Item to="/privacy" icon={Shield} label="Privacy" collapsed={collapsed} onClick={() => navClick("/privacy")} />
        <Item to="/refund" icon={AlertCircle} label="Refunds" collapsed={collapsed} onClick={() => navClick("/refund")} />
      </Section>
    </>
  );

  if (!mobile) {
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

  return (
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
    >
      {content}
    </SidebarShell>
  );
}


