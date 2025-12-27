// client/src/pages/Orders.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import {
  Search,
  Filter,
  Copy,
  ExternalLink,
  RefreshCcw,
  X,
  Info,
  Clock,
  Hash,
  Euro,
  Link as LinkIcon,
  Layers,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Activity,
} from "lucide-react";

/* =========================
   Helpers
========================= */

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function money2(n) {
  return (Math.round(safeNum(n, 0) * 100) / 100).toFixed(2);
}

function fmtInt(n) {
  const x = safeNum(n, 0);
  try {
    return Math.round(x).toLocaleString();
  } catch {
    return String(Math.round(x));
  }
}

function cap(s) {
  if (!s) return "";
  const t = String(s);
  return t.slice(0, 1).toUpperCase() + t.slice(1);
}

function shortId(id) {
  if (!id) return "—";
  const s = String(id);
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (["completed", "success", "done"].includes(s)) return "ok";
  if (["processing", "inprogress", "in_progress", "running"].includes(s)) return "info";
  if (["pending", "queued", "awaiting"].includes(s)) return "purple";
  if (["partial"].includes(s)) return "warn";
  if (["failed", "canceled", "cancelled", "error", "refunded"].includes(s)) return "bad";
  return "neutral";
}

function prettyStatus(status) {
  const s = String(status || "unknown").toLowerCase();
  if (s === "in_progress") return "processing";
  return s;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(String(text ?? ""));
    return true;
  } catch {
    return false;
  }
}

/* =========================
   Glass UI atoms
========================= */

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10",
        "bg-black/25 backdrop-blur-xl",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_16px_40px_rgba(0,0,0,0.45)]",
        "transition hover:border-white/15",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/25" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

function Skeleton({ className = "" }) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/10", className)} />;
}

function Badge({ children, tone = "zinc", className = "" }) {
  const tones = {
    zinc: "border-white/10 bg-white/5 text-zinc-100",
    blue: "border-sky-500/20 bg-sky-500/10 text-sky-100",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-100",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
    red: "border-red-500/20 bg-red-500/10 text-red-100",
    violet: "border-violet-500/20 bg-violet-500/10 text-violet-100",
    purple: "border-purple-500/20 bg-purple-500/10 text-purple-100",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
        tones[tone] || tones.zinc,
        className
      )}
    >
      {children}
    </span>
  );
}

function toneToBadge(tone) {
  if (tone === "ok") return "emerald";
  if (tone === "info") return "blue";
  if (tone === "warn") return "amber";
  if (tone === "bad") return "red";
  if (tone === "purple") return "purple";
  return "zinc";
}

function ProgressBar({ value }) {
  const v = Math.max(0, Math.min(100, safeNum(value, 0)));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
      <div className="h-full bg-amber-500/80" style={{ width: `${v}%` }} />
    </div>
  );
}

/* =========================
   Modal
========================= */

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[min(1080px,94vw)]">
        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="text-sm font-semibold text-white">{title}</div>
            <button
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-200 hover:bg-white/10"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </GlassCard>
      </div>
    </div>
  );
}

