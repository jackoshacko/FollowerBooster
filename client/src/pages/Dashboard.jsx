// client/src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import {
  RefreshCcw,
  Activity,
  Wallet,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  ExternalLink,
  Sparkles,
  Zap,
  TrendingUp,
  Layers,
  ShieldCheck,
  Boxes,
  SlidersHorizontal,
  Search,
  X,
  Lock,
  FileText,
  Shield,
} from "lucide-react";

import bgSmm2 from "../assets/backgroundsmm2.jpg";

/* =========================
   Helpers
========================= */
function cn(...a) {
  return a.filter(Boolean).join(" ");
}
function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}
function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}
function fmtMoney(n, currency = "EUR") {
  const v = safeNum(n, 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${round2(v)} ${currency}`;
  }
}
function fmtInt(n) {
  const v = Math.round(safeNum(n, 0));
  try {
    return new Intl.NumberFormat(undefined).format(v);
  } catch {
    return String(v);
  }
}
function fmtPct(n) {
  const v = safeNum(n, 0);
  return `${Math.round(v * 10) / 10}%`;
}
function shortId(id) {
  const s = String(id || "");
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
function relTime(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return String(iso);
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 30) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  return `${day}d ago`;
}
async function copyText(s) {
  try {
    await navigator.clipboard.writeText(String(s ?? ""));
    return true;
  } catch {
    return false;
  }
}

/** ===== status normalize (dashboard vs orders page) ===== */
function normalizeStatus(raw) {
  const x = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_");

  if (["completed", "success", "successful", "done", "finished", "complete"].includes(x)) return "completed";
  if (["failed", "fail", "error"].includes(x)) return "failed";
  if (["canceled", "cancelled", "refunded", "refund"].includes(x)) return "failed";
  if (["pending", "queued", "queue", "waiting", "created", "new"].includes(x)) return "pending";
  if (["processing", "in_progress", "inprogress", "active", "progress", "running", "partial"].includes(x))
    return "processing";
  return x || "processing";
}

function make7dLabelsUTC(now = new Date()) {
  const labels = [];
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 6);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    labels.push(`${y}-${m}-${dd}`);
  }
  return labels;
}
function dayKeyUTC(dateLike) {
  const d = new Date(dateLike);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/* =========================
   UI Primitives
========================= */
function Card({ title, right, icon: Icon, children, className }) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl",
        "border border-white/10",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.45)]",
        "transition-transform duration-200 hover:scale-[1.01]",
        "hover:border-white/15",
        className
      )}
    >
      {/* IMPORTANT: pointer-events-none overlay, so it never blocks scroll/touch */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.22] transition-opacity duration-200 group-hover:opacity-[0.28]"
          style={{ backgroundImage: `url(${bgSmm2})` }}
        />
        <div className="absolute inset-0 bg-black/35 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
      </div>

      <div className="relative p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {Icon ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-100/90">
                <Icon className="h-4 w-4" />
              </div>
            ) : null}
            <div className="text-sm text-zinc-200/80">{title}</div>
          </div>
          {right ? <div className="text-xs text-zinc-200/60">{right}</div> : null}
        </div>

        <div className="text-white">{children}</div>
      </div>
    </div>
  );
}

function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-lg bg-white/10", className)} />;
}

function Chip({ children, tone = "neutral", className = "" }) {
  const tones = {
    neutral: "border-white/10 bg-white/5 text-zinc-100",
    ok: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
    warn: "border-amber-500/20 bg-amber-500/10 text-amber-100",
    bad: "border-red-500/20 bg-red-500/10 text-red-100",
    info: "border-sky-500/20 bg-sky-500/10 text-sky-100",
    violet: "border-violet-500/20 bg-violet-500/10 text-violet-100",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
        tones[tone] || tones.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}

function Divider() {
  return <div className="my-3 h-px w-full bg-white/10" />;
}

function KpiValue({ loading, value, sub, trend }) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-3 w-28" />
      </div>
    );
  }

  const trendTone = trend == null ? "neutral" : trend > 0 ? "ok" : trend < 0 ? "bad" : "neutral";

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="text-3xl font-black tracking-tight">{value}</div>
        {trend != null ? (
          <Chip tone={trendTone}>
            {trend > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
            {trend < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
            {Math.abs(trend).toFixed(1)}%
          </Chip>
        ) : null}
      </div>
      {sub ? <div className="mt-1 text-xs text-zinc-100/60">{sub}</div> : null}
    </div>
  );
}

function MiniBars({ data, height = 52 }) {
  const max = Math.max(1, ...data.map((x) => safeNum(x, 0)));
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((v, i) => {
        const n = safeNum(v, 0);
        const h = Math.max(2, Math.round((n / max) * height));
        return (
          <div
            key={i}
            className="w-2.5 rounded-t bg-white/15 hover:bg-white/25 transition"
            style={{ height: h }}
            title={`${n}`}
          />
        );
      })}
    </div>
  );
}

function RowItem({ left, right, onCopy, onOpen }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3",
        "backdrop-blur-xl transition hover:bg-white/10",
        // mobile scroll fix: make sure row doesn't capture pan gestures weirdly
        "touch-pan-y"
      )}
    >
      <div className="min-w-0">{left}</div>
      <div className="flex shrink-0 items-center gap-2">
        {right ? <div className="text-sm font-semibold text-white">{right}</div> : null}
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-100/80 hover:bg-white/10"
            title="Copy"
          >
            <Copy className="h-4 w-4" />
          </button>
        ) : null}
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-100/80 hover:bg-white/10"
            title="Open"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Masonry Safe:
 * - Mobile: GRID (no columns) => no “tap to scroll”
 * - Desktop: CSS columns masonry
 */
function Masonry({ children }) {
  return (
    <div className="masonrySafe">
      {React.Children.map(children, (child, idx) => (
        <div key={idx} className="masonryItem">
          {child}
        </div>
      ))}
    </div>
  );
}

const initial = {
  loading: true,
  error: "",
  lastUpdatedAt: null,

  currency: "EUR",
  balance: 0,

  activeOrders: 0,
  pendingOrders: 0,
  processingOrders: 0,
  completedOrders: 0,
  failedOrders: 0,

  spent30d: 0,
  spentAllTime: 0,

  successRate7d: null,
  avgFulfillMins7d: null,

  lastTopups: [],
  lastOrders: [],

  series7d: { labels: [], orders: [], topups: [] },

  provider: null,
  topServices: null,
};

export default function Dashboard() {
  const [s, setS] = useState(initial);

  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshEvery, setRefreshEvery] = useState(12);

  const [search, setSearch] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);

  // scroll fix helper: force page to be scroll container
  // (prevents nested scroll issues when layout has overflow hidden)
  useEffect(() => {
    const prev = document.body.style.overscrollBehaviorY;
    document.body.style.overscrollBehaviorY = "none";
    return () => {
      document.body.style.overscrollBehaviorY = prev;
    };
  }, []);

  function showToast(msg) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1400);
  }

  /** ===== fallback: compute live metrics from /orders ===== */
  async function buildFallbackFromOrders(currencyGuess = "EUR") {
    const list = await api.get("/orders").catch(() => []);
    const orders = Array.isArray(list) ? list : [];

    const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
    const labels = make7dLabelsUTC(new Date());
    const dayMap = new Map(labels.map((l) => [l, 0]));

    for (const o of orders) {
      const st = normalizeStatus(o?.status || o?.providerStatus);
      if (st === "pending") counts.pending += 1;
      else if (st === "processing") counts.processing += 1;
      else if (st === "completed") counts.completed += 1;
      else if (st === "failed") counts.failed += 1;

      const k = dayKeyUTC(o?.createdAt || o?.created_at);
      if (k && dayMap.has(k)) dayMap.set(k, (dayMap.get(k) || 0) + 1);
    }

    const seriesOrders = labels.map((l) => dayMap.get(l) || 0);

    const recentOrders = orders
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 12)
      .map((o) => ({
        id: String(o._id || o.id || ""),
        status: normalizeStatus(o.status || o.providerStatus),
        quantity: safeNum(o.quantity, 0),
        total: round2(safeNum(o.total ?? o.price ?? o.amount ?? o.cost ?? 0)),
        currency: String(o.currency || currencyGuess).toUpperCase(),
        serviceName: o.serviceName || o.serviceId?.name || o.service?.name || "Service",
        link: o.link || o.url || "",
        createdAt: o.createdAt,
        providerOrderId: o.providerOrderId || "",
      }));

    return {
      counts,
      series7dOrders: { labels, orders: seriesOrders },
      recentOrders,
    };
  }

  async function load({ silent = false } = {}) {
    setS((p) => ({ ...p, loading: !silent, error: "" }));

    try {
      const d = await api.get("/api/dashboard");

      const nextCurrency = String(d.currency || s.currency || "EUR").toUpperCase();

      const pendingOrders = d.pendingOrders;
      const processingOrders = d.processingOrders;
      const completedOrders = d.completedOrders;
      const failedOrders = d.failedOrders;

      const hasOrderBreakdown =
        pendingOrders != null || processingOrders != null || completedOrders != null || failedOrders != null;

      const series7d = d.series7d || { labels: [], orders: [], topups: [] };
      const seriesOrdersLen = Array.isArray(series7d?.orders) ? series7d.orders.length : 0;

      let fallback = null;
      if (!hasOrderBreakdown || seriesOrdersLen !== 7) {
        fallback = await buildFallbackFromOrders(nextCurrency);
      }

      const fbCounts = fallback?.counts || {};
      const computedPending = safeNum(pendingOrders ?? fbCounts.pending ?? 0);
      const computedProcessing = safeNum(processingOrders ?? fbCounts.processing ?? 0);
      const computedCompleted = safeNum(completedOrders ?? fbCounts.completed ?? 0);
      const computedFailed = safeNum(failedOrders ?? fbCounts.failed ?? 0);

      const computedActive = d.activeOrders != null ? safeNum(d.activeOrders, 0) : computedPending + computedProcessing;

      const mergedSeries7d = {
        labels:
          Array.isArray(series7d?.labels) && series7d.labels.length === 7
            ? series7d.labels
            : fallback?.series7dOrders?.labels || make7dLabelsUTC(new Date()),
        orders:
          Array.isArray(series7d?.orders) && series7d.orders.length === 7
            ? series7d.orders
            : fallback?.series7dOrders?.orders || [0, 0, 0, 0, 0, 0, 0],
        topups:
          Array.isArray(series7d?.topups) && series7d.topups.length === 7
            ? series7d.topups
            : [0, 0, 0, 0, 0, 0, 0],
      };

      const lastOrders = Array.isArray(d.lastOrders) && d.lastOrders.length ? d.lastOrders : fallback?.recentOrders || [];

      setS((p) => ({
        ...p,
        loading: false,
        error: "",
        lastUpdatedAt: new Date().toISOString(),

        balance: safeNum(d.balance ?? p.balance ?? 0),
        currency: nextCurrency,

        activeOrders: computedActive,
        pendingOrders: computedPending,
        processingOrders: computedProcessing,
        completedOrders: computedCompleted,
        failedOrders: computedFailed,

        spent30d: safeNum(d.spent30d ?? p.spent30d ?? 0),
        spentAllTime: safeNum(d.spentAllTime ?? p.spentAllTime ?? 0),

        successRate7d: d.successRate7d == null ? p.successRate7d : safeNum(d.successRate7d),
        avgFulfillMins7d: d.avgFulfillMins7d == null ? p.avgFulfillMins7d : safeNum(d.avgFulfillMins7d),

        lastTopups: Array.isArray(d.lastTopups) ? d.lastTopups : p.lastTopups || [],
        lastOrders,

        series7d: mergedSeries7d,

        provider: d.provider ?? p.provider ?? null,
        topServices: d.topServices ?? p.topServices ?? null,
      }));
    } catch (e) {
      setS((p) => ({
        ...p,
        loading: false,
        error: e?.message || "Failed to load dashboard.",
      }));
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;
      await load();
    })();

    function onVis() {
      if (document.visibilityState === "visible") load({ silent: true });
    }
    function onFocus() {
      load({ silent: true });
    }

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const ms = Math.max(6, Number(refreshEvery || 12)) * 1000;
    const t = setInterval(() => load({ silent: true }), ms);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refreshEvery]);

  const currency = s.currency || "EUR";
  const loading = s.loading;

  const ordersBars = useMemo(() => {
    const arr = s.series7d?.orders || [];
    return arr.length ? arr : [0, 0, 0, 0, 0, 0, 0];
  }, [s.series7d]);

  const topupsBars = useMemo(() => {
    const arr = s.series7d?.topups || [];
    return arr.length ? arr : [0, 0, 0, 0, 0, 0, 0];
  }, [s.series7d]);

  const orders7dTotal = useMemo(() => ordersBars.reduce((a, b) => a + safeNum(b, 0), 0), [ordersBars]);
  const topups7dTotal = useMemo(() => topupsBars.reduce((a, b) => a + safeNum(b, 0), 0), [topupsBars]);

  const health = useMemo(() => {
    const failed = safeNum(s.failedOrders, 0);
    const pending = safeNum(s.pendingOrders, 0);
    const processing = safeNum(s.processingOrders, 0);

    const riskScore =
      failed * 2 + Math.max(0, pending - 5) * 0.5 + Math.max(0, processing - 10) * 0.3;

    const tone = riskScore === 0 ? "ok" : riskScore < 4 ? "warn" : "bad";
    const msg = tone === "ok" ? "Clean run" : tone === "warn" ? "Watch list" : "Needs attention";
    return { tone, msg, riskScore: Math.round(riskScore * 10) / 10 };
  }, [s.failedOrders, s.pendingOrders, s.processingOrders]);

  const statusBadges = useMemo(() => {
    const pending = safeNum(s.pendingOrders, 0);
    const processing = safeNum(s.processingOrders, 0);
    const completed = safeNum(s.completedOrders, 0);
    const failed = safeNum(s.failedOrders, 0);

    const any = pending || processing || completed || failed;

    if (!any) {
      return [
        <Chip key="a" tone="info">
          <Activity className="h-3.5 w-3.5" /> Active: {fmtInt(s.activeOrders)}
        </Chip>,
      ];
    }

    return [
      <Chip key="p" tone="warn">
        <Clock className="h-3.5 w-3.5" /> Pending: {fmtInt(pending)}
      </Chip>,
      <Chip key="pr" tone="info">
        <Activity className="h-3.5 w-3.5" /> Processing: {fmtInt(processing)}
      </Chip>,
      <Chip key="c" tone="ok">
        <CheckCircle2 className="h-3.5 w-3.5" /> Completed: {fmtInt(completed)}
      </Chip>,
      <Chip key="f" tone={failed ? "bad" : "neutral"}>
        <AlertCircle className="h-3.5 w-3.5" /> Failed: {fmtInt(failed)}
      </Chip>,
    ];
  }, [s.activeOrders, s.pendingOrders, s.processingOrders, s.completedOrders, s.failedOrders]);

  const realtimeLabel = useMemo(() => {
    if (!s.lastUpdatedAt) return "—";
    return `Updated ${relTime(s.lastUpdatedAt)}`;
  }, [s.lastUpdatedAt]);

  const totalOrdersSnapshot = useMemo(() => {
    return safeNum(s.completedOrders, 0) + safeNum(s.failedOrders, 0) + safeNum(s.pendingOrders, 0) + safeNum(s.processingOrders, 0);
  }, [s.completedOrders, s.failedOrders, s.pendingOrders, s.processingOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = Array.isArray(s.lastOrders) ? s.lastOrders : [];

    return base.filter((o) => {
      const status = String(o.status || "—").toLowerCase();
      const name = String(o.serviceName || o.service?.name || o.name || "Service").toLowerCase();
      const link = String(o.link || o.url || "").toLowerCase();

      const matchesQ = !q || name.includes(q) || status.includes(q) || link.includes(q);
      const matchesProblems = !onlyProblems || ["failed", "pending"].includes(status);

      return matchesQ && matchesProblems;
    });
  }, [s.lastOrders, search, onlyProblems]);

  const filteredTopups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = Array.isArray(s.lastTopups) ? s.lastTopups : [];
    return base.filter((t) => {
      const provider = String(t.provider || "topup").toLowerCase();
      const status = String(t.status || "—").toLowerCase();
      const id = String(t.id || t._id || "").toLowerCase();
      return !q || provider.includes(q) || status.includes(q) || id.includes(q);
    });
  }, [s.lastTopups, search]);

  return (
    <div className="space-y-5">
      {/* ===== MOBILE SCROLL + MASONRY SAFE CSS ===== */}
      <style>{`
        /* Never let overlays block touch */
        .noTouchBlock, .noTouchBlock * { touch-action: pan-y; }

        /* Mobile-first: GRID (no columns) => fixes “tap to scroll” on phones */
        .masonrySafe{
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          touch-action: pan-y;
        }
        .masonryItem{ break-inside: avoid; }

        /* Desktop: columns masonry */
        @media (min-width: 768px){
          .masonrySafe{
            display: block;
            column-gap: 1rem;
            column-count: 2;
          }
          .masonryItem{
            display: inline-block;
            width: 100%;
            margin: 0 0 1rem 0;
          }
        }
        @media (min-width: 1024px){ .masonrySafe{ column-count: 3; } }
        @media (min-width: 1536px){ .masonrySafe{ column-count: 4; } }
      `}</style>

      {/* Toast: pointer-events-none so it NEVER blocks scroll */}
      {toast ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-sm text-zinc-100 backdrop-blur-xl shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
          {toast}
        </div>
      ) : null}

      {/* HEADER */}
      <div className="noTouchBlock flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-3xl font-black tracking-tight md:text-4xl">Dashboard</div>
            <Chip tone={autoRefresh ? "ok" : "neutral"} className="ml-1">
              <Sparkles className="h-3.5 w-3.5" />
              {autoRefresh ? "Live" : "Paused"}
            </Chip>
            <Chip tone="violet">
              <Zap className="h-3.5 w-3.5" /> 2050 Mode
            </Chip>
            <Chip tone="info">
              <Lock className="h-3.5 w-3.5" /> Protected
            </Chip>
          </div>

          <div className="mt-1 text-sm text-zinc-100/70">
            Balance, orders, spend, ops & intelligence — ultra clean panel.
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone="info">
              <Wallet className="h-3.5 w-3.5" /> Wallet-ready
            </Chip>
            <Chip tone={health.tone}>
              <ShieldCheck className="h-3.5 w-3.5" /> {health.msg} (risk {health.riskScore})
            </Chip>
            <Chip tone="neutral">{realtimeLabel}</Chip>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">{statusBadges}</div>
        </div>

        <div className="flex flex-col items-stretch gap-2 lg:items-end">
          {/* ACTIONS */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                load();
                showToast("Refreshing…");
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100",
                "hover:bg-white/10",
                "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_12px_30px_rgba(0,0,0,0.35)]"
              )}
            >
              <RefreshCcw className="h-4 w-4" /> Refresh
            </button>

            {/* IMPORTANT: Link (no full reload) */}
            <Link
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100",
                "hover:bg-white/10"
              )}
              to="/wallet"
            >
              <Wallet className="h-4 w-4" /> Wallet
            </Link>

            <Link
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-semibold text-white",
                "hover:bg-white/20",
                "shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_rgba(56,189,248,0.16)]"
              )}
              to="/create-order"
            >
              <ShoppingCart className="h-4 w-4" /> Create order
            </Link>

            <Link
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100",
                "hover:bg-white/10"
              )}
              to="/services"
            >
              <Layers className="h-4 w-4" /> Services
            </Link>
          </div>

          {/* CONTROLS */}
          <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
            <button
              onClick={() => setAutoRefresh((x) => !x)}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-100/90 hover:bg-white/10"
            >
              {autoRefresh ? "Pause live" : "Resume live"}
            </button>

            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-100/80">
              <span className="opacity-80">Every</span>
              <select
                value={refreshEvery}
                onChange={(e) => setRefreshEvery(Number(e.target.value))}
                className="bg-transparent outline-none"
              >
                <option value={6}>6s</option>
                <option value={12}>12s</option>
                <option value={20}>20s</option>
                <option value={35}>35s</option>
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-100/80">
              <Search className="h-4 w-4 opacity-80" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search orders/topups…"
                className="w-44 bg-transparent text-xs outline-none placeholder:text-zinc-100/40"
              />
              {search ? (
                <button onClick={() => setSearch("")} className="rounded-lg p-1 hover:bg-white/10" title="Clear">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <button
              onClick={() => setOnlyProblems((x) => !x)}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-1.5 text-xs",
                onlyProblems ? "bg-red-500/15 text-red-100" : "bg-white/5 text-zinc-100/80",
                "hover:bg-white/10"
              )}
              title="Show only pending/failed"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Problems
            </button>
          </div>
        </div>
      </div>

      {/* ERROR */}
      {s.error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 backdrop-blur-xl">
          <div className="text-sm text-red-200">⚠️ {s.error}</div>
          <button
            onClick={() => load()}
            className="mt-3 rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-100 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* GRID / MASONRY */}
      <Masonry>
        <Card title="Wallet intelligence" right={loading ? "" : "Realtime"} icon={Wallet} className="min-h-[210px]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="text-4xl font-black tracking-tight">{loading ? "—" : fmtMoney(s.balance, currency)}</div>
              <div className="flex flex-wrap gap-2">
                <Chip tone="info">
                  <Boxes className="h-3.5 w-3.5" /> Orders snapshot: {fmtInt(totalOrdersSnapshot)}
                </Chip>
                <Chip tone="neutral">Currency: {currency}</Chip>
              </div>
            </div>

            <div className="text-sm text-zinc-100/70">
              Wallet funds are used instantly at checkout. Top up & place orders in seconds.
            </div>

            <Divider />

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-zinc-100/60">Spent 30d</div>
                <div className="mt-1 text-lg font-bold">{loading ? "—" : fmtMoney(s.spent30d, currency)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-zinc-100/60">All-time spend</div>
                <div className="mt-1 text-lg font-bold">{loading ? "—" : fmtMoney(s.spentAllTime, currency)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-zinc-100/60">Protection</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Chip tone="info">
                    <Shield className="h-3.5 w-3.5" /> Rate limited
                  </Chip>
                  <Chip tone="neutral">
                    <Lock className="h-3.5 w-3.5" /> Token auth
                  </Chip>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Orders live" right={loading ? "" : "Now"} icon={Activity}>
          <KpiValue loading={loading} value={loading ? "" : fmtInt(s.activeOrders)} sub="Pending/processing orders right now." />
          <Divider />
          <div className="flex flex-wrap gap-2 text-xs">
            <Chip tone="warn">Pending {fmtInt(s.pendingOrders)}</Chip>
            <Chip tone="info">Processing {fmtInt(s.processingOrders)}</Chip>
            <Chip tone={s.failedOrders ? "bad" : "neutral"}>Failed {fmtInt(s.failedOrders)}</Chip>
          </div>
        </Card>

        <Card title="Quality (7d)" right={loading ? "" : "Success + speed"} icon={ShieldCheck}>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-44" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-zinc-100/60">Success rate</div>
                  <div className="text-3xl font-black tracking-tight">
                    {s.successRate7d == null ? "—" : fmtPct(s.successRate7d)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-100/60 text-right">Avg fulfill</div>
                  <div className="text-3xl font-black tracking-tight text-right">
                    {s.avgFulfillMins7d == null ? "—" : `${Math.round(s.avgFulfillMins7d)}m`}
                  </div>
                </div>
              </div>

              <div className="text-xs text-zinc-100/60">
                7-day performance estimate. For scaling decisions.
              </div>

              <div className="flex flex-wrap gap-2">
                <Chip tone={health.tone}>{health.msg}</Chip>
                <Chip tone="neutral">Updated: {relTime(s.lastUpdatedAt)}</Chip>
              </div>
            </div>
          )}
        </Card>

        <Card title="Completed" right={loading ? "" : "Snapshot"} icon={CheckCircle2}>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
          ) : (
            <>
              <div className="text-3xl font-black tracking-tight">{fmtInt(s.completedOrders)}</div>
              <div className="mt-1 text-xs text-zinc-100/60">Completed orders.</div>
              <Divider />
              <div className="flex flex-wrap gap-2">
                <Chip tone={s.failedOrders ? "bad" : "neutral"}>Failed {fmtInt(s.failedOrders)}</Chip>
                <Chip tone="info">In progress {fmtInt(s.pendingOrders + s.processingOrders)}</Chip>
                <Chip tone="neutral">Total {fmtInt(totalOrdersSnapshot)}</Chip>
              </div>
            </>
          )}
        </Card>

        <Card title="Orders (7d)" right={loading ? "" : "Daily count"} className="overflow-hidden" icon={TrendingUp}>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-3xl font-black tracking-tight">{fmtInt(orders7dTotal)}</div>
                <div className="text-xs text-zinc-100/60">Total orders in last 7 days</div>
              </div>
              <MiniBars data={ordersBars} />
            </div>
          )}
        </Card>

        <Card title="Topups (7d)" right={loading ? "" : `Daily ${currency}`} className="overflow-hidden" icon={Wallet}>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-3xl font-black tracking-tight">{fmtMoney(topups7dTotal, currency)}</div>
                <div className="text-xs text-zinc-100/60">Total topups in last 7 days</div>
              </div>
              <MiniBars data={topupsBars} />
            </div>
          )}
        </Card>

        <Card title="Ops control" right={autoRefresh ? "Live polling" : "Paused"} icon={Zap}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Chip tone={autoRefresh ? "ok" : "neutral"}>
                <Sparkles className="h-3.5 w-3.5" /> {autoRefresh ? "Live mode" : "Paused"}
              </Chip>
              <Chip tone="neutral">{realtimeLabel}</Chip>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-100/60">Polling interval</div>
                <div className="text-sm font-semibold">{refreshEvery}s</div>
              </div>
              <div className="mt-2 text-xs text-zinc-100/60">
                Later: swap polling for realtime events.
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Link to="/wallet" className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm hover:bg-white/10">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  <span className="font-semibold">Top up</span>
                </div>
                <div className="mt-1 text-xs text-zinc-100/60">Add funds & keep orders flowing.</div>
              </Link>

              <Link to="/create-order" className="rounded-2xl border border-white/10 bg-white/10 p-3 text-sm hover:bg-white/15">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="font-semibold">Create order</span>
                </div>
                <div className="mt-1 text-xs text-zinc-100/60">Buy in seconds with wallet.</div>
              </Link>
            </div>
          </div>
        </Card>

        {s.provider ? (
          <Card title="Provider snapshot" right="Backend optional" icon={Boxes}>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="info">{s.provider?.name || "provider"}</Chip>
                <Chip tone="neutral">balance</Chip>
              </div>
              <div className="text-3xl font-black tracking-tight">{fmtMoney(s.provider?.balance ?? 0, s.provider?.currency || currency)}</div>
              <div className="text-xs text-zinc-100/60">Optional backend enrichment (safe).</div>
            </div>
          </Card>
        ) : null}

        {Array.isArray(s.topServices) && s.topServices.length ? (
          <Card title="Top services" right="Last 30d" icon={Layers}>
            <div className="space-y-2">
              {s.topServices.slice(0, 6).map((x, i) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{x.name}</div>
                    <div className="text-xs text-zinc-100/60">{fmtInt(x.count)} orders</div>
                  </div>
                  <div className="text-sm font-bold">{fmtMoney(x.spend ?? 0, currency)}</div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card title="Last topups" right={loading ? "" : "Latest"} icon={Wallet}>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredTopups.length ? (
            <div className="space-y-2">
              {filteredTopups.slice(0, 10).map((t) => {
                const id = t.id || t._id;
                const provider = t.provider || "topup";
                const status = String(t.status || "—");
                const created = t.createdAt || t.created_at || t.time;
                const amount = safeNum(t.amount, 0);
                const cur = t.currency || currency;

                const st = status.toLowerCase();
                const tone =
                  st.includes("confirm") || st.includes("success") ? "ok" : st.includes("pend") ? "warn" : st.includes("fail") ? "bad" : "neutral";

                return (
                  <RowItem
                    key={String(id)}
                    left={
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone="neutral">{provider}</Chip>
                          <Chip tone={tone}>{status}</Chip>
                          <span className="text-xs text-zinc-100/60">{created ? relTime(created) : ""}</span>
                        </div>
                        <div className="mt-1 text-xs text-zinc-100/60">
                          ID: <span className="text-zinc-100/80">{shortId(id)}</span>
                        </div>
                      </div>
                    }
                    right={`+ ${fmtMoney(amount, cur)}`}
                    onCopy={
                      id
                        ? async () => {
                            const ok = await copyText(id);
                            showToast(ok ? "Copied topup id" : "Copy failed");
                          }
                        : null
                    }
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-zinc-100/60">No topups yet. Go to Wallet and top up.</div>
          )}
        </Card>

        <Card title="Recent orders" right={loading ? "" : "Latest"} icon={ShoppingCart}>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredOrders.length ? (
            <div className="space-y-2">
              {filteredOrders.slice(0, 10).map((o) => {
                const id = o.id || o._id;
                const status = String(o.status || "—").toLowerCase();
                const created = o.createdAt || o.created_at || o.time;
                const serviceName = o.serviceName || o.service?.name || o.name || "Service";
                const qty = o.quantity ?? o.qty ?? "—";
                const total = o.total ?? o.price ?? 0;
                const link = o.link || o.url || "";

                const tone =
                  status === "completed" || status === "success"
                    ? "ok"
                    : status === "processing"
                    ? "info"
                    : status === "pending"
                    ? "warn"
                    : status === "failed"
                    ? "bad"
                    : "neutral";

                return (
                  <RowItem
                    key={String(id)}
                    left={
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone={tone}>{status}</Chip>
                          <span className="truncate text-sm text-zinc-100">{serviceName}</span>
                        </div>
                        <div className="mt-1 text-xs text-zinc-100/60">
                          {created ? relTime(created) : ""} • qty {qty} • ID {shortId(id)}
                        </div>
                      </div>
                    }
                    right={fmtMoney(total, currency)}
                    onCopy={
                      id
                        ? async () => {
                            const ok = await copyText(id);
                            showToast(ok ? "Copied order id" : "Copy failed");
                          }
                        : null
                    }
                    onOpen={link ? () => window.open(link, "_blank", "noopener,noreferrer") : null}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-zinc-100/60">No orders yet. Create your first order.</div>
          )}
        </Card>
      </Masonry>

      {/* LEGAL / PROTECTED FOOTER (safe wording, looks pro) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-zinc-100/70 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="info">
            <Lock className="h-3.5 w-3.5" /> Protected dashboard
          </Chip>
          <Chip tone="neutral">
            <Shield className="h-3.5 w-3.5" /> Abuse prevention (rate limiting)
          </Chip>
          <Chip tone="neutral">
            <FileText className="h-3.5 w-3.5" /> Policies
          </Chip>
        </div>

        <div className="mt-2 leading-relaxed">
          Access to this panel is restricted to authenticated users. Payments and top-ups are processed by supported providers.
          We store only the minimum required data for account access and order processing. For details, see our policy pages.
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <Link className="underline decoration-white/20 hover:decoration-white/50" to="/terms">
            Terms
          </Link>
          <Link className="underline decoration-white/20 hover:decoration-white/50" to="/privacy">
            Privacy
          </Link>
          <Link className="underline decoration-white/20 hover:decoration-white/50" to="/refund">
            Refunds
          </Link>
          <span className="text-zinc-100/50">•</span>
          <span className="text-zinc-100/50">2050 Masonry ✅</span>
        </div>
      </div>

      <div className="text-[11px] text-zinc-100/45">
        Tip: Mobile scroll is fixed by using grid on small screens (no CSS columns). Desktop keeps masonry columns.
      </div>
    </div>
  );
}

