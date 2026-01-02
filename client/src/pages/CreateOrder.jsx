import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import {
  Sparkles,
  BadgeCheck,
  Link as LinkIcon,
  Search,
  X,
  Star,
  StarOff,
  Copy,
  Info,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Wallet,
  Zap,
  ShieldCheck,
  SlidersHorizontal,
  ArrowUpRight,
} from "lucide-react";

/* =========================
   Helpers
========================= */

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function cap(s) {
  if (!s) return "";
  const t = String(s);
  return t.slice(0, 1).toUpperCase() + t.slice(1);
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function money2(n) {
  return (Math.round(safeNum(n, 0) * 100) / 100).toFixed(2);
}

function fmtMoneySmart(value, currency = "EUR") {
  const v = safeNum(value, 0);
  const abs = Math.abs(v);

  const decimals =
    abs === 0 ? 2 :
    abs < 0.01 ? 6 :
    abs < 1 ? 4 : 2;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(v);
  } catch {
    return `${v.toFixed(decimals)} ${currency}`;
  }
}

function fmtRatePer1000(rate) {
  const r = safeNum(rate, 0);
  const abs = Math.abs(r);
  const decimals =
    abs === 0 ? 2 :
    abs < 0.01 ? 6 :
    abs < 1 ? 4 : 2;
  return `${r.toFixed(decimals)}€ / 1000`;
}

function fmtInt(n) {
  const v = Math.round(safeNum(n, 0));
  try {
    return new Intl.NumberFormat(undefined).format(v);
  } catch {
    return String(v);
  }
}

function getRatePer1000(svc) {
  const v = svc?.pricePer1000 ?? svc?.ratePer1000 ?? svc?.rate ?? 0;
  return safeNum(v, 0);
}

async function copyText(s) {
  try {
    await navigator.clipboard.writeText(String(s ?? ""));
    return true;
  } catch {
    return false;
  }
}

function clamp(n, a, b) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

/* =========================
   Storage keys
========================= */

const FAV_KEY = "smm_favs_v1";
const RECENT_LINKS_KEY = "smm_recent_links_v1";

