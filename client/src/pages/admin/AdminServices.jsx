import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";

const PLATFORMS = [
  "instagram","tiktok","youtube","facebook","twitter","telegram","spotify","snapchat","discord","website","other",
];

const TYPES = [
  "followers","likes","views","comments","shares","saves","live","watchtime","traffic","other",
];

const CURRENCY = "EUR";
const CUR = "€";

function Input({ label, ...props }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs text-zinc-400">{label}</div>
      <input
        {...props}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
      />
    </label>
  );
}

function Select({ label, children, ...props }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs text-zinc-400">{label}</div>
      <select
        {...props}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
      >
        {children}
      </select>
    </label>
  );
}

function Button({ children, tone = "zinc", ...props }) {
  const cls =
    tone === "amber"
      ? "bg-amber-500 text-black hover:bg-amber-400"
      : tone === "red"
      ? "bg-red-600 text-white hover:bg-red-500"
      : tone === "emerald"
      ? "bg-emerald-600 text-white hover:bg-emerald-500"
      : "bg-zinc-800 text-white hover:bg-zinc-700";
  return (
    <button
      {...props}
      className={`rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60 ${cls}`}
    >
      {children}
    </button>
  );
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export default function AdminServices() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null); // service or null

  // bulk toolkit
  const [allMultiplier, setAllMultiplier] = useState("0.5");      // -50%
  const [viewsMultiplier, setViewsMultiplier] = useState("0.3333333"); // /3

  const emptyForm = {
    name: "",
    description: "",
    platform: "instagram",
    type: "followers",
    category: "Instagram",
    pricePer1000: 1,
    min: 10,
    max: 10000,
    provider: "default",
    providerServiceId: "",
    enabled: true,
  };

  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await api.get("/admin/services");
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Failed to load admin services");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((s) => {
      const hay = `${s.name || ""} ${s.category || ""} ${s.platform || ""} ${s.type || ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [list, q]);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
  }

  function startEdit(s) {
    setEditing(s);
    setForm({
      name: s.name || "",
      description: s.description || "",
      platform: s.platform || "other",
      type: s.type || "other",
      category: s.category || "Other",
      pricePer1000: s.pricePer1000 ?? 1,
      min: s.min ?? 1,
      max: s.max ?? 1000000,
      provider: s.provider || "default",
      providerServiceId: s.providerServiceId || "",
      enabled: s.enabled !== false,
    });
  }

  async function save() {
    setBusy(true);
    setErr("");
    try {
      if (!form.name.trim()) throw new Error("Name is required");
      if (!Number.isFinite(Number(form.pricePer1000))) throw new Error("Price per 1000 is required");

      const payload = {
        ...form,
        pricePer1000: round2(Number(form.pricePer1000)),
        min: Number(form.min),
        max: Number(form.max),
      };

      if (editing?._id) {
        await api.put(`/admin/services/${editing._id}`, payload);
      } else {
        await api.post("/admin/services", payload);
      }
      await load();
      startCreate();
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id) {
    setBusy(true);
    setErr("");
    try {
      await api.post(`/admin/services/${id}/toggle`, {});
      await load();
    } catch (e) {
      setErr(e.message || "Toggle failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyReprice({ all, views }) {
    setBusy(true);
    setErr("");
    try {
      const body = {
        allMultiplier: all,
        viewsMultiplier: views,
        roundTo: 2,
      };
      await api.post("/admin/services/reprice", body);
      await load();
    } catch (e) {
      setErr(e.message || "Reprice failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyPresetHalfAndViewsThird() {
    return applyReprice({ all: 0.5, views: 1/3 });
  }

  async function applyViewsThirdOnly() {
    return applyReprice({ all: null, views: 1/3 });
  }

  async function applyCustomMultipliers() {
    const all = Number(allMultiplier);
    const views = Number(viewsMultiplier);
    if (!Number.isFinite(all) && !Number.isFinite(views)) {
      setErr("Enter valid multipliers");
      return;
    }
    return applyReprice({
      all: Number.isFinite(all) ? all : null,
      views: Number.isFinite(views) ? views : null,
    });
  }

  const stats = useMemo(() => {
    const total = list.length;
    const enabled = list.filter(s => s.enabled !== false).length;
    const views = list.filter(s => s.type === "views").length;
    const avg = total ? (list.reduce((a, s) => a + Number(s.pricePer1000 || 0), 0) / total) : 0;
    return { total, enabled, views, avg: round2(avg) };
  }, [list]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-2xl font-semibold">Admin · Services</div>
        <div className="text-sm text-zinc-400">
          Currency: <b className="text-white">{CURRENCY}</b> ({CUR}). Add / Edit / Disable services + bulk repricing.
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-900 bg-red-950 p-4 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* PRICING TOOLKIT */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-semibold text-white">Pricing Toolkit (EUR)</div>
            <div className="text-xs text-zinc-400">
              Total: {stats.total} · Enabled: {stats.enabled} · Views: {stats.views} · Avg price/1000: {stats.avg}{CUR}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button tone="amber" onClick={applyPresetHalfAndViewsThird} disabled={busy}>
              -50% ALL + Views /3
            </Button>
            <Button tone="emerald" onClick={applyViewsThirdOnly} disabled={busy}>
              Views /3 only
            </Button>
            <Button onClick={load} disabled={busy}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Input
            label="All multiplier (e.g. 0.5)"
            value={allMultiplier}
            onChange={(e) => setAllMultiplier(e.target.value)}
          />
          <Input
            label="Views multiplier (e.g. 0.3333)"
            value={viewsMultiplier}
            onChange={(e) => setViewsMultiplier(e.target.value)}
          />
          <div className="md:col-span-3 flex items-end gap-2">
            <Button tone="amber" onClick={applyCustomMultipliers} disabled={busy}>
              Apply custom multipliers
            </Button>
            <Button tone="red" onClick={() => applyReprice({ all: 1, views: 1 })} disabled={busy}>
              Normalize (x1)
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* FORM */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{editing ? "Edit service" : "Create service"}</div>
            <Button onClick={startCreate}>New</Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Instagram Followers HQ (Instant)"
            />
            <Input
              label="Category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Instagram"
            />
            <Select
              label="Platform"
              value={form.platform}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
            >
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>

            <Input
              label={`Price per 1000 (${CUR})`}
              type="number"
              value={form.pricePer1000}
              onChange={(e) => setForm((f) => ({ ...f, pricePer1000: e.target.value }))}
            />
            <Input
              label="Min"
              type="number"
              value={form.min}
              onChange={(e) => setForm((f) => ({ ...f, min: e.target.value }))}
            />
            <Input
              label="Max"
              type="number"
              value={form.max}
              onChange={(e) => setForm((f) => ({ ...f, max: e.target.value }))}
            />

            <Input
              label="Provider"
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              placeholder="default / smmprovider"
            />
            <Input
              label="Provider Service ID"
              value={form.providerServiceId}
              onChange={(e) => setForm((f) => ({ ...f, providerServiceId: e.target.value }))}
              placeholder="12345"
            />

            <label className="md:col-span-2 block">
              <div className="mb-1 text-xs text-zinc-400">Description</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="h-24 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
                placeholder="Instant start, refill 30 days, HQ..."
              />
            </label>

            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={!!form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              <span className="text-sm text-zinc-200">Enabled</span>
            </label>

            <div className="md:col-span-2 flex gap-2">
              <Button tone="amber" onClick={save} disabled={busy}>
                {busy ? "Saving..." : "Save"}
              </Button>
              {editing && (
                <Button onClick={() => toggle(editing._id)} disabled={busy}>
                  Toggle
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* LIST */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-semibold">All services</div>
          </div>

          <input
            className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {loading ? (
            <div className="mt-4 text-zinc-300">Loading…</div>
          ) : (
            <div className="mt-4 space-y-2">
              {filtered.map((s) => (
                <button
                  key={s._id}
                  onClick={() => startEdit(s)}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-left hover:bg-zinc-900/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-white">{s.name}</div>
                    <div className={`text-xs ${s.enabled ? "text-emerald-300" : "text-red-300"}`}>
                      {s.enabled ? "ENABLED" : "DISABLED"}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {s.platform} · {s.type} · {s.category} · rate/1000: {round2(Number(s.pricePer1000 || 0))}{CUR}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && <div className="text-sm text-zinc-400">No services.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
