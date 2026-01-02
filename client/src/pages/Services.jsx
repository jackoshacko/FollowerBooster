// client/src/pages/Services.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  X,
  Copy,
  Info,
  ShoppingCart,
  Grid2X2,
  List,
  Sparkles,
  BadgeCheck,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
  Star,
  StarOff,
  Flame,
  SlidersHorizontal,
  Tag,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  Filter,
} from "lucide-react";

/* ------------------------------ labels ------------------------------ */

const PLATFORM_LABEL = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  twitter: "Twitter/X",
  "twitter/x": "Twitter/X",
  x: "Twitter/X",
  telegram: "Telegram",
  spotify: "Spotify",
  snapchat: "Snapchat",
  discord: "Discord",
  website: "Website Traffic",
  "website traffic": "Website Traffic",
  web: "Website Traffic",
  other: "Other",
};

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function toLc(v) {
  return String(v || "").trim().toLowerCase();
}

function platformToLabel(p) {
  const key = toLc(p);
  return PLATFORM_LABEL[key] || "Other";
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function money2(n) {
  return (Math.round(safeNum(n, 0) * 100) / 100).toFixed(2);
}

async function copyText(s) {
  const text = String(s ?? "");
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/* ------------------------------ UI atoms ------------------------------ */

function Badge({ children, tone = "zinc", className = "" }) {
  const tones = {
    zinc: "border-white/10 bg-white/5 text-zinc-100",
    blue: "border-sky-500/20 bg-sky-500/10 text-sky-100",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-100",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
    red: "border-red-500/20 bg-red-500/10 text-red-100",
    violet: "border-violet-500/20 bg-violet-500/10 text-violet-100",
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

function Skeleton({ className = "" }) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/10", className)} />;
}

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

function Segmented({ value, onChange }) {
  return (
    <div className="inline-flex overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 text-xs transition",
          value === "grid" ? "bg-white/10 text-white" : "text-zinc-200 hover:bg-white/10"
        )}
      >
        <Grid2X2 className="h-4 w-4" /> Grid
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 text-xs transition",
          value === "list" ? "bg-white/10 text-white" : "text-zinc-200 hover:bg-white/10"
        )}
      >
        <List className="h-4 w-4" /> List
      </button>
    </div>
  );
}

function Range({ min = 0, max = 100, valueMin, valueMax, onChange }) {
  const vMin = Math.min(valueMin, valueMax);
  const vMax = Math.max(valueMin, valueMax);

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-zinc-200/70 w-12">{money2(vMin)}€</div>

      <input
        type="range"
        min={min}
        max={max}
        value={vMin}
        onChange={(e) => onChange({ min: Number(e.target.value), max: vMax })}
        className="w-28"
      />
      <input
        type="range"
        min={min}
        max={max}
        value={vMax}
        onChange={(e) => onChange({ min: vMin, max: Number(e.target.value) })}
        className="w-28"
      />

      <div className="text-xs text-zinc-200/70 w-12 text-right">{money2(vMax)}€</div>
    </div>
  );
}

/* ------------------------------ data normalize ------------------------------ */

function inferPlatformFromCategory(cat) {
  const c = toLc(cat);
  if (!c) return "Other";
  if (c.includes("insta")) return "Instagram";
  if (c.includes("tiktok") || c === "tt") return "TikTok";
  if (c.includes("youtube") || c.includes("yt")) return "YouTube";
  if (c.includes("facebook") || c.includes("fb")) return "Facebook";
  if (c.includes("twitter") || c.includes("x ")) return "Twitter/X";
  if (c.includes("telegram") || c.includes("tg")) return "Telegram";
  if (c.includes("spotify")) return "Spotify";
  if (c.includes("snapchat")) return "Snapchat";
  if (c.includes("discord")) return "Discord";
  if (c.includes("website") || c.includes("traffic") || c.includes("seo")) return "Website Traffic";
  return "Other";
}

