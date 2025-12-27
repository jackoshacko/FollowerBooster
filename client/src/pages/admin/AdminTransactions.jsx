// client/src/pages/admin/AdminTransactions.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";
import {
  RefreshCcw,
  Search,
  Filter,
  ArrowUpDown,
  Receipt,
  ShieldAlert,
} from "lucide-react";

function Badge({ children, tone = "zinc" }) {
  const tones = {
    zinc: "border-zinc-800 bg-zinc-950/60 text-zinc-200",
    green: "border-emerald-900/40 bg-emerald-500/10 text-emerald-200",
    yellow: "border-amber-900/40 bg-amber-500/10 text-amber-200",
    red: "border-red-900/40 bg-red-500/10 text-red-200",
    blue: "border-sky-900/40 bg-sky-500/10 text-sky-200",
    purple: "border-fuchsia-900/40 bg-fuchsia-500/10 text-fuchsia-200",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        tones[tone] || tones.zinc,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed") return "green";
  if (s === "pending") return "yellow";
  if (s === "failed" || s === "expired") return "red";
  return "zinc";
}

function typeTone(type) {
  const t = String(type || "").toLowerCase();
  if (t === "topup") return "blue";
  if (t === "order") return "purple";
  if (t === "refund") return "yellow";
  return "zinc";
}

function fmtMoney(amount, currency) {
  const n = Number(amount || 0);
  const cur = String(currency || "EUR").toUpperCase();
  return `${n.toFixed(2)} ${cur}`;
}

function fmtDate(dt) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return "-";
  }
}

/**
 * EXPECTED API:
 * GET /admin/transactions
 * -> either array OR { items, total, page, pageSize }
 *
 * Works with both.
 */
