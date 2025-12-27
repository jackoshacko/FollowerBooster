// client/src/pages/admin/PayPalAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";

function minutesAgo(dateStr) {
  try {
    const t = new Date(dateStr).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.floor((Date.now() - t) / 60000);
  } catch {
    return null;
  }
}

function Badge({ children, tone = "neutral" }) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs border";
  const tones = {
    neutral: "border-white/10 text-white/70",
    ok: "border-emerald-500/30 text-emerald-300",
    warn: "border-yellow-500/30 text-yellow-300",
    bad: "border-red-500/30 text-red-300",
    info: "border-cyan-500/30 text-cyan-300",
  };
  return <span className={`${base} ${tones[tone] || tones.neutral}`}>{children}</span>;
}

export default function PayPalAdmin() {
  // order input
  const [orderId, setOrderId] = useState("");

  // pending list controls
  const [minutes, setMinutes] = useState(1440); // 24h
  const [limit, setLimit] = useState(50);

  // data
  const [pending, setPending] = useState([]);
  const [pendingMeta, setPendingMeta] = useState(null);

  // output
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);

  const orderIdTrimmed = useMemo(() => String(orderId || "").trim(), [orderId]);

  async function run(fn) {
    try {
      setLoading(true);
      setResult(null);
      const res = await fn();
      setResult(res);
      setTimeout(() => {
        const el = document.getElementById("paypal-admin-output");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e) {
      setResult({
        error: true,
        message: e?.message || String(e),
        raw: e,
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadPending() {
    try {
      setLoadingPending(true);
      const res = await api.get(
        `/admin/payments/paypal/paypal/pending?minutes=${Number(minutes)}&limit=${Number(limit)}`
      );
      setPending(res?.items || []);
      setPendingMeta({
        cutoff: res?.cutoff,
        count: res?.count ?? (res?.items?.length || 0),
      });
    } catch (e) {
      setResult({
        error: true,
        message: e?.message || String(e),
        raw: e,
      });
    } finally {
      setLoadingPending(false);
    }
  }

  // auto-load pending on page open
  useEffect(() => {
    loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copy(text) {
    if (!text) return;
    navigator.clipboard?.writeText(String(text)).catch(() => {});
  }

  return (
    <div className="p-6">
      {/* header */}
      <div className="mb-4">
        <div className="text-2xl font-semibold">PayPal Admin</div>
        <div className="text-sm opacity-70">
          FULL AUSTATTUNG: pending list + details/capture + reconcile + quick actions.
        </div>
      </div>

      {/* controls row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* order id */}
        <div className="flex flex-col gap-1">
          <label className="text-xs opacity-70">PayPal Order ID</label>
          <input
            className="w-[460px] max-w-full rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Paste PayPal order id here (e.g. 5O190127TN...)"
          />
        </div>

        {/* minutes */}
        <div className="flex flex-col gap-1">
          <label className="text-xs opacity-70">Minutes (pending window)</label>
          <input
            className="w-[180px] rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
            type="number"
            min={5}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value || 0))}
          />
        </div>

        {/* limit */}
        <div className="flex flex-col gap-1">
          <label className="text-xs opacity-70">Limit</label>
          <input
            className="w-[120px] rounded-md border border-white/10 bg-transparent px-3 py-2 outline-none"
            type="number"
            min={1}
            step={1}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value || 0))}
          />
        </div>

        {/* actions */}
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-white/10 px-3 py-2 disabled:opacity-50"
            disabled={!orderIdTrimmed || loading}
            onClick={() =>
              run(() =>
                api.get(`/admin/payments/paypal/paypal/order/${orderIdTrimmed}`)
              )
            }
            title="Fetch PayPal order details"
          >
            Get details
          </button>

          <button
            className="rounded-md border border-white/10 px-3 py-2 disabled:opacity-50"
            disabled={!orderIdTrimmed || loading}
            onClick={() =>
              run(() =>
                api.post(`/admin/payments/paypal/paypal/capture/${orderIdTrimmed}`)
              )
            }
            title="Admin manual capture (safe/idempotent)"
          >
            Capture
          </button>

          <button
            className="rounded-md border border-white/10 px-3 py-2 disabled:opacity-50"
            disabled={loading}
            onClick={() =>
              run(() =>
                api.post(`/admin/payments/paypal/paypal/reconcile`, {
                  minutes: 1440,
                  limit: 50,
                })
              ).then(() => loadPending())
            }
            title="Reconcile pending (last 24h)"
          >
            Reconcile (24h)
          </button>

          <button
            className="rounded-md border border-white/10 px-3 py-2 disabled:opacity-50"
            disabled={loading}
            onClick={() =>
              run(() =>
                api.post(`/admin/payments/paypal/paypal/reconcile`, {
                  minutes: Number(minutes) || 1440,
                  limit: Number(limit) || 50,
                })
              ).then(() => loadPending())
            }
            title="Reconcile with your custom minutes/limit"
          >
            Reconcile (custom)
          </button>

          <button
            className="rounded-md border border-white/10 px-3 py-2 disabled:opacity-50"
            disabled={loadingPending}
            onClick={() => loadPending()}
            title="Reload pending list"
          >
            {loadingPending ? "Loading..." : "Load pending"}
          </button>
        </div>
      </div>

      {/* pending list */}
      <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="font-semibold">Pending PayPal topups</div>
            <Badge tone="info">{pendingMeta?.count ?? pending.length}</Badge>
            {pendingMeta?.cutoff ? (
              <span className="text-xs opacity-70">
                window cutoff: {new Date(pendingMeta.cutoff).toLocaleString()}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-xs opacity-70">
            <span>Tip: click “Use” to fill Order ID input.</span>
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="text-sm opacity-70">No pending tx found in this window.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-xs opacity-70">
                <tr className="border-b border-white/10">
                  <th className="py-2 text-left">Age</th>
                  <th className="py-2 text-left">User</th>
                  <th className="py-2 text-left">Amount</th>
                  <th className="py-2 text-left">Order ID</th>
                  <th className="py-2 text-left">Created</th>
                  <th className="py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((x) => {
                  const ageMin = minutesAgo(x.createdAt);
                  const ageTone =
                    ageMin == null ? "neutral" : ageMin < 10 ? "ok" : ageMin < 60 ? "warn" : "bad";

                  return (
                    <tr key={x.id} className="border-b border-white/5">
                      <td className="py-2">
                        <Badge tone={ageTone}>
                          {ageMin == null ? "?" : `${ageMin}m`}
                        </Badge>
                      </td>
                      <td className="py-2">{x.userEmail || "-"}</td>
                      <td className="py-2">
                        {x.amount} {x.currency}
                      </td>
                      <td className="py-2 font-mono text-xs">
                        {x.providerOrderId || "-"}
                      </td>
                      <td className="py-2 text-xs opacity-80">
                        {x.createdAt ? new Date(x.createdAt).toLocaleString() : "-"}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-md border border-white/10 px-2 py-1 text-xs disabled:opacity-50"
                            disabled={!x.providerOrderId}
                            onClick={() => {
                              setOrderId(x.providerOrderId || "");
                            }}
                            title="Fill Order ID input"
                          >
                            Use
                          </button>

                          <button
                            className="rounded-md border border-white/10 px-2 py-1 text-xs disabled:opacity-50"
                            disabled={!x.providerOrderId}
                            onClick={() => copy(x.providerOrderId)}
                            title="Copy orderId"
                          >
                            Copy
                          </button>

                          <button
                            className="rounded-md border border-white/10 px-2 py-1 text-xs disabled:opacity-50"
                            disabled={!x.providerOrderId || loading}
                            onClick={() =>
                              run(() =>
                                api.get(
                                  `/admin/payments/paypal/paypal/order/${x.providerOrderId}`
                                )
                              )
                            }
                            title="Details"
                          >
                            Details
                          </button>

                          <button
                            className="rounded-md border border-white/10 px-2 py-1 text-xs disabled:opacity-50"
                            disabled={!x.providerOrderId || loading}
                            onClick={() =>
                              run(() =>
                                api.post(
                                  `/admin/payments/paypal/paypal/capture/${x.providerOrderId}`
                                )
                              ).then(() => loadPending())
                            }
                            title="Capture"
                          >
                            Capture
                          </button>

                          <button
                            className="rounded-md border border-white/10 px-2 py-1 text-xs disabled:opacity-50"
                            disabled={loading}
                            onClick={() =>
                              run(() =>
                                api.post(`/admin/payments/paypal/paypal/reconcile`, {
                                  minutes: Number(minutes) || 1440,
                                  limit: Number(limit) || 50,
                                })
                              ).then(() => loadPending())
                            }
                            title="Reconcile (bulk)"
                          >
                            Reconcile
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* output */}
      <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-semibold">Output</div>
          <div className="text-xs opacity-70">
            {loading ? "Working..." : "Ready"}
          </div>
        </div>

        <pre
          id="paypal-admin-output"
          className="max-h-[420px] overflow-auto text-xs"
        >
          {result ? JSON.stringify(result, null, 2) : "No output yet."}
        </pre>
      </div>
    </div>
  );
}
