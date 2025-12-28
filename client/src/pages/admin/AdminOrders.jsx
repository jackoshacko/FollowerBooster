import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api.js";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

function formatMoney(n, currency = "EUR") {
  const x = Number(n ?? 0);
  const v = Number.isFinite(x) ? x : 0;
  return `${v.toFixed(2)} ${currency}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(id) {
  if (!id) return "—";
  const s = String(id);
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const style =
    s === "completed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : s === "processing"
      ? "border-blue-500/30 bg-blue-500/10 text-blue-200"
      : s === "pending"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : s === "failed"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : s === "canceled"
      ? "border-zinc-500/30 bg-zinc-500/10 text-zinc-200"
      : "border-zinc-700 bg-zinc-900/40 text-zinc-200";

  return (
    <span className={cls("inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold", style)}>
      {s || "unknown"}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-12 gap-3 px-4 py-3">
      <div className="col-span-3 h-4 rounded bg-zinc-800/60" />
      <div className="col-span-2 h-4 rounded bg-zinc-800/60" />
      <div className="col-span-2 h-4 rounded bg-zinc-800/60" />
      <div className="col-span-2 h-4 rounded bg-zinc-800/60" />
      <div className="col-span-3 h-4 rounded bg-zinc-800/60" />
    </div>
  );
}

export default function AdminOrders() {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // refund state
  const [refundingId, setRefundingId] = useState("");

  const inputRef = useRef(null);

  // small debounce: kad kucaš, ne spamuje backend
  useEffect(() => {
    const t = setTimeout(() => setAppliedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  async function load(query = appliedQ) {
    setErr("");
    setLoading(true);
    try {
      const qs = query ? `?q=${encodeURIComponent(query)}` : "";
      const data = await api.get(`/admin/orders${qs}`);
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setOrders([]);
      setErr(e?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  // load on mount + on appliedQ change
  useEffect(() => {
    load(appliedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQ]);

  const countLabel = useMemo(() => {
    if (loading) return "Loading…";
    if (err) return "Error";
    return `${orders.length} orders`;
  }, [loading, err, orders.length]);

  async function refund(order) {
    const orderId = order?._id;
    if (!orderId) return;

    const nice = [
      `Refund this order?`,
      ``,
      `Service: ${order.serviceName || "—"}`,
      `User: ${order.userEmail || order.userId || "—"}`,
      `Amount: ${formatMoney(order.price, order.currency || "EUR")}`,
      ``,
      `This will CREDIT the user wallet.`,
    ].join("\n");

    if (!window.confirm(nice)) return;

    setRefundingId(orderId);

    try {
      // optimistic UI: odmah “disable” dugme + reload posle
      await api.post(`/admin/orders/${orderId}/refund`, {});
      await load(appliedQ);
    } catch (e) {
      alert(e?.message || "Refund failed");
    } finally {
      setRefundingId("");
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      // instant apply (bez čekanja debouncer)
      setAppliedQ(q.trim());
    }
    if (e.key === "Escape") {
      setQ("");
      setAppliedQ("");
      inputRef.current?.blur?.();
    }
  }

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Admin Orders</h1>
          <div className="text-xs text-zinc-400">
            Search by <span className="text-zinc-200">user email</span>, <span className="text-zinc-200">providerOrderId</span> or <span className="text-zinc-200">Mongo _id</span>.
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex w-full items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2">
            <span className="text-zinc-500">🔎</span>
            <input
              ref={inputRef}
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
              placeholder="Search… (Enter to apply, Esc to clear)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
            />
            {q && (
              <button
                onClick={() => {
                  setQ("");
                  setAppliedQ("");
                  inputRef.current?.focus?.();
                }}
                className="rounded-lg px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                title="Clear"
              >
                Clear
              </button>
            )}
          </div>

          <button
            onClick={() => load(appliedQ)}
            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* error */}
      {err && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          {err}
        </div>
      )}

      {/* table card */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="text-sm text-zinc-400">{countLabel}</div>
          <div className="text-xs text-zinc-500">live</div>
        </div>

        {/* header row (desktop) */}
        <div className="hidden grid-cols-12 gap-3 border-b border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-500 md:grid">
          <div className="col-span-3">Order</div>
          <div className="col-span-2">User</div>
          <div className="col-span-2">Service</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {/* body */}
        <div className="divide-y divide-zinc-800">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : orders.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="text-sm font-semibold text-zinc-200">No orders found</div>
              <div className="mt-1 text-xs text-zinc-500">
                Try searching by email, provider id, or order _id.
              </div>
            </div>
          ) : (
            orders.map((o) => {
              const disabled = refundingId === o._id;

              return (
                <div key={o._id} className="px-4 py-3">
                  {/* mobile compact */}
                  <div className="flex flex-col gap-2 md:hidden">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">
                        {o.serviceName || "Service"}{" "}
                        <span className="text-zinc-500">•</span>{" "}
                        <span className="text-zinc-300">{shortId(o._id)}</span>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>

                    <div className="text-xs text-zinc-400">
                      user: <span className="text-zinc-200">{o.userEmail || o.userId || "—"}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <div>
                        {formatMoney(o.price, o.currency || "EUR")}
                        {o.providerOrderId ? (
                          <span className="ml-2 text-zinc-500">prov: {shortId(o.providerOrderId)}</span>
                        ) : null}
                      </div>
                      <div className="text-zinc-500">{formatDate(o.createdAt)}</div>
                    </div>

                    <div className="pt-1">
                      <button
                        disabled={disabled}
                        onClick={() => refund(o)}
                        className={cls(
                          "w-full rounded-2xl border px-3 py-2 text-xs font-semibold",
                          disabled
                            ? "cursor-not-allowed border-zinc-700 bg-zinc-900/30 text-zinc-500"
                            : "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        )}
                      >
                        {disabled ? "Refunding…" : "Refund"}
                      </button>
                    </div>
                  </div>

                  {/* desktop table row */}
                  <div className="hidden grid-cols-12 items-center gap-3 md:grid">
                    <div className="col-span-3 min-w-0">
                      <div className="text-sm font-semibold text-zinc-100">
                        {shortId(o._id)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        created: {formatDate(o.createdAt)}
                        {o.providerOrderId ? (
                          <span className="ml-2">• prov: {shortId(o.providerOrderId)}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="col-span-2 min-w-0">
                      <div className="truncate text-sm text-zinc-200">
                        {o.userEmail || o.userId || "—"}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 truncate">
                        {o.userId ? shortId(o.userId) : ""}
                      </div>
                    </div>

                    <div className="col-span-2 min-w-0">
                      <div className="truncate text-sm text-zinc-200">
                        {o.serviceName || "—"}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 truncate">
                        {o.providerOrderId ? `prov: ${shortId(o.providerOrderId)}` : "—"}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <StatusBadge status={o.status} />
                    </div>

                    <div className="col-span-2 text-right">
                      <div className="text-sm font-semibold text-zinc-100">
                        {formatMoney(o.price, o.currency || "EUR")}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {o.currency || "EUR"}
                      </div>
                    </div>

                    <div className="col-span-1 text-right">
                      <button
                        disabled={disabled}
                        onClick={() => refund(o)}
                        className={cls(
                          "rounded-xl border px-3 py-2 text-xs font-semibold",
                          disabled
                            ? "cursor-not-allowed border-zinc-700 bg-zinc-900/30 text-zinc-500"
                            : "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        )}
                        title="Refund user wallet"
                      >
                        {disabled ? "…" : "Refund"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* footer tips */}
        <div className="border-t border-zinc-800 px-4 py-3 text-xs text-zinc-500">
          Tip: Enter applies search instantly. Esc clears search.
        </div>
      </div>
    </div>
  );
}