export default function AdminTransactions() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [raw, setRaw] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 50 });

  // UI state
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [provider, setProvider] = useState("all");
  const [sortDir, setSortDir] = useState("desc"); // createdAt

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await api.get("/admin/transactions");

      if (Array.isArray(data)) {
        setRaw(data);
        setMeta((m) => ({ ...m, total: data.length }));
      } else {
        setRaw(Array.isArray(data?.items) ? data.items : []);
        setMeta({
          total: Number(data?.total || (data?.items?.length ?? 0)),
          page: Number(data?.page || 1),
          pageSize: Number(data?.pageSize || 50),
        });
      }
    } catch (e) {
      setErr(e?.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    let list = [...raw];

    if (status !== "all") {
      list = list.filter((t) => String(t.status || "").toLowerCase() === status);
    }
    if (type !== "all") {
      list = list.filter((t) => String(t.type || "").toLowerCase() === type);
    }
    if (provider !== "all") {
      list = list.filter((t) => String(t.provider || "").toLowerCase() === provider);
    }

    if (query) {
      list = list.filter((t) => {
        const email = String(t.userEmail || "").toLowerCase();
        const uid = String(t.userId || "").toLowerCase();
        const ref = String(t.providerOrderId || "").toLowerCase();
        const ev = String(t.providerEventId || "").toLowerCase();
        const id = String(t._id || "").toLowerCase();
        return (
          email.includes(query) ||
          uid.includes(query) ||
          ref.includes(query) ||
          ev.includes(query) ||
          id.includes(query)
        );
      });
    }

    list.sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return sortDir === "asc" ? ta - tb : tb - ta;
    });

    return list;
  }, [raw, q, status, type, provider, sortDir]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const confirmed = filtered.filter((t) => String(t.status).toLowerCase() === "confirmed").length;
    const pending = filtered.filter((t) => String(t.status).toLowerCase() === "pending").length;
    const failed = filtered.filter((t) => ["failed", "expired"].includes(String(t.status).toLowerCase())).length;

    const sum = filtered.reduce((acc, t) => acc + Number(t.amount || 0), 0);

    return { total, confirmed, pending, failed, sum };
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-zinc-300" />
            <h1 className="text-xl font-semibold text-white">Admin Transactions</h1>
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            Ledger / audit trail (topups, orders, refunds, adjustments).
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900/40 hover:text-white"
            title="Toggle sort by time"
          >
            <ArrowUpDown className="h-4 w-4" />
            Sort: {sortDir === "desc" ? "Newest" : "Oldest"}
          </button>

          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900/40 hover:text-white"
          >
            <RefreshCcw className={["h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {err ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5" />
            <div>
              <div className="font-semibold">Failed to load</div>
              <div className="mt-1 text-sm text-red-200/90">{err}</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Controls */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="grid gap-3 md:grid-cols-12">
          {/* Search */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by email, userId, txId, orderId, eventId…"
                className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="md:col-span-7">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <Filter className="h-4 w-4 text-zinc-500" />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-transparent text-sm text-zinc-200 outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="confirmed">confirmed</option>
                  <option value="pending">pending</option>
                  <option value="failed">failed</option>
                  <option value="expired">expired</option>
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <Filter className="h-4 w-4 text-zinc-500" />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-transparent text-sm text-zinc-200 outline-none"
                >
                  <option value="all">All types</option>
                  <option value="topup">topup</option>
                  <option value="order">order</option>
                  <option value="refund">refund</option>
                  <option value="adjustment">adjustment</option>
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <Filter className="h-4 w-4 text-zinc-500" />
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full bg-transparent text-sm text-zinc-200 outline-none"
                >
                  <option value="all">All providers</option>
                  <option value="paypal">paypal</option>
                  <option value="crypto">crypto</option>
                  <option value="revolut">revolut</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs text-zinc-500">Transactions</div>
            <div className="mt-1 text-lg font-semibold text-white">{stats.total}</div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs text-zinc-500">Confirmed</div>
            <div className="mt-1 text-lg font-semibold text-white">{stats.confirmed}</div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs text-zinc-500">Pending</div>
            <div className="mt-1 text-lg font-semibold text-white">{stats.pending}</div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs text-zinc-500">Sum (filtered)</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {stats.sum.toFixed(2)}
            </div>
          </div>
        </div>

        {/* hint */}
        {meta?.total ? (
          <div className="mt-3 text-xs text-zinc-500">
            API total: <span className="text-zinc-300">{meta.total}</span> •
            page: <span className="text-zinc-300">{meta.page}</span> •
            pageSize: <span className="text-zinc-300">{meta.pageSize}</span>
            <span className="ml-2 text-zinc-600">(pagination can be added next)</span>
          </div>
        ) : null}
      </div>

      {/* Table / List */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <div className="border-b border-zinc-800 px-4 py-3 text-sm text-zinc-400">
          Latest transactions (filtered)
        </div>

        {/* Loading */}
        {loading ? (
          <div className="p-4">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl border border-zinc-800 bg-zinc-950/40 animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Content */}
        {!loading ? (
          <div className="divide-y divide-zinc-800">
            {filtered.map((t) => (
              <div key={t._id} className="px-4 py-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={typeTone(t.type)}>{String(t.type || "-")}</Badge>
                    <Badge tone={statusTone(t.status)}>{String(t.status || "-")}</Badge>
                    <Badge tone="zinc">{String(t.provider || "-")}</Badge>
                    <span className="text-sm font-semibold text-white">
                      {fmtMoney(t.amount, t.currency)}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-500">
                    {fmtDate(t.createdAt)}
                  </div>
                </div>

                <div className="mt-1 grid gap-1 text-xs text-zinc-400 md:grid-cols-2">
                  <div className="truncate">
                    user:{" "}
                    <span className="text-zinc-200">
                      {t.userEmail || t.userId || "-"}
                    </span>
                  </div>
                  <div className="truncate">
                    ref:{" "}
                    <span className="text-zinc-200">
                      {t.providerOrderId || "-"}
                    </span>
                  </div>

                  <div className="truncate">
                    txId: <span className="text-zinc-200">{t._id}</span>
                  </div>
                  <div className="truncate">
                    eventId:{" "}
                    <span className="text-zinc-200">
                      {t.providerEventId || "-"}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="text-sm text-zinc-300">No transactions found.</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Try clearing filters or searching by email/orderId.
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