/* =========================
   Page
========================= */

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState("new"); // new | old | price_desc | price_asc
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // toast
  const [toast, setToast] = useState("");
  const toastRef = useRef(null);
  const [err, setErr] = useState("");

  // modal
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  function showToast(msg) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 1400);
  }

  async function loadOrders() {
    setLoading(true);
    setErr("");
    try {
      const data = await api.get("/orders");
      const list = Array.isArray(data) ? data : [];
      setOrders(list);
    } catch (e) {
      setErr(e?.message || "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
    return () => {
      if (toastRef.current) clearTimeout(toastRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allPlatforms = useMemo(() => {
    const set = new Set();
    for (const o of orders) {
      const p = o?.serviceId?.platform;
      if (p) set.add(String(p).toLowerCase());
    }
    return ["all", ...Array.from(set).sort()];
  }, [orders]);

  const allStatuses = useMemo(() => {
    const set = new Set();
    for (const o of orders) {
      const s = o?.status;
      if (s) set.add(String(s).toLowerCase());
    }
    const base = ["all", "pending", "processing", "completed", "failed", "partial"];
    const extra = Array.from(set).filter((x) => !base.includes(x));
    return [...base, ...extra];
  }, [orders]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = orders.slice();

    if (status !== "all") {
      list = list.filter((o) => String(o?.status || "").toLowerCase() === status);
    }
    if (platform !== "all") {
      list = list.filter((o) => String(o?.serviceId?.platform || "").toLowerCase() === platform);
    }
    if (needle) {
      list = list.filter((o) => {
        const svc = o?.serviceId;
        const hay = [
          o?._id,
          o?.providerOrderId,
          o?.link,
          o?.status,
          o?.quantity,
          o?.price,
          svc?._id,
          svc?.name,
          svc?.category,
          svc?.platform,
          svc?.type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    const ts = (x) => {
      const d = new Date(x || 0);
      const t = d.getTime();
      return Number.isFinite(t) ? t : 0;
    };

    if (sort === "new") list.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
    if (sort === "old") list.sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
    if (sort === "price_desc") list.sort((a, b) => safeNum(b.price, 0) - safeNum(a.price, 0));
    if (sort === "price_asc") list.sort((a, b) => safeNum(a.price, 0) - safeNum(b.price, 0));

    return list;
  }, [orders, q, status, platform, sort]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / pageSize)),
    [filtered.length]
  );

  const paged = useMemo(() => {
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [q, status, platform, sort]);

  function openDetails(o) {
    setActive(o);
    setOpen(true);
  }

  async function onCopy(text, label = "Copied ✅") {
    if (!text) return;
    const okc = await copyToClipboard(text);
    if (okc) {
      setErr("");
      showToast(label);
    } else {
      setErr("Clipboard blocked by browser");
    }
  }

  async function tryRefreshProviderStatus(order) {
    setErr("");
    try {
      const out = await api.post(`/orders/${order._id}/refresh`, {});
      const updated = out?.order || out;
      if (updated && updated._id) {
        setOrders((prev) => prev.map((x) => (x._id === updated._id ? updated : x)));
        setActive(updated);
      }
      showToast("Refreshed ✅");
    } catch (e) {
      setErr(e?.message || "Refresh endpoint not available yet");
    }
  }

  const stats = useMemo(() => {
    const total = orders.length;
    const by = (s) => orders.filter((o) => String(o.status || "").toLowerCase() === s).length;
    const spent = orders.reduce((sum, o) => sum + safeNum(o.price, 0), 0);

    const activeCount =
      by("pending") +
      by("processing") +
      by("partial") +
      orders.filter((o) => ["in_progress"].includes(String(o.status || "").toLowerCase())).length;

    return {
      total,
      pending: by("pending"),
      processing: by("processing") + by("in_progress"),
      completed: by("completed"),
      failed: by("failed"),
      active: activeCount,
      spent,
    };
  }, [orders]);

  const hasAnyFilter = q.trim() || status !== "all" || platform !== "all" || sort !== "new";

  return (
    <div className="space-y-4">
      {/* toast */}
      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-sm text-zinc-100 backdrop-blur-xl shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
          {toast}
        </div>
      ) : null}

      {/* HERO */}
      <GlassCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-3xl font-black tracking-tight text-white">Orders</div>
              <Badge tone="violet">
                <Sparkles className="h-3.5 w-3.5" /> Mansory Suite
              </Badge>
              <Badge tone="blue">
                <ShieldCheck className="h-3.5 w-3.5" /> Live tracking + filters
              </Badge>
              <Badge tone="amber">
                <Activity className="h-3.5 w-3.5" /> Active {stats.active}
              </Badge>
            </div>

            <div className="mt-2 text-sm text-zinc-200/70">
              Track orders, provider ID, link, price, status timeline — clean SaaS workflow.
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={loadOrders}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </GlassCard>

      {/* KPI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Total</div>
          <div className="mt-2 text-2xl font-black text-white">{stats.total}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Pending</div>
          <div className="mt-2 text-2xl font-black text-white">{stats.pending}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Processing</div>
          <div className="mt-2 text-2xl font-black text-white">{stats.processing}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Completed</div>
          <div className="mt-2 text-2xl font-black text-white">{stats.completed}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Failed</div>
          <div className="mt-2 text-2xl font-black text-white">{stats.failed}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Spent</div>
          <div className="mt-2 text-2xl font-black text-white">{money2(stats.spent)}€</div>
        </GlassCard>
      </div>

      {/* error */}
      {err ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div className="min-w-0">{err}</div>
          </div>
        </div>
      ) : null}

      {/* Controls */}
      <GlassCard className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <Search className="h-4 w-4 text-zinc-200/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search service, link, status, order id, provider id…"
              className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-200/40"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-zinc-100 hover:bg-white/10"
                title="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <Filter className="h-4 w-4 text-zinc-200/60" />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-transparent text-sm text-zinc-100 outline-none"
              >
                {allStatuses.map((s) => (
                  <option key={s} value={s} className="bg-zinc-950">
                    {cap(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <Layers className="h-4 w-4 text-zinc-200/60" />
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="bg-transparent text-sm text-zinc-100 outline-none"
              >
                {allPlatforms.map((p) => (
                  <option key={p} value={p} className="bg-zinc-950">
                    {p === "all" ? "All platforms" : cap(p)}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <Clock className="h-4 w-4 text-zinc-200/60" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-transparent text-sm text-zinc-100 outline-none"
              >
                <option value="new" className="bg-zinc-950">
                  Newest
                </option>
                <option value="old" className="bg-zinc-950">
                  Oldest
                </option>
                <option value="price_desc" className="bg-zinc-950">
                  Price (high)
                </option>
                <option value="price_asc" className="bg-zinc-950">
                  Price (low)
                </option>
              </select>
            </div>

            {hasAnyFilter ? (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setStatus("all");
                  setPlatform("all");
                  setSort("new");
                  showToast("Filters cleared ✅");
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Reset
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-zinc-200/60">
          <div>
            Showing <span className="text-zinc-100 font-semibold">{filtered.length}</span> order(s)
          </div>
          <div>Tip: click a row to open the inspector (copy IDs, open link, timeline).</div>
        </div>
      </GlassCard>

      {/* LIST */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="text-sm font-semibold text-white">{loading ? "Loading…" : "Orders list"}</div>
          <div className="mt-1 text-xs text-zinc-200/60">Fast scan: status chip, provider id, link, amount, price.</div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-zinc-200/70">No orders found. Try removing filters.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {paged.map((o) => {
              const svc = o?.serviceId || null;
              const tone = statusTone(o?.status);
              const badgeTone = toneToBadge(tone);

              const platformName = svc?.platform ? cap(svc.platform) : "—";
              const typeName = svc?.type ? cap(svc.type) : "";
              const category = svc?.category ? String(svc.category) : "";

              const providerOrderId = o?.providerOrderId || "—";

              const remains = safeNum(o?.remains ?? o?.remains_count, 0);
              const qty = safeNum(o?.quantity, 0);

              let progress = null;
              if (qty > 0 && remains >= 0 && remains <= qty && remains !== 0) {
                const delivered = Math.max(0, qty - remains);
                progress = Math.max(0, Math.min(100, (delivered / qty) * 100));
              }

              return (
                <button
                  key={o._id}
                  onClick={() => openDetails(o)}
                  className="w-full text-left transition hover:bg-white/5"
                >
                  <div className="grid grid-cols-1 gap-3 px-5 py-4 lg:grid-cols-12 lg:items-center">
                    {/* Service */}
                    <div className="lg:col-span-5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="violet">{platformName}</Badge>
                        {typeName ? <Badge tone="blue">{typeName}</Badge> : null}
                        {category ? <Badge tone="zinc">{category}</Badge> : null}
                        <Badge tone={badgeTone}>{cap(prettyStatus(o?.status))}</Badge>
                      </div>

                      <div className="mt-2 text-sm font-semibold text-white truncate">
                        {svc?.name || "Service"}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-200/60">
                        <span className="inline-flex items-center gap-1">
                          <Hash className="h-3.5 w-3.5" />
                          {shortId(o?._id)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {fmtDateTime(o?.createdAt)}
                        </span>
                      </div>

                      {progress != null ? (
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-200/60">
                            <span>Progress</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <ProgressBar value={progress} />
                        </div>
                      ) : null}
                    </div>

                    {/* Provider + link */}
                    <div className="lg:col-span-5">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Provider ID</div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopy(String(providerOrderId), "Provider ID copied ✅");
                            }}
                            className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-100 hover:bg-white/10"
                            title="Copy provider id"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="text-sm text-zinc-100/90">{String(providerOrderId)}</div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Link</div>
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCopy(String(o?.link || ""), "Link copied ✅");
                              }}
                              className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-100 hover:bg-white/10"
                              title="Copy link"
                            >
                              <Copy className="h-4 w-4" />
                            </button>

                            {o?.link ? (
                              <a
                                href={o.link}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-100 hover:bg-white/10"
                                title="Open link"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : null}
                          </div>
                        </div>

                        <div className="line-clamp-1 text-sm text-zinc-100/80">{o?.link || "—"}</div>
                      </div>
                    </div>

                    {/* Amount + price */}
                    <div className="lg:col-span-2 lg:text-right">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Amount</div>
                      <div className="mt-1 text-sm text-zinc-100/90">{fmtInt(o?.quantity || 0)}</div>

                      <div className="mt-2 inline-flex items-center justify-end gap-2">
                        <Badge tone="amber" className="px-3 py-1">
                          <Euro className="h-3.5 w-3.5" />
                          {money2(o?.price || 0)}€
                        </Badge>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length > 0 ? (
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
            <div className="text-xs text-zinc-200/60">
              Page <span className="text-zinc-100 font-semibold">{page}</span> /{" "}
              <span className="text-zinc-100 font-semibold">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10 disabled:opacity-50"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </GlassCard>

      {/* DETAILS MODAL */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={active ? `Order inspector — ${shortId(active._id)}` : "Order inspector"}
      >
        {!active ? (
          <div className="text-sm text-zinc-200/70">No order selected.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left */}
            <div className="lg:col-span-8 space-y-4">
              <GlassCard className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={toneToBadge(statusTone(active.status))}>
                    {cap(prettyStatus(active.status))}
                  </Badge>
                  {active?.serviceId?.platform ? (
                    <Badge tone="violet">{cap(active.serviceId.platform)}</Badge>
                  ) : null}
                  {active?.serviceId?.type ? (
                    <Badge tone="blue">{cap(active.serviceId.type)}</Badge>
                  ) : null}
                  {active?.serviceId?.category ? (
                    <Badge tone="zinc">{String(active.serviceId.category)}</Badge>
                  ) : null}
                </div>

                <div className="mt-3 text-lg font-semibold text-white">
                  {active?.serviceId?.name || "Service"}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Quantity</div>
                    <div className="mt-1 text-sm text-zinc-100/90">{fmtInt(active.quantity || 0)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Price</div>
                    <div className="mt-1 text-sm text-zinc-100/90">{money2(active.price || 0)}€</div>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Link</div>
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => onCopy(String(active.link || ""), "Link copied ✅")}
                        className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-100 hover:bg-white/10"
                        title="Copy link"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      {active.link ? (
                        <a
                          href={active.link}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-100 hover:bg-white/10"
                          title="Open link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 break-all text-sm text-zinc-100/85">{active.link || "—"}</div>
                </div>
              </GlassCard>

              <GlassCard className="p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Info className="h-4 w-4" />
                  Timeline
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-zinc-200/60">Created</span>
                    <span className="text-zinc-100/90">{fmtDateTime(active.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-zinc-200/60">Last update</span>
                    <span className="text-zinc-100/90">{fmtDateTime(active.updatedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-zinc-200/60">Current status</span>
                    <span className="text-zinc-100/90">{cap(prettyStatus(active.status))}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => tryRefreshProviderStatus(active)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
                    title="Refresh provider status (optional endpoint)"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Refresh status
                  </button>

                  <button
                    onClick={() => onCopy(String(active._id), "Order ID copied ✅")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
                  >
                    <Hash className="h-4 w-4" />
                    Copy order id
                  </button>
                </div>
              </GlassCard>
            </div>

            {/* Right */}
            <div className="lg:col-span-4 space-y-4">
              <GlassCard className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">Provider</div>
                  <Badge tone="blue">
                    <LinkIcon className="h-3.5 w-3.5" /> Live id
                  </Badge>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">
                      Provider Order ID
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="break-all text-sm text-zinc-100/90">{active.providerOrderId || "—"}</div>
                      <button
                        onClick={() => onCopy(String(active.providerOrderId || ""), "Provider ID copied ✅")}
                        className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-100 hover:bg-white/10"
                        title="Copy provider order id"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Notes</div>
                    <div className="mt-1 text-sm text-zinc-100/70">
                      If it stays “processing” too long, we can enable backend refresh + auto sync job.
                    </div>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-4">
                <div className="text-sm font-semibold text-white">Service snapshot</div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="inline-flex items-center gap-2 text-zinc-200/60">
                      <Layers className="h-4 w-4" />
                      Platform
                    </span>
                    <span className="text-zinc-100/90">
                      {active?.serviceId?.platform ? cap(active.serviceId.platform) : "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="inline-flex items-center gap-2 text-zinc-200/60">
                      <Info className="h-4 w-4" />
                      Category
                    </span>
                    <span className="text-zinc-100/90">{active?.serviceId?.category || "—"}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="inline-flex items-center gap-2 text-zinc-200/60">
                      <Euro className="h-4 w-4" />
                      Price / 1000
                    </span>
                    <span className="text-zinc-100/90">
                      {active?.serviceId?.pricePer1000 != null ? `${money2(active.serviceId.pricePer1000)}€` : "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="inline-flex items-center gap-2 text-zinc-200/60">
                      <LinkIcon className="h-4 w-4" />
                      Service ID
                    </span>
                    <span className="text-zinc-100/90">
                      {active?.serviceId?._id ? shortId(active.serviceId._id) : "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={() => onCopy(String(active?.serviceId?._id || ""), "Service ID copied ✅")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
                  >
                    <Copy className="h-4 w-4" /> Copy serviceId
                  </button>

                  <button
                    type="button"
                    onClick={() => showToast("Next: add realtime status sync ✅")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-400"
                  >
                    <ArrowUpRight className="h-4 w-4" /> Mansory upgrade
                  </button>
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