function normalizeService(s) {
  const externalId =
    s?.externalServiceId ??
    s?.providerServiceId ??
    s?.service ??
    s?.service_id ??
    s?.id ??
    null;

  const id = s?._id || s?.id || (externalId != null ? String(externalId) : "");

  const rateRaw = s?.pricePer1000 ?? s?.rate ?? s?.price ?? s?.price_per_1000 ?? 0;
  const minRaw = s?.min ?? s?.minOrder ?? s?.min_order ?? 0;
  const maxRaw = s?.max ?? s?.maxOrder ?? s?.max_order ?? 0;

  const category = (s?.category || s?.type || "Other").toString().trim() || "Other";
  const name =
    s?.name || s?.title || `Service ${String(externalId ?? id).slice(-6)}` || "—";

  const platform = s?.platform ? platformToLabel(s.platform) : inferPlatformFromCategory(category);

  return {
    ...s,
    _id: String(id || ""),
    name,
    description: s?.description || "",
    category,
    platform,
    type: s?.type || "other",
    rate: safeNum(rateRaw, 0),
    min: safeNum(minRaw, 0),
    max: safeNum(maxRaw, 0),
    enabled: s?.enabled !== false,

    externalServiceId: externalId,
    provider: s?.provider || "default",
  };
}

/* ------------------------------ modal ------------------------------ */

function fmtRange(min, max) {
  if (!min && !max) return "—";
  return `${min || "—"} / ${max || "—"}`;
}

