import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-sm text-zinc-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{children}</div>
    </div>
  );
}

function formatMoney(n) {
  const x = Number(n || 0);
  return `${x.toFixed(2)} EUR`;
}

function labelDay(yyyy_mm_dd) {
  // "2025-12-26" -> "12/26"
  if (!yyyy_mm_dd) return "";
  const [y, m, d] = String(yyyy_mm_dd).split("-");
  return `${m}/${d}`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white shadow">
      <div className="text-zinc-400">{label}</div>
      <div className="font-semibold">{formatMoney(v)}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        const data = await api.get("/admin/stats");
        if (!mounted) return;
        setStats(data);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load admin stats");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const revenueSeries = useMemo(() => {
    const s = stats?.seriesRevenue7d || [];
    return s.map((x) => ({
      day: labelDay(x.day),
      value: Number(x.value || 0),
      rawDay: x.day,
    }));
  }, [stats]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin Dashboard</h1>

      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          {err}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Users">{loading ? "—" : stats?.usersTotal ?? 0}</Card>
        <Card title="Orders">{loading ? "—" : stats?.ordersTotal ?? 0}</Card>
        <Card title="Revenue (Topups 30d)">
          {loading ? "—" : formatMoney(stats?.revenue30d ?? 0)}
        </Card>
        <Card title="Pending orders">
          {loading ? "—" : stats?.ordersActive ?? 0}
        </Card>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-zinc-400">Revenue last 7 days</div>
          <div className="text-xs text-zinc-500">{loading ? "loading…" : "live"}</div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" strokeWidth={2} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          Source: confirmed topups (Transaction type=topup, status=confirmed)
        </div>
      </div>
    </div>
  );
}