function loadSet(key) {
  try {
    const raw = localStorage.getItem(key);
    const arr = JSON.parse(raw || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function saveSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {}
}

function loadRecentLinks() {
  try {
    const raw = localStorage.getItem(RECENT_LINKS_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveRecentLinks(arr) {
  try {
    localStorage.setItem(RECENT_LINKS_KEY, JSON.stringify(arr.slice(0, 8)));
  } catch {}
}

/* =========================
   UI atoms
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

function StepPill({ idx, active, done, title, sub }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3 py-2",
        active ? "border-amber-500/35 bg-amber-500/10" : "border-white/10 bg-white/5"
      )}
    >
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-xl border text-xs font-black",
          done
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
            : active
            ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
            : "border-white/10 bg-white/5 text-zinc-100/80"
        )}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : idx}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-white">{title}</div>
        {sub ? <div className="text-[11px] text-zinc-200/60">{sub}</div> : null}
      </div>
    </div>
  );
}

function Skeleton({ className = "" }) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/10", className)} />;
}

/* =========================
   Quick presets
========================= */

const PRESETS = [
  { label: "Followers", hint: "Most common", query: "followers" },
  { label: "Likes", hint: "Engagement", query: "likes" },
  { label: "Views", hint: "Reach", query: "views" },
  { label: "Comments", hint: "Social proof", query: "comments" },
  { label: "Saves", hint: "IG saves", query: "saves" },
];

/* =========================
   Service Picker Modal (iOS SAFE)
========================= */

function ServicePickerModal({
  open,
  onClose,
  services,
  favs,
  toggleFav,
  onPick,
  onlyConnected,
  setOnlyConnected,
  q,
  setQ,
  showToast,
  selectedId,
}) {
  const focusRef = useRef(null);
  const panelRef = useRef(null);     // ✅ scroll container for whole modal (iOS)
  const listRef = useRef(null);      // list scroll (desktop)
  const lastActiveElRef = useRef(null);

  const [cursor, setCursor] = useState(0);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let out = services.map((s) => {
      const id = String(s._id);
      const rate = getRatePer1000(s);
      const connected = Boolean(s.externalServiceId || s.providerServiceId);
      const name = String(s.name || "");
      const cat = String(s.category || "");
      const plat = String(s.platform || "");
      const desc = String(s.description || "");
      return { s, id, rate, connected, name, cat, plat, desc };
    });

    if (onlyConnected) out = out.filter((x) => x.connected);

    if (qq) {
      out = out.filter((x) => {
        const hay = `${x.name} ${x.cat} ${x.plat} ${x.desc}`.toLowerCase();
        return hay.includes(qq);
      });
    }

    // Smart ranking: pinned → connected → cheapest → shorter name → alpha
    out.sort((a, b) => {
      const ap = favs.has(a.id) ? 1 : 0;
      const bp = favs.has(b.id) ? 1 : 0;
      if (bp !== ap) return bp - ap;

      const ac = a.connected ? 1 : 0;
      const bc = b.connected ? 1 : 0;
      if (bc !== ac) return bc - ac;

      if (a.rate !== b.rate) return a.rate - b.rate;
      if (a.name.length !== b.name.length) return a.name.length - b.name.length;
      return a.name.localeCompare(b.name);
    });

    return out;
  }, [services, q, onlyConnected, favs]);

  useEffect(() => setCursor(0), [q, onlyConnected, open]);

  // ✅ BODY SCROLL LOCK + restore focus (safe modal behavior)
  useEffect(() => {
    if (!open) return;

    lastActiveElRef.current = document.activeElement;

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
      // restore focus
      try {
        lastActiveElRef.current?.focus?.();
      } catch {}
    };
  }, [open]);

  // ✅ Focus initial
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => focusRef.current?.focus?.(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // ✅ iOS: always reset modal scroll to top so header is visible
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      panelRef.current?.scrollTo?.({ top: 0, behavior: "auto" });
      // also list to top for consistency
      listRef.current && (listRef.current.scrollTop = 0);
    });
  }, [open, q, onlyConnected]);

  // ✅ Keyboard navigation
  useEffect(() => {
    if (!open) return;

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(rows.length - 1, c + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (e.key === "Enter") {
        if (!rows[cursor]) return;
        e.preventDefault();
        onPick(rows[cursor].s);
        return;
      }
    }

    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rows, cursor, onClose, onPick]);

  // ✅ keep active row in view (list scroll only)
  useEffect(() => {
    if (!open) return;
    const wrap = listRef.current;
    if (!wrap) return;
    const el = wrap.querySelector(`[data-idx="${cursor}"]`);
    if (!el) return;

    const top = el.offsetTop;
    const bottom = top + el.clientHeight;
    const viewTop = wrap.scrollTop;
    const viewBottom = viewTop + wrap.clientHeight;

    if (top < viewTop) wrap.scrollTop = top - 8;
    if (bottom > viewBottom) wrap.scrollTop = bottom - wrap.clientHeight + 8;
  }, [cursor, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Service picker"
    >
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* ✅ scroll layer (THIS fixes iOS “can’t scroll to top”) */}
      <div className="absolute inset-0 flex items-start justify-center p-3 sm:p-4">
        <div
          ref={panelRef}
          className={cn(
            "w-full max-w-5xl",
            "max-h-[88dvh] overflow-y-auto",
            "rounded-2xl",
            "[-webkit-overflow-scrolling:touch]",
            "overscroll-contain touch-pan-y"
          )}
        >
          <GlassCard className="p-0">
            <div ref={focusRef} tabIndex={-1} className="outline-none">
              <div className="p-5 border-b border-white/10">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xl font-black tracking-tight text-white">Pick a service</div>
                      <Badge tone="violet">
                        <Sparkles className="h-3.5 w-3.5" /> 2050 Picker
                      </Badge>
                      <Badge tone={onlyConnected ? "emerald" : "zinc"}>
                        <BadgeCheck className="h-3.5 w-3.5" /> {onlyConnected ? "Only connected" : "All"}
                      </Badge>
                      <Badge tone="blue">
                        <ShieldCheck className="h-3.5 w-3.5" /> Arrow keys + Enter
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-zinc-200/70">
                      Search → pin favorites → choose. Nema više belog dropdowna.
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOnlyConnected((x) => !x)}
                      className={cn(
                        "rounded-2xl border px-3 py-2 text-sm transition",
                        onlyConnected
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                          : "border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                      )}
                    >
                      {onlyConnected ? "Only connected" : "All services"}
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full md:w-[520px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300/60" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search services… followers, likes, views…"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-9 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-200/40 focus:border-white/20"
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

                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((p) => (
                      <button
                        type="button"
                        key={p.label}
                        onClick={() => {
                          setQ(p.query);
                          showToast(`Preset: ${p.label}`);
                        }}
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-100 hover:bg-white/10"
                        title={p.hint}
                      >
                        <Sparkles className="h-3.5 w-3.5 inline-block mr-1" />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs text-zinc-200/60">
                        Showing <span className="text-zinc-100 font-semibold">{rows.length}</span>
                      </div>
                      <div className="text-xs text-zinc-200/60">
                        Tip: <span className="text-zinc-100">Enter</span> = select •{" "}
                        <span className="text-zinc-100">Esc</span> = close
                      </div>
                    </div>

                    <div
                      ref={listRef}
                      className="max-h-[56vh] overflow-auto rounded-2xl border border-white/10 bg-white/5 overscroll-contain [-webkit-overflow-scrolling:touch]"
                    >
                      {rows.length === 0 ? (
                        <div className="p-4 text-sm text-zinc-200/70">
                          No services found. Try different search or disable “Only connected”.
                        </div>
                      ) : (
                        <div className="divide-y divide-white/10">
                          {rows.map((r, idx) => {
                            const s = r.s;
                            const pinned = favs.has(r.id);
                            const active = idx === cursor;
                            const picked = String(selectedId || "") === r.id;

                            return (
                              <div
                                key={r.id}
                                data-idx={idx}
                                className={cn(
                                  "p-3 transition cursor-pointer",
                                  active ? "bg-white/10" : "hover:bg-white/10"
                                )}
                                onMouseEnter={() => setCursor(idx)}
                                onClick={() => onPick(s)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge tone="violet">{s.platform ? cap(s.platform) : "Other"}</Badge>
                                      <Badge tone="blue">{s.category || "Other"}</Badge>
                                      <Badge tone="amber">{fmtRatePer1000(r.rate)}</Badge>

                                      <Badge tone={r.connected ? "emerald" : "red"}>
                                        {r.connected ? (
                                          <>
                                            <BadgeCheck className="h-3.5 w-3.5" /> Connected
                                          </>
                                        ) : (
                                          <>
                                            <LinkIcon className="h-3.5 w-3.5" /> Missing ID
                                          </>
                                        )}
                                      </Badge>
                                      {picked ? (
                                        <Badge tone="emerald">
                                          <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                                        </Badge>
                                      ) : null}
                                    </div>

                                    <div className="mt-2 text-sm font-semibold text-white truncate">
                                      {s.name || "—"}
                                    </div>

                                    <div className="mt-1 text-xs text-zinc-200/60 line-clamp-1">
                                      {s.description || `min ${s.min ?? "—"} • max ${s.max ?? "—"}`}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-200/60">
                                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                        min {s.min ?? "—"}
                                      </span>
                                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                        max {s.max ?? "—"}
                                      </span>
                                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                        id …{String(r.id).slice(-6)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFav(r.id);
                                        showToast(pinned ? "Unpinned" : "Pinned");
                                      }}
                                      className={cn(
                                        "rounded-2xl border p-2 transition",
                                        pinned
                                          ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                                          : "border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                                      )}
                                      title={pinned ? "Unpin" : "Pin"}
                                    >
                                      {pinned ? <Star className="h-4 w-4" /> : <StarOff className="h-4 w-4" />}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const ok = await copyText(r.id);
                                        showToast(ok ? "Copied serviceId ✅" : "Copy failed ❌");
                                      }}
                                      className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-100 hover:bg-white/10"
                                      title="Copy serviceId"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPick(s);
                                      }}
                                      className="rounded-2xl bg-amber-500 p-2 text-black hover:bg-amber-400"
                                      title="Select"
                                    >
                                      <ArrowUpRight className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <GlassCard className="p-4">
                      <div className="text-sm font-semibold text-white">Why this is better</div>
                      <div className="mt-2 text-xs text-zinc-200/60 leading-relaxed">
                        Native <code className="text-zinc-100">select</code> na Windows-u gazi Tailwind i napravi
                        “beli dropdown” preko cele stranice. Ovaj picker je{" "}
                        <b className="text-zinc-100">100% premium</b>, theme-safe, search + pin + keyboard.
                      </div>
                    </GlassCard>

                    <GlassCard className="p-4">
                      <div className="text-sm font-semibold text-white">Pro tips</div>
                      <div className="mt-2 text-xs text-zinc-200/60 space-y-1">
                        <div>• Pinuj top servise (fav) → uvek gore.</div>
                        <div>• “Only connected” = nema fail ordera zbog missing provider id.</div>
                        <div>• Presets ubrzavaju filtriranje (“followers”, “views”…).</div>
                      </div>
                    </GlassCard>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Main component
========================= */

export default function CreateOrder() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const serviceIdFromUrl = params.get("serviceId") || "";

  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState(serviceIdFromUrl);

  const [link, setLink] = useState("");
  const [qty, setQty] = useState(1000);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const toastRef = useRef(null);

  const [onlyConnected, setOnlyConnected] = useState(true);
  const [q, setQ] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);

  const [favs, setFavs] = useState(() => loadSet(FAV_KEY));
  const [recentLinks, setRecentLinks] = useState(() => loadRecentLinks());

  const [wallet, setWallet] = useState({ loading: true, ok: false, balance: 0, currency: "EUR" });

  function showToast(msg) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 1300);
  }

  function toggleFav(id) {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveSet(FAV_KEY, next);
      return next;
    });
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.servicesPublic();
        const list = Array.isArray(data) ? data : [];
        if (mounted) setServices(list);
      } catch (e) {
        console.error(e);
        if (mounted) {
          setServices([]);
          setError(e?.message || "Failed to load services");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (toastRef.current) clearTimeout(toastRef.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const w = await api.get("/wallet");
        if (!mounted) return;
        setWallet({
          loading: false,
          ok: true,
          balance: safeNum(w?.balance, 0),
          currency: w?.currency || "EUR",
        });
      } catch {
        if (!mounted) return;
        setWallet((p) => ({ ...p, loading: false, ok: false }));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (serviceIdFromUrl) setServiceId(serviceIdFromUrl);
  }, [serviceIdFromUrl]);

  const selected = useMemo(() => {
    return services.find((s) => String(s._id) === String(serviceId)) || null;
  }, [services, serviceId]);

  const selectedConnected = useMemo(() => {
    if (!selected) return false;
    return Boolean(selected.externalServiceId || selected.providerServiceId);
  }, [selected]);

  const safeQty = useMemo(() => {
    const n = Number(qty);
    return Number.isFinite(n) ? n : 0;
  }, [qty]);

  const rate = useMemo(() => getRatePer1000(selected), [selected]);

  const total = useMemo(() => {
    if (!selected) return 0;
    if (!Number.isFinite(safeQty) || safeQty <= 0) return 0;
    return (safeQty / 1000) * rate;
  }, [safeQty, rate, selected]);

  const minMax = useMemo(() => {
    const min = safeNum(selected?.min ?? 0, 0);
    const max = safeNum(selected?.max ?? 0, 0);
    return { min, max };
  }, [selected]);

  const qtyHint = useMemo(() => {
    if (!selected) return "";
    const min = selected.min ?? null;
    const max = selected.max ?? null;
    return `Allowed: ${min ?? "-"} – ${max ?? "-"}`;
  }, [selected]);

  const serviceLabel = useMemo(() => {
    if (!selected) return "";
    const p = selected.platform ? `[${cap(selected.platform)}] ` : "";
    const c = selected.category ? `[${selected.category}] ` : "";
    return `${p}${c}${selected.name}`;
  }, [selected]);

  const step = useMemo(() => {
    if (!selected) return 1;
    const linkTrim = link.trim();
    if (!linkTrim || !isValidUrl(linkTrim)) return 2;
    const qn = safeNum(qty, 0);
    if (!qn) return 3;
    if (minMax.min && qn < minMax.min) return 3;
    if (minMax.max && qn > minMax.max) return 3;
    return 4;
  }, [selected, link, qty, minMax.min, minMax.max]);

  const connectedCount = useMemo(
    () => services.filter((s) => Boolean(s.externalServiceId || s.providerServiceId)).length,
    [services]
  );

  const currency = wallet.ok ? wallet.currency : "EUR";
  const canAfford = wallet.ok ? safeNum(wallet.balance, 0) >= total : true;

  function useRecentLink(u) {
    setLink(u);
    showToast("Link applied ✅");
  }

  function saveLinkIfNew(u) {
    const trimmed = String(u || "").trim();
    if (!trimmed) return;
    const next = [trimmed, ...recentLinks.filter((x) => x !== trimmed)].slice(0, 8);
    setRecentLinks(next);
    saveRecentLinks(next);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!selected) return setError("Select a service");

    const linkTrim = link.trim();
    if (!linkTrim) return setError("Enter a link");
    if (!isValidUrl(linkTrim)) return setError("Invalid link (must be http/https)");

    const qn = Number(qty);
    if (!Number.isFinite(qn) || qn <= 0) return setError("Invalid quantity");

    if (selected.min && qn < selected.min) return setError(`Quantity below min (${selected.min})`);
    if (selected.max && qn > selected.max) return setError(`Quantity above max (${selected.max})`);

    if (wallet.ok && !canAfford) {
      return setError(`Insufficient wallet balance (${fmtMoneySmart(wallet.balance, currency)})`);
    }

    setSubmitting(true);
    try {
      const payload = { serviceId: selected._id, link: linkTrim, quantity: qn };
      await api.post("/orders", payload);

      saveLinkIfNew(linkTrim);
      showToast("Order placed ✅");
      navigate("/orders");
    } catch (e2) {
      console.error(e2);
      setError(e2?.message || "Create order failed");
    } finally {
      setSubmitting(false);
    }
  }

  const qtyNormalized = useMemo(() => {
    if (!selected) return safeNum(qty, 0);
    const min = minMax.min || 0;
    const max = minMax.max || 0;
    if (!max) return safeNum(qty, 0);
    return clamp(safeNum(qty, 0), min || 0, max);
  }, [qty, selected, minMax.min, minMax.max]);

  useEffect(() => {
    if (!selected) return;
    if (!minMax.max && !minMax.min) return;

    const current = safeNum(qty, 0);
    let next = current;

    if (minMax.min && current < minMax.min) next = minMax.min;
    if (minMax.max && current > minMax.max) next = minMax.max;

    if (next !== current) setQty(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?._id]);

  return (
    <div className="space-y-4">
      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-sm text-zinc-100 backdrop-blur-xl shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
          {toast}
        </div>
      ) : null}

      <GlassCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-3xl font-black tracking-tight text-white">Create Order</div>
              <Badge tone="violet">
                <Sparkles className="h-3.5 w-3.5" /> 2050 Flow
              </Badge>
              <Badge tone={selectedConnected ? "emerald" : "zinc"}>
                <LinkIcon className="h-3.5 w-3.5" />{" "}
                {selected ? (selectedConnected ? "Provider ready" : "No provider id") : "Pick service"}
              </Badge>
              <Badge tone="blue">
                <ShieldCheck className="h-3.5 w-3.5" /> Validation + live pricing
              </Badge>
            </div>

            <div className="mt-2 text-sm text-zinc-200/70">
              Premium stepper flow: select → link → quantity → confirm.
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <StepPill idx={1} active={step === 1} done={step > 1} title="Service" sub="Pick best one" />
              <StepPill idx={2} active={step === 2} done={step > 2} title="Link" sub="Valid URL" />
              <StepPill idx={3} active={step === 3} done={step > 3} title="Quantity" sub="Min/max" />
              <StepPill idx={4} active={step === 4} done={false} title="Confirm" sub="Place order" />
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-200/60">Wallet</div>
                <Badge tone={wallet.ok ? "emerald" : "zinc"}>
                  <Wallet className="h-3.5 w-3.5" /> {wallet.loading ? "Loading" : wallet.ok ? "Ready" : "—"}
                </Badge>
              </div>

              <div className="mt-2 text-xl font-black text-white">
                {wallet.ok ? fmtMoneySmart(wallet.balance, currency) : "—"}
              </div>

              <div className="mt-1 text-xs text-zinc-200/60">
                {wallet.ok ? "Will auto-checkout from balance." : "Wallet preview optional."}
              </div>

              {wallet.ok ? (
                <div className="mt-3">
                  <a
                    href="/wallet"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
                  >
                    <Zap className="h-4 w-4" /> Top up
                  </a>
                </div>
              ) : null}
            </div>

            <a
              href="/services"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4" /> Back to services
            </a>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <GlassCard className="p-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : services.length === 0 ? (
            <div className="text-sm text-zinc-300">
              No services found. <span className="text-zinc-500">(Check DB + /services API)</span>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <div className="min-w-0">{error}</div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-300/60">Service</div>
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">
                      <BadgeCheck className="h-3.5 w-3.5" /> {connectedCount}/{services.length} connected
                    </Badge>

                    <button
                      type="button"
                      onClick={() => setOnlyConnected((x) => !x)}
                      className={cn(
                        "rounded-2xl border px-3 py-1.5 text-xs transition",
                        onlyConnected
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                          : "border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                      )}
                      title="Filter only provider-connected services"
                    >
                      {onlyConnected ? "Only connected" : "All services"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAdvanced((x) => !x)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 hover:bg-white/10"
                      title="Advanced controls"
                    >
                      <SlidersHorizontal className="h-4 w-4 inline-block mr-1" />
                      Advanced
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className={cn(
                    "w-full text-left rounded-2xl border border-white/10 bg-white/5 px-4 py-3",
                    "hover:bg-white/10 transition"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {selected ? selected.name : "Select service…"}
                      </div>
                      <div className="mt-1 text-xs text-zinc-200/60 truncate">
                        {selected ? serviceLabel : "Open picker (search + pin + connected filter)"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {selected ? <Badge tone="amber">{fmtRatePer1000(rate)}</Badge> : null}
                      <ChevronRight className="h-4 w-4 text-zinc-200/70" />
                    </div>
                  </div>
                </button>

                {selected ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-white">{serviceLabel}</div>
                          <Badge tone="amber">{fmtRatePer1000(rate)}</Badge>

                          <Badge tone={selectedConnected ? "emerald" : "red"}>
                            {selectedConnected ? (
                              <>
                                <BadgeCheck className="h-3.5 w-3.5" /> Connected
                              </>
                            ) : (
                              <>
                                <LinkIcon className="h-3.5 w-3.5" /> Missing ID
                              </>
                            )}
                          </Badge>

                          <button
                            type="button"
                            onClick={() => {
                              toggleFav(String(selected._id));
                              showToast(favs.has(String(selected._id)) ? "Unpinned" : "Pinned");
                            }}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
                              favs.has(String(selected._id))
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                                : "border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                            )}
                          >
                            {favs.has(String(selected._id)) ? (
                              <Star className="h-3.5 w-3.5" />
                            ) : (
                              <StarOff className="h-3.5 w-3.5" />
                            )}
                            {favs.has(String(selected._id)) ? "Pinned" : "Pin"}
                          </button>
                        </div>

                        <div className="mt-2 text-xs text-zinc-200/60">
                          {selected.description ? selected.description : qtyHint}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge>min {minMax.min || "—"}</Badge>
                          <Badge>max {minMax.max || "—"}</Badge>
                          <Badge tone="blue">id …{String(selected._id).slice(-6)}</Badge>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await copyText(selected._id);
                            showToast(ok ? "Copied serviceId ✅" : "Copy failed ❌");
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-100 hover:bg-white/10"
                        >
                          <Copy className="h-4 w-4" /> Copy ID
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate(`/services`)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-100 hover:bg-white/10"
                          title="Open services browser"
                        >
                          <Info className="h-4 w-4" /> Browse
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* LINK */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-300/60">Link</div>
                  <Badge tone={link.trim() && isValidUrl(link.trim()) ? "emerald" : "zinc"}>
                    <LinkIcon className="h-3.5 w-3.5" />{" "}
                    {link.trim() ? (isValidUrl(link.trim()) ? "Valid" : "Invalid") : "Paste URL"}
                  </Badge>
                </div>

                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://instagram.com/…"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-200/40 focus:border-white/20"
                />

                {recentLinks.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs text-zinc-200/60">Recent:</div>
                    {recentLinks.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => useRecentLink(u)}
                        className="max-w-[320px] truncate rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 hover:bg-white/10"
                        title={u}
                      >
                        {u}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setRecentLinks([]);
                        saveRecentLinks([]);
                        showToast("Recent cleared ✅");
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 hover:bg-white/10"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
              </div>

              {/* QUANTITY */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-300/60">Quantity</div>
                  <Badge tone={selected ? "blue" : "zinc"}>
                    <Zap className="h-3.5 w-3.5" /> {selected ? qtyHint : "Select service first"}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-zinc-200/70">Quick adjust</div>
                      <div className="text-sm font-semibold text-white">{fmtInt(qtyNormalized)}</div>
                    </div>

                    {selected && (minMax.max || minMax.min) ? (
                      <div className="mt-3">
                        <input
                          type="range"
                          min={minMax.min || 0}
                          max={minMax.max || Math.max(5000, qtyNormalized)}
                          value={qtyNormalized}
                          onChange={(e) => setQty(Number(e.target.value))}
                          className="w-full"
                        />
                        <div className="mt-2 flex items-center justify-between text-xs text-zinc-200/60">
                          <span>min {minMax.min || "—"}</span>
                          <span>max {minMax.max || "—"}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-zinc-200/60">Slider unlocks after selecting service limits.</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      min={selected?.min ?? undefined}
                      max={selected?.max ?? undefined}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
                    />
                    {selected ? (
                      <div className="text-xs text-zinc-200/60">
                        Tip: set within <b className="text-zinc-100">{minMax.min || "-"}</b> to{" "}
                        <b className="text-zinc-100">{minMax.max || "-"}</b>.
                      </div>
                    ) : null}
                  </div>
                </div>

                {selected ? (
                  <div className="flex flex-wrap gap-2">
                    {minMax.min && safeQty < minMax.min ? (
                      <Badge tone="red">
                        <AlertCircle className="h-3.5 w-3.5" /> Below min
                      </Badge>
                    ) : null}
                    {minMax.max && safeQty > minMax.max ? (
                      <Badge tone="red">
                        <AlertCircle className="h-3.5 w-3.5" /> Above max
                      </Badge>
                    ) : null}
                    {selectedConnected ? (
                      <Badge tone="emerald">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Provider ready
                      </Badge>
                    ) : (
                      <Badge tone="amber">
                        <Info className="h-3.5 w-3.5" /> Might not place if provider id missing
                      </Badge>
                    )}
                  </div>
                ) : null}
              </div>

              {showAdvanced ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">Advanced</div>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(false)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 hover:bg-white/10"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-zinc-200/60">
                    Next level: dripfeed/refill/speed once your Service model includes it.
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "w-full rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  "bg-amber-500 text-black hover:bg-amber-400",
                  "disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                {submitting ? "Placing order…" : "Place order"}
              </button>
            </form>
          )}
        </GlassCard>

        {/* RIGHT: summary */}
        <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Order summary</div>
              <Badge tone={step === 4 ? "emerald" : "zinc"}>
                <Sparkles className="h-3.5 w-3.5" /> Step {step}/4
              </Badge>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-zinc-200/60">Service</div>
                <div className="mt-1 text-sm font-semibold text-white">{selected ? selected.name : "—"}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="blue">{selected?.category || "—"}</Badge>
                  <Badge tone="violet">{selected?.platform ? cap(selected.platform) : "—"}</Badge>
                  <Badge tone="amber">{fmtRatePer1000(rate)}</Badge>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-zinc-200/60">Link</div>
                <div className="mt-1 text-sm text-zinc-100">
                  {link.trim() ? (
                    <span className={cn(isValidUrl(link.trim()) ? "" : "text-red-200")}>{link.trim()}</span>
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-200/60">Quantity</div>
                  <Badge>{fmtInt(qtyNormalized)}</Badge>
                </div>
                <div className="mt-2 text-xs text-zinc-200/60">{selected ? qtyHint : "—"}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-200/70">Estimated price</div>
                  <div className="text-lg font-black text-white">{fmtMoneySmart(total, currency)}</div>
                </div>

                <div className="mt-1 text-xs text-zinc-200/60">
                  (quantity / 1000) × rate ({fmtRatePer1000(rate)})
                </div>

                {wallet.ok ? (
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-zinc-200/60">Wallet after</span>
                    <span className={cn(canAfford ? "text-emerald-200" : "text-red-200")}>
                      {fmtMoneySmart(wallet.balance - total, currency)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <a
                href="/orders"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
              >
                View orders <ChevronRight className="h-4 w-4" />
              </a>

              <a
                href="/services"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
              >
                Services <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="text-sm font-semibold text-white">Quick actions</div>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!selected?._id) return showToast("Select a service first");
                  const ok = await copyText(selected._id);
                  showToast(ok ? "Copied serviceId ✅" : "Copy failed ❌");
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
              >
                <Copy className="h-4 w-4" /> Copy serviceId
              </button>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setLink("");
                  setQty(1000);
                  setServiceId("");
                  showToast("Reset ✅");
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10"
              >
                <X className="h-4 w-4" /> Reset form
              </button>

              <button
                type="button"
                onClick={() => navigate("/wallet")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-400"
              >
                <Wallet className="h-4 w-4" /> Top up wallet
              </button>
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="text-xs text-zinc-200/50">
        2050 UX: custom picker (no native select bugs) + pinned services + validation + wallet preview.
      </div>

      <ServicePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        services={services}
        favs={favs}
        toggleFav={toggleFav}
        onlyConnected={onlyConnected}
        setOnlyConnected={setOnlyConnected}
        q={q}
        setQ={setQ}
        showToast={showToast}
        selectedId={serviceId}
        onPick={(svc) => {
          setServiceId(String(svc._id));
          setPickerOpen(false);
          showToast("Service selected ✅");
        }}
      />
    </div>
  );
}