function ServiceModal({ open, onClose, service, onBuy, toast, isFav, toggleFav }) {
  if (!open) return null;
  const s = service || {};
  const connected = Boolean(s.externalServiceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <GlassCard className="w-full max-w-3xl">
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-xl font-black tracking-tight text-white">
                  {s.name || "Service"}
                </div>
                <Badge tone="violet">{s.platform || "Other"}</Badge>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="blue">{s.category || "Other"}</Badge>
                <Badge tone="amber">{money2(s.rate)}€ / 1000</Badge>
                <Badge>min {s.min || "—"}</Badge>
                <Badge>max {s.max || "—"}</Badge>

                <Badge tone={connected ? "emerald" : "red"}>
                  {connected ? (
                    <>
                      <BadgeCheck className="h-3.5 w-3.5" /> Provider connected
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-3.5 w-3.5" /> Not connected
                    </>
                  )}
                </Badge>

                <button
                  type="button"
                  onClick={() => toggleFav(s._id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
                    isFav
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                      : "border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                  )}
                  title={isFav ? "Unpin" : "Pin"}
                >
                  {isFav ? <Star className="h-3.5 w-3.5" /> : <StarOff className="h-3.5 w-3.5" />}
                  {isFav ? "Pinned" : "Pin"}
                </button>
              </div>

              <div className="mt-3 text-sm text-zinc-200/70">
                Provider: <span className="text-zinc-100">{s.provider || "default"}</span>{" "}
                {connected ? (
                  <>
                    • External ID:{" "}
                    <span className="font-mono text-zinc-100">{String(s.externalServiceId)}</span>
                  </>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-zinc-200/60">Rate</div>
              <div className="mt-1 text-lg font-black text-white">{money2(s.rate)}€</div>
              <div className="text-xs text-zinc-200/60">per 1000</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-zinc-200/60">Limits</div>
              <div className="mt-1 text-lg font-black text-white">{fmtRange(s.min, s.max)}</div>
              <div className="text-xs text-zinc-200/60">min / max</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-zinc-200/60">Health</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={connected ? "emerald" : "red"}>
                  {connected ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5" /> Missing provider ID
                    </>
                  )}
                </Badge>
              </div>
              <div className="text-xs text-zinc-200/60 mt-2">ready for ordering</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white">Description</div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200/80">
              {s.description || "—"}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={async () => {
                const ok = await copyText(s._id);
                toast(ok ? "Copied serviceId ✅" : "Copy failed ❌");
              }}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
            >
              <span className="inline-flex items-center gap-2">
                <Copy className="h-4 w-4" /> Copy serviceId
              </span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const ok = await copyText(String(s.externalServiceId || ""));
                toast(ok ? "Copied provider id ✅" : "Copy failed ❌");
              }}
              disabled={!connected}
              className={cn(
                "rounded-2xl border px-4 py-3 text-sm font-medium",
                connected
                  ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
                  : "cursor-not-allowed border-white/5 bg-white/5 text-white/40"
              )}
              title={!connected ? "Missing externalServiceId" : ""}
            >
              <span className="inline-flex items-center gap-2">
                <LinkIcon className="h-4 w-4" /> Copy provider id
              </span>
            </button>

            <button
              type="button"
              onClick={() => onBuy(s)}
              className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black hover:bg-amber-400"
            >
              <span className="inline-flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Buy now
              </span>
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

/* ------------------------------ service cards ------------------------------ */

function ServiceCard({ s, view, onBuy, onDetails, toast, isFav, toggleFav }) {
  const connected = Boolean(s.externalServiceId);

  if (view === "list") {
    return (
      <GlassCard className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="violet">{s.platform}</Badge>
              <Badge tone="blue">{s.category}</Badge>
              <Badge tone={connected ? "emerald" : "red"}>{connected ? "Connected" : "Not connected"}</Badge>
              {isFav ? (
                <Badge tone="amber">
                  <Star className="h-3.5 w-3.5" /> Pinned
                </Badge>
              ) : null}
            </div>

            <div className="mt-2 text-base font-semibold text-white">{s.name}</div>
            <div className="mt-1 line-clamp-1 text-sm text-zinc-200/70">{s.description || "—"}</div>

            <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-200/70">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                {money2(s.rate)}€ / 1000
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                min {s.min || "—"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                max {s.max || "—"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                id …{String(s._id).slice(-6)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => toggleFav(s._id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs transition",
                isFav
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                  : "border-white/10 bg-white/5 text-white hover:bg-white/10"
              )}
              title={isFav ? "Unpin" : "Pin"}
            >
              {isFav ? <Star className="h-4 w-4" /> : <StarOff className="h-4 w-4" />}
              {isFav ? "Pinned" : "Pin"}
            </button>

            <button
              type="button"
              onClick={async () => {
                const ok = await copyText(s._id);
                toast(ok ? "Copied ✅" : "Copy failed ❌");
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10"
            >
              <Copy className="h-4 w-4" /> Copy
            </button>

            <button
              type="button"
              onClick={() => onDetails(s)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10"
            >
              <Info className="h-4 w-4" /> Details
            </button>

            <button
              type="button"
              onClick={() => onBuy(s)}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-400"
            >
              <ShoppingCart className="h-4 w-4" /> Buy
            </button>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="violet">{s.platform}</Badge>
          <Badge tone="blue">{s.category}</Badge>
          {isFav ? (
            <Badge tone="amber">
              <Star className="h-3.5 w-3.5" /> Pinned
            </Badge>
          ) : null}
        </div>
        <Badge tone={connected ? "emerald" : "red"}>
          {connected ? (
            <span className="inline-flex items-center gap-1">
              <BadgeCheck className="h-3.5 w-3.5" /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <LinkIcon className="h-3.5 w-3.5" /> Missing ID
            </span>
          )}
        </Badge>
      </div>

      <div className="mt-3 text-base font-semibold text-white">{s.name}</div>
      <div className="mt-1 line-clamp-2 text-sm text-zinc-200/70">{s.description || "—"}</div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
          <div className="text-zinc-200/70">Rate</div>
          <div className="mt-0.5 font-semibold text-white">{money2(s.rate)}€</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
          <div className="text-zinc-200/70">Min</div>
          <div className="mt-0.5 font-semibold text-white">{s.min || "—"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
          <div className="text-zinc-200/70">Max</div>
          <div className="mt-0.5 font-semibold text-white">{s.max || "—"}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-200/60">id …{String(s._id).slice(-6)}</div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleFav(s._id)}
            className={cn(
              "rounded-2xl border p-2 transition",
              isFav
                ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                : "border-white/10 bg-white/5 text-white hover:bg-white/10"
            )}
            title={isFav ? "Unpin" : "Pin"}
          >
            {isFav ? <Star className="h-4 w-4" /> : <StarOff className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={async () => {
              const ok = await copyText(s._id);
              toast(ok ? "Copied ✅" : "Copy failed ❌");
            }}
            className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white hover:bg-white/10"
            title="Copy serviceId"
          >
            <Copy className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onDetails(s)}
            className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white hover:bg-white/10"
            title="Details"
          >
            <Info className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onBuy(s)}
            className="rounded-2xl bg-amber-500 p-2 text-black hover:bg-amber-400"
            title="Buy"
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 hidden text-xs text-zinc-200/50 group-hover:block">
        Featured ranks connected services first. Perfect for scaling.
      </div>
    </GlassCard>
  );
}

/* ------------------------------ Favorites storage ------------------------------ */

const FAV_KEY = "smm_favs_v1";

function loadFavs() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr = JSON.parse(raw || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveFavs(set) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

/* ------------------------------ Main page ------------------------------ */

export default function Services() {
  const nav = useNavigate();
  const loc = useLocation();

  // ✅ base path: radi i na /services i na /app/services
  const base = loc.pathname.startsWith("/app") ? "/app" : "";
  const to = (p) => (p.startsWith("/") ? `${base}${p}` : `${base}/${p}`);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // UI state
  const [platform, setPlatform] = useState("Instagram");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("featured");
  const [view, setView] = useState("grid");
  const [onlyConnected, setOnlyConnected] = useState(false);

  const [price, setPrice] = useState({ min: 0, max: 50 });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeService, setActiveService] = useState(null);

  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const [favs, setFavs] = useState(() => loadFavs());

  const platforms = useMemo(
    () => [
      "Instagram",
      "TikTok",
      "YouTube",
      "Facebook",
      "Twitter/X",
      "Telegram",
      "Spotify",
      "Snapchat",
      "Discord",
      "Website Traffic",
      "Other",
    ],
    []
  );

  function showToast(msg) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1400);
  }

  function toggleFav(id) {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavs(next);
      return next;
    });
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await api.servicesPublic(); // public-safe endpoint
        const list = Array.isArray(res) ? res : res?.services || [];
        const norm = list.map(normalizeService).filter((x) => x._id && x.enabled !== false);
        if (mounted) setItems(norm);

        // auto-set platform if current selected has 0
        if (mounted) {
          const counts = new Map(platforms.map((p) => [p, 0]));
          for (const s of norm) counts.set(s.platform || "Other", (counts.get(s.platform || "Other") || 0) + 1);

          if ((counts.get(platform) || 0) === 0) {
            const first = platforms.find((p) => (counts.get(p) || 0) > 0) || "Other";
            setPlatform(first);
          }
        }

        // auto-set price max based on data
        const rates = norm.map((x) => safeNum(x.rate, 0)).filter((x) => x > 0);
        const maxRate = rates.length ? Math.min(999, Math.max(...rates)) : 50;
        if (mounted) setPrice({ min: 0, max: Math.max(10, Math.ceil(maxRate)) });
      } catch (e) {
        if (mounted) setErr(e?.message || "Failed to load services");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    for (const s of items) set.add((s.category || "Other").trim() || "Other");
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const platformCounts = useMemo(() => {
    const map = new Map();
    for (const p of platforms) map.set(p, 0);
    for (const s of items) {
      const key = s.platform || "Other";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [items, platforms]);

  const platformConnectedCounts = useMemo(() => {
    const map = new Map();
    for (const p of platforms) map.set(p, 0);
    for (const s of items) {
      if (!s.externalServiceId) continue;
      const key = s.platform || "Other";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [items, platforms]);

  const stats = useMemo(() => {
    const inPlatform = items.filter((x) => (x.platform || "Other") === platform);
    const connected = inPlatform.filter((x) => x.externalServiceId).length;
    const total = inPlatform.length;

    const rates = inPlatform.map((x) => safeNum(x.rate, 0)).filter((x) => x > 0);
    const minRate = rates.length ? Math.min(...rates) : 0;
    const maxRate = rates.length ? Math.max(...rates) : 0;

    const catCount = new Map();
    for (const s of inPlatform) catCount.set(s.category, (catCount.get(s.category) || 0) + 1);
    const topCats = Array.from(catCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

    return {
      total,
      connected,
      connectedPct: total ? Math.round((connected / total) * 100) : 0,
      minRate,
      maxRate,
      topCats,
    };
  }, [items, platform]);

  const pinned = useMemo(() => {
    if (!favs || favs.size === 0) return [];
    const arr = items.filter((x) => favs.has(x._id));
    arr.sort((a, b) => {
      if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
      return a.rate - b.rate;
    });
    return arr;
  }, [items, favs]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    let out = items.filter((s) => {
      if ((s.platform || "Other") !== platform) return false;
      if (cat !== "all" && s.category !== cat) return false;
      if (onlyConnected && !s.externalServiceId) return false;

      const r = safeNum(s.rate, 0);
      if (r < price.min || r > price.max) return false;

      if (!qq) return true;
      const hay = `${s.name} ${s.category} ${s.description}`.toLowerCase();
      return hay.includes(qq);
    });

    if (sort === "featured") {
      const qq2 = q.trim().toLowerCase();
      out.sort((a, b) => {
        const ap = favs.has(a._id) ? 1 : 0;
        const bp = favs.has(b._id) ? 1 : 0;
        if (bp !== ap) return bp - ap;

        const ac = a.externalServiceId ? 1 : 0;
        const bc = b.externalServiceId ? 1 : 0;
        if (bc !== ac) return bc - ac;

        if (qq2) {
          const aHit = a.name.toLowerCase().includes(qq2) ? 1 : 0;
          const bHit = b.name.toLowerCase().includes(qq2) ? 1 : 0;
          if (bHit !== aHit) return bHit - aHit;
        }

        if (a.rate !== b.rate) return a.rate - b.rate;
        return a.name.localeCompare(b.name);
      });
    }
    if (sort === "price_asc") out.sort((a, b) => a.rate - b.rate);
    if (sort === "price_desc") out.sort((a, b) => b.rate - a.rate);
    if (sort === "name_asc") out.sort((a, b) => a.name.localeCompare(b.name));

    return out;
  }, [items, platform, q, cat, sort, onlyConnected, price, favs]);

  const [page, setPage] = useState(1);
  const pageSize = view === "list" ? 12 : 18;

  useEffect(() => setPage(1), [platform, q, cat, sort, view, onlyConnected, price]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  function buyNow(s) {
    nav(to(`/create-order?serviceId=${encodeURIComponent(s._id)}`));
  }

  function openDetails(s) {
    setActiveService(s);
    setDetailsOpen(true);
  }

  function resetFilters() {
    setQ("");
    setCat("all");
    setSort("featured");
    setOnlyConnected(false);
    const max = Math.max(price.max, 10);
    setPrice({ min: 0, max });
  }

  const connectedCount = useMemo(() => filtered.filter((x) => x.externalServiceId).length, [filtered]);

  return (
    <div className="space-y-4">
      {/* masonry css */}
      <style>{`
        .masonry { column-gap: 1rem; }
        @media (min-width: 768px){ .masonry{ column-count: 2; } }
        @media (min-width: 1024px){ .masonry{ column-count: 3; } }
        @media (min-width: 1536px){ .masonry{ column-count: 4; } }
      `}</style>

      {/* toast */}
      {toast ? (
        <div className="fixed right-4 top-4 z-50 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-sm text-zinc-100 backdrop-blur-xl shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
          {toast}
        </div>
      ) : null}

      {/* header */}
      <GlassCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-3xl font-black tracking-tight text-white">Services</div>
              <Badge tone="violet">
                <Sparkles className="h-3.5 w-3.5" /> 2050 Mode
              </Badge>
              <Badge tone="blue">
                <Layers className="h-3.5 w-3.5" /> {platform}
              </Badge>
              <Badge tone={stats.connected ? "emerald" : "red"}>{stats.connectedPct}% connected</Badge>
            </div>

            <div className="mt-2 text-sm text-zinc-200/70">
              Choose platform → filter → pin favorites → instant buy. Clean, fast, public-safe.
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-zinc-200/60">Services</div>
                <div className="mt-1 text-xl font-black text-white">{fmtInt(stats.total)}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-zinc-200/60">Connected</div>
                <div className="mt-1 text-xl font-black text-white">{fmtInt(stats.connected)}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-zinc-200/60">Rate range</div>
                <div className="mt-1 text-xl font-black text-white">
                  {money2(stats.minRate)}€ – {money2(stats.maxRate)}€
                </div>
                <div className="text-xs text-zinc-200/60">per 1000</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-zinc-200/60">Top categories</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {stats.topCats.length ? (
                    stats.topCats.map(([c, n]) => (
                      <Badge key={c} tone="zinc" className="max-w-full">
                        <Tag className="h-3.5 w-3.5" /> {c} ({n})
                      </Badge>
                    ))
                  ) : (
                    <div className="text-sm text-zinc-200/70">—</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ✅ no <a href> (no reload), respects /app */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => nav(to("/create-order"))}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
            >
              <ShoppingCart className="h-4 w-4" /> Create order
            </button>
            <button
              type="button"
              onClick={() => nav(to("/wallet"))}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
            >
              <Sparkles className="h-4 w-4" /> Wallet
            </button>
          </div>
        </div>
      </GlassCard>

      {/* platform chips */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {platforms.map((p) => {
            const total = platformCounts.get(p) || 0;
            const conn = platformConnectedCounts.get(p) || 0;
            const active = platform === p;

            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition",
                  active
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                    : "border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                )}
                title={`${total} services (${conn} connected)`}
              >
                <span className="font-semibold">{p}</span>
                <span className={cn("text-xs opacity-75", active ? "" : "text-zinc-300")}>{total}</span>
                {conn ? (
                  <Badge tone="emerald" className="ml-1">
                    <BadgeCheck className="h-3.5 w-3.5" /> {conn}
                  </Badge>
                ) : null}
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* ✅ sticky controls (offset a bit so it doesn't fight topbar) */}
      <div className="sticky top-3 z-10">
        <GlassCard className="p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex w-full flex-col gap-2 xl:flex-row xl:items-center">
              <div className="relative w-full xl:w-[380px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300/60" />
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-9 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-200/40 focus:border-white/20"
                  placeholder="Search services… followers, likes, views…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q ? (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-white/5 p-1.5 text-zinc-100 hover:bg-white/10"
                    title="Clear"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-100/80">
                  <SlidersHorizontal className="h-4 w-4" /> Control
                </span>

                {/* ✅ mobile filters toggle */}
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen((v) => !v)}
                  className="xl:hidden inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 hover:bg-white/10"
                >
                  <Filter className="h-4 w-4" /> Filters
                </button>

                <select
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-white/20"
                  value={cat}
                  onChange={(e) => setCat(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-zinc-950">
                      {c === "all" ? "All categories" : c}
                    </option>
                  ))}
                </select>

                <select
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-white/20"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="featured" className="bg-zinc-950">
                    Sort: Featured (Smart)
                  </option>
                  <option value="price_asc" className="bg-zinc-950">
                    Price: Low → High
                  </option>
                  <option value="price_desc" className="bg-zinc-950">
                    Price: High → Low
                  </option>
                  <option value="name_asc" className="bg-zinc-950">
                    Name: A → Z
                  </option>
                </select>

                <button
                  type="button"
                  onClick={() => setOnlyConnected((x) => !x)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm transition",
                    onlyConnected
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                  )}
                  title="Show only provider-connected services"
                >
                  <BadgeCheck className="h-4 w-4" />
                  Connected
                </button>

                {/* desktop price range */}
                <div className="hidden xl:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                  <ArrowUpDown className="h-4 w-4 text-zinc-100/70" />
                  <Range
                    min={0}
                    max={Math.max(10, price.max)}
                    valueMin={Math.min(price.min, price.max)}
                    valueMax={Math.max(price.min, price.max)}
                    onChange={(v) => {
                      const mn = Math.max(0, Math.min(v.min, v.max));
                      const mx = Math.max(mn, Math.max(v.min, v.max));
                      setPrice({ min: mn, max: mx });
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 hover:bg-white/10"
                  title="Reset filters"
                >
                  <X className="h-4 w-4" />
                  Reset
                </button>

                <Segmented value={view} onChange={setView} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 xl:justify-end">
              <div className="text-sm text-zinc-200/70">
                Showing <b className="text-white">{filtered.length}</b> • page{" "}
                <b className="text-white">
                  {page}/{totalPages}
                </b>
              </div>

              <Badge tone={connectedCount ? "emerald" : "red"}>
                <LinkIcon className="h-3.5 w-3.5" /> {connectedCount}/{filtered.length} connected
              </Badge>
            </div>
          </div>

          {/* ✅ mobile filters panel */}
          {mobileFiltersOpen ? (
            <div className="xl:hidden mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Price range</div>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-zinc-100 hover:bg-white/10"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-zinc-100/70" />
                <Range
                  min={0}
                  max={Math.max(10, price.max)}
                  valueMin={Math.min(price.min, price.max)}
                  valueMax={Math.max(price.min, price.max)}
                  onChange={(v) => {
                    const mn = Math.max(0, Math.min(v.min, v.max));
                    const mx = Math.max(mn, Math.max(v.min, v.max));
                    setPrice({ min: mn, max: mx });
                  }}
                />
              </div>
            </div>
          ) : null}
        </GlassCard>
      </div>

      {/* pinned */}
      {pinned.length ? (
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge tone="amber">
                <Flame className="h-3.5 w-3.5" /> Pinned services
              </Badge>
              <div className="text-sm text-zinc-200/70">Your “fast-buy” set (stored in browser).</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFavs(() => {
                  const empty = new Set();
                  saveFavs(empty);
                  showToast("Pinned cleared ✅");
                  return empty;
                });
              }}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-100 hover:bg-white/10"
            >
              Clear pinned
            </button>
          </div>

          <div className="masonry">
            {pinned.slice(0, 12).map((s) => (
              <div key={s._id} className="mb-4 break-inside-avoid">
                <ServiceCard
                  s={s}
                  view="grid"
                  onBuy={buyNow}
                  onDetails={openDetails}
                  toast={showToast}
                  isFav={favs.has(s._id)}
                  toggleFav={toggleFav}
                />
              </div>
            ))}
          </div>
        </GlassCard>
      ) : null}

      {/* list */}
      {loading ? (
        <div className={cn(view === "list" ? "space-y-3" : "masonry")}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={cn(view === "list" ? "" : "mb-4 break-inside-avoid")}>
              <Skeleton className="h-40 w-full" />
            </div>
          ))}
        </div>
      ) : err ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
          {err}
        </div>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-6">
          <div className="text-white font-semibold">No services found</div>
          <div className="mt-1 text-sm text-zinc-200/70">
            Try changing platform/category, price range or clearing search.
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            <Sparkles className="h-4 w-4" /> Reset filters
          </button>
        </GlassCard>
      ) : (
        <>
          {view === "grid" ? (
            <div className="masonry">
              {paged.map((s) => (
                <div key={s._id} className="mb-4 break-inside-avoid">
                  <ServiceCard
                    s={s}
                    view="grid"
                    onBuy={buyNow}
                    onDetails={openDetails}
                    toast={showToast}
                    isFav={favs.has(s._id)}
                    toggleFav={toggleFav}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {paged.map((s) => (
                <ServiceCard
                  key={s._id}
                  s={s}
                  view="list"
                  onBuy={buyNow}
                  onDetails={openDetails}
                  toast={showToast}
                  isFav={favs.has(s._id)}
                  toggleFav={toggleFav}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-200/60">
              Featured = pinned → connected → best price → clean naming. Pure SaaS.
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm",
                  page <= 1
                    ? "cursor-not-allowed border-white/5 bg-white/5 text-white/40"
                    : "border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                )}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm",
                  page >= totalPages
                    ? "cursor-not-allowed border-white/5 bg-white/5 text-white/40"
                    : "border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                )}
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      <ServiceModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        service={activeService}
        onBuy={buyNow}
        toast={showToast}
        isFav={activeService ? favs.has(activeService._id) : false}
        toggleFav={toggleFav}
      />
    </div>
  );
}

function fmtInt(n) {
  const v = Math.round(safeNum(n, 0));
  try {
    return new Intl.NumberFormat(undefined).format(v);
  } catch {
    return String(v);
  }
}
