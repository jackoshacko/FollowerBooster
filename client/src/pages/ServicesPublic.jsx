// client/src/pages/ServicesPublic.jsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
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

function buildNext(url) {
  return encodeURIComponent(url);
}

function Pill({ children, tone = "neutral", title, className }) {
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
        tones[tone] || tones.neutral,
        className
      )}
    >
      {children}
    </span>
  );
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

function Kpi({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-soft">
      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-300/70">{label}</div>
      <div className="mt-1 text-lg font-black tracking-tight text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-300/70">{hint}</div> : null}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-soft">
      <div className="h-4 w-2/3 rounded bg-white/10" />
      <div className="mt-3 flex gap-2">
        <div className="h-5 w-16 rounded-full bg-white/10" />
        <div className="h-5 w-20 rounded-full bg-white/10" />
        <div className="h-5 w-24 rounded-full bg-white/10" />
      </div>
      <div className="mt-4 h-10 w-full rounded bg-white/10" />
      <div className="mt-4 flex items-center justify-between">
        <div className="h-6 w-20 rounded bg-white/10" />
        <div className="h-9 w-24 rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}

/**
 * ✅ STICKY THAT ALWAYS WORKS (even if parent has overflow/transform)
 * - behaves like "sticky", but uses "fixed" when you scroll past it
 * - adds placeholder height so layout doesn't jump
 */
function SmartSticky({ topOffset = 64, children }) {
  const wrapRef = useRef(null);
  const barRef = useRef(null);

  const [stuck, setStuck] = useState(false);
  const [barH, setBarH] = useState(0);
  const [barW, setBarW] = useState(null);
  const [barLeft, setBarLeft] = useState(0);

  const measure = () => {
    const wrap = wrapRef.current;
    const bar = barRef.current;
    if (!wrap || !bar) return;

    const r = wrap.getBoundingClientRect();
    const h = bar.getBoundingClientRect().height;

    setBarH(h);
    setBarW(r.width);
    setBarLeft(r.left);
  };

  const onScroll = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const top = wrap.getBoundingClientRect().top;
    const shouldStick = top <= topOffset;

    setStuck((prev) => (prev === shouldStick ? prev : shouldStick));

    if (shouldStick) measure();
  };

  useLayoutEffect(() => {
    measure();
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topOffset]);

  useLayoutEffect(() => {
    measure();
  });

  return (
    <div ref={wrapRef} className="relative">
      {stuck ? <div style={{ height: barH }} /> : null}

      <div
        ref={barRef}
        className={cls(stuck ? "fixed z-[999]" : "relative z-10")}
        style={
          stuck
            ? {
                top: `${topOffset}px`,
                left: `${barLeft}px`,
                width: barW ? `${barW}px` : undefined,
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

function ServiceModal({ open, onClose, s, authed, onBuy }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !s) return null;

  const id = s?._id || s?.id;
  const cur = s?.currency || "EUR";
  const price = s?.pricePer1000 ?? s?.price ?? 0;

  return (
    <div className="fixed inset-0 z-[1000] px-3 py-6 md:py-10">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        className={cls(
          "relative mx-auto w-full max-w-3xl overflow-hidden",
          "rounded-3xl border border-white/12 bg-zinc-950/92 backdrop-blur-2xl",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_120px_rgba(0,0,0,0.65)]"
        )}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-purple-500/14 blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-cyan-500/12 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(900px_180px_at_15%_0%,rgba(255,255,255,0.10),transparent_70%)]" />
        </div>

        <div className="relative p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="violet">2050</Pill>
                <Pill tone="info">Public catalog</Pill>
                {!authed ? <Pill tone="warn">Login required</Pill> : <Pill tone="ok">Ready</Pill>}
              </div>

              <h2 className="mt-3 text-xl md:text-2xl font-black tracking-tight text-white truncate">
                {s?.name || "Service"}
              </h2>

              <div className="mt-2 flex flex-wrap gap-2">
                {s?.platform ? <Pill>{s.platform}</Pill> : null}
                {s?.type ? <Pill>{s.type}</Pill> : null}
                {s?.category ? <Pill>{s.category}</Pill> : null}
              </div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 hover:border-white/20 transition"
              title="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <div className="text-xs text-zinc-300/70">Price / 1k</div>
              <div className="mt-1 text-lg font-black text-white">{fmtMoney(price, cur)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <div className="text-xs text-zinc-300/70">Min</div>
              <div className="mt-1 text-lg font-black text-white">{s?.min ?? "—"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <div className="text-xs text-zinc-300/70">Max</div>
              <div className="mt-1 text-lg font-black text-white">{s?.max ?? "—"}</div>
            </div>
          </div>

          {s?.description ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-300/70">Description</div>
              <div className="mt-2 text-sm text-zinc-200/80 leading-relaxed">{s.description}</div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            {!authed ? (
              <div className="text-sm text-zinc-200/70">Create an account and sign in to order.</div>
            ) : (
              <div className="text-sm text-zinc-200/70">You’re authenticated — continue.</div>
            )}

            <div className="flex items-center gap-2">
              {!authed ? (
                <>
                  <NavLink
                    to="/register"
                    className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition"
                  >
                    Create account
                  </NavLink>
                  <button
                    onClick={() => onBuy?.(id)}
                    className="rounded-2xl px-4 py-2 text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-200 transition active:scale-[0.99]"
                    type="button"
                  >
                    Login to buy
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onBuy?.(id)}
                  className="rounded-2xl px-5 py-2.5 text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-200 transition active:scale-[0.99]"
                  type="button"
                >
                  Buy now
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/10 bg-black/20 px-5 py-4 text-xs text-zinc-300/70">
          Premium UI • guest browse • account required to order
        </div>
      </div>
    </div>
  );
}

function isProbablyMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
}

export default function ServicesPublic() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);

  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("pop");
  const [onlyInStock, setOnlyInStock] = useState(false);

  const [authed, setAuthed] = useState(() => !!localStorage.getItem("token"));

  const [selected, setSelected] = useState(null);
  const [openModal, setOpenModal] = useState(false);

  const [topOffset, setTopOffset] = useState(64);

  // ✅ Load more
  const [isMobile, setIsMobile] = useState(() => isProbablyMobile());
  const INITIAL = isMobile ? 24 : 36;
  const STEP = isMobile ? 24 : 36;
  const [visibleCount, setVisibleCount] = useState(INITIAL);

  // track mobile changes on resize
  useEffect(() => {
    const onResize = () => {
      const m = isProbablyMobile();
      setIsMobile(m);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // when mobile/desktop changes, reset visible safely
  useEffect(() => {
    const init = isMobile ? 24 : 36;
    setVisibleCount((v) => Math.max(init, Math.min(v, 500))); // keep sane cap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  useEffect(() => {
    const read = () => {
      try {
        const raw = getComputedStyle(document.documentElement).getPropertyValue("--pubTop").trim();
        if (!raw) return setTopOffset(64);
        const n = parseFloat(raw.replace("px", ""));
        if (Number.isFinite(n) && n >= 0) setTopOffset(n);
        else setTopOffset(64);
      } catch {
        setTopOffset(64);
      }
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  useEffect(() => {
    const sync = () => setAuthed(!!localStorage.getItem("token"));
    const onAuthChanged = () => sync();
    const onStorage = (e) => e.key === "token" && sync();

    window.addEventListener("auth-changed", onAuthChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get("/services");
        if (!alive) return;
        setList(Array.isArray(data) ? data : []);
      } catch {
        if (!alive) return;
        setList([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => (alive = false);
  }, []);

  const focusId = sp.get("focus") || "";

  const platforms = useMemo(() => {
    const s = new Set();
    for (const it of list) if (it?.platform) s.add(String(it.platform));
    return ["all", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [list]);

  const categories = useMemo(() => {
    const s = new Set();
    for (const it of list) if (it?.category) s.add(String(it.category));
    return ["all", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [list]);

  const filtered = useMemo(() => {
    // ✅ hardening/perf: limit query length so nobody freezes UI
    const needle = q.trim().slice(0, 80).toLowerCase();

    let arr = list.slice();

    if (platform !== "all") {
      const p = platform.toLowerCase();
      arr = arr.filter((x) => String(x?.platform || "").toLowerCase() === p);
    }
    if (category !== "all") {
      const c = category.toLowerCase();
      arr = arr.filter((x) => String(x?.category || "").toLowerCase() === c);
    }

    if (needle) {
      arr = arr.filter((x) => {
        const hay = [x?.name, x?.type, x?.category, x?.platform, x?.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    if (onlyInStock) arr = arr.filter((x) => x?.enabled !== false);

    if (sort === "priceAsc") arr.sort((a, b) => Number(a?.pricePer1000 || 0) - Number(b?.pricePer1000 || 0));
    if (sort === "priceDesc") arr.sort((a, b) => Number(b?.pricePer1000 || 0) - Number(a?.pricePer1000 || 0));
    if (sort === "nameAsc") arr.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

    return arr;
  }, [list, q, platform, category, sort, onlyInStock]);

  // ✅ whenever filters change, reset visible count (so it feels snappy)
  useEffect(() => {
    setVisibleCount(isMobile ? 24 : 36);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, platform, category, sort, onlyInStock, isMobile]);

  const shown = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const canLoadMore = shown.length < filtered.length;

  const kpis = useMemo(() => {
    const setP = new Set();
    const setC = new Set();
    for (const it of list) {
      if (it?.platform) setP.add(String(it.platform));
      if (it?.category) setC.add(String(it.category));
    }
    return {
      total: list.length,
      showing: filtered.length,
      platforms: setP.size,
      categories: setC.size,
    };
  }, [list, filtered]);

  function onBuy(serviceId) {
    const target = `/app/create-order?serviceId=${encodeURIComponent(serviceId)}`;
    if (!authed) return nav(`/login?next=${buildNext(target)}`);
    nav(target);
  }

  function openDetails(s) {
    setSelected(s);
    setOpenModal(true);
  }

  const tabs = useMemo(() => categories.slice(0, 7), [categories]);

  const focusShell = "rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl";
  const filterShell =
    "rounded-3xl border border-white/10 bg-black/55 backdrop-blur-2xl " +
    "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_70px_rgba(0,0,0,0.35)]";

  return (
    <div className="w-full">
      {/* HEADER */}
      <div className="mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="violet">2050</Pill>
              <Pill tone="info">Public Services Catalog</Pill>
              {!authed ? (
                <Pill tone="warn">Guests can browse • Login to order</Pill>
              ) : (
                <Pill tone="ok">Authenticated</Pill>
              )}
            </div>

            <h1 className="mt-3 text-2xl md:text-4xl font-black tracking-tight text-white">Services</h1>

            <p className="mt-2 max-w-3xl text-sm md:text-base text-zinc-300/80">
              Browse everything publicly. When you’re ready to buy: login → create order → live tracking.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => nav("/register")}
              className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition"
              type="button"
            >
              Create account
            </button>
            <button
              onClick={() => nav("/login")}
              className="rounded-2xl px-4 py-2 text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-200 transition active:scale-[0.99]"
              type="button"
            >
              Sign in
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Catalog" value={`${kpis.total}`} hint="Total services available" />
          <Kpi label="Showing" value={`${kpis.showing}`} hint="Matched your filters" />
          <Kpi label="Platforms" value={`${kpis.platforms}`} hint="Multi-platform support" />
          <Kpi label="Categories" value={`${kpis.categories}`} hint="Organized catalog" />
        </div>
      </div>

      {/* CATEGORY TABS */}
      <div className={cls("mb-3 p-3", focusShell)}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => {
              const active = (t === "all" && category === "all") || (t !== "all" && t === category);
              return (
                <button
                  key={t}
                  onClick={() => setCategory(t)}
                  className={cls(
                    "rounded-full px-4 py-2 text-sm font-semibold border transition",
                    active
                      ? "border-white/20 bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(168,85,247,0.18)]"
                      : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10 hover:border-white/20"
                  )}
                  type="button"
                >
                  {t === "all" ? "All" : t}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-zinc-300/70">Tip: filters below for full precision.</div>
        </div>
      </div>

      {/* FILTER BAR */}
      <SmartSticky topOffset={topOffset}>
        <div className={filterShell}>
          <div className="p-3 md:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                <input
                  value={q}
                  onChange={(e) => {
                    // ✅ safety/perf: cap length
                    const v = String(e.target.value || "").slice(0, 80);
                    setQ(v);
                  }}
                  placeholder="Search name, type, category, description…"
                  className={cls(
                    "w-full sm:w-[360px] rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white",
                    "placeholder:text-zinc-300/40 backdrop-blur-xl outline-none",
                    "focus:border-white/20 focus:bg-white/10"
                  )}
                />

                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full sm:w-[190px] rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white backdrop-blur-xl"
                >
                  {platforms.map((p) => (
                    <option key={p} value={p} className="bg-zinc-900">
                      {p === "all" ? "All platforms" : p}
                    </option>
                  ))}
                </select>

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full sm:w-[190px] rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white backdrop-blur-xl"
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-zinc-900">
                      {c === "all" ? "All categories" : c}
                    </option>
                  ))}
                </select>

                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="w-full sm:w-[190px] rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white backdrop-blur-xl"
                >
                  <option value="pop" className="bg-zinc-900">
                    Sort
                  </option>
                  <option value="nameAsc" className="bg-zinc-900">
                    Name A–Z
                  </option>
                  <option value="priceAsc" className="bg-zinc-900">
                    Price ↑
                  </option>
                  <option value="priceDesc" className="bg-zinc-900">
                    Price ↓
                  </option>
                </select>

                <button
                  type="button"
                  onClick={() => setOnlyInStock((v) => !v)}
                  className={cls(
                    "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold border transition",
                    onlyInStock
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
                      : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  {onlyInStock ? "Enabled only" : "All (incl. disabled)"}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-zinc-300/70">
                  Showing <span className="text-white/90 font-semibold">{shown.length}</span> of{" "}
                  <span className="text-white/90 font-semibold">{filtered.length}</span>
                </div>

                <button
                  onClick={() => {
                    setQ("");
                    setPlatform("all");
                    setCategory("all");
                    setSort("pop");
                    setOnlyInStock(false);
                    setVisibleCount(isMobile ? 24 : 36);
                  }}
                  className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition"
                  type="button"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </SmartSticky>

      {/* LIST */}
      <div className="mt-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-zinc-200/70 backdrop-blur-xl shadow-soft">
            <div className="text-lg font-semibold text-white">No services found</div>
            <div className="mt-2 text-sm text-zinc-300/70">
              Try changing filters, selecting a different platform/category, or clearing the search query.
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((s, idx) => {
                const id = s?._id || s?.id;
                const cur = s?.currency || "EUR";
                const price = s?.pricePer1000 ?? s?.price ?? 0;

                const enabled = s?.enabled !== false;
                const disabled = !id || !enabled;

                const highlight = focusId && id && String(id) === String(focusId);

                // ✅ stable key fallback (never Math.random)
                const key = id ? String(id) : `${String(s?.name || "service")}-${String(s?.platform || "")}-${idx}`;

                return (
                  <div
                    key={key}
                    className={cls(
                      "group rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl",
                      "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_55px_rgba(168,85,247,0.12)]",
                      "hover:border-white/15 hover:bg-white/7 transition",
                      disabled && "opacity-70",
                      highlight &&
                        "border-white/25 bg-white/8 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_25px_85px_rgba(168,85,247,0.22)]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-black text-white truncate">{s?.name || "Service"}</div>
                          {!enabled ? <Badge tone="red">Disabled</Badge> : null}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {s?.platform ? <Pill>{s.platform}</Pill> : null}
                          {s?.type ? <Pill>{s.type}</Pill> : null}
                          {s?.category ? <Pill>{s.category}</Pill> : null}
                          <Pill tone={enabled ? "ok" : "bad"}>per 1k</Pill>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-300/70">Price / 1k</div>
                        <div className="mt-1 text-xl font-black tracking-tight text-white">{fmtMoney(price, cur)}</div>
                      </div>
                    </div>

                    {s?.min != null || s?.max != null ? (
                      <div className="mt-3 text-xs text-zinc-200/70">
                        Min: <span className="text-white/90 font-semibold">{s?.min ?? "—"}</span> • Max:{" "}
                        <span className="text-white/90 font-semibold">{s?.max ?? "—"}</span>
                      </div>
                    ) : null}

                    {s?.description ? (
                      <p className="mt-3 text-sm text-zinc-200/75 leading-relaxed line-clamp-3">{s.description}</p>
                    ) : (
                      <p className="mt-3 text-sm text-zinc-200/60 leading-relaxed">
                        Premium catalog item. Open details for full specs.
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <button
                        onClick={() => openDetails(s)}
                        className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-black/20 hover:bg-black/30 hover:border-white/20 transition"
                        type="button"
                      >
                        Details
                      </button>

                      <button
                        disabled={!id}
                        onClick={() => onBuy(id)}
                        className={cls(
                          "rounded-2xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99]",
                          !authed
                            ? "border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 hover:border-white/20"
                            : "bg-white text-zinc-900 hover:bg-zinc-200",
                          !id && "opacity-50 cursor-not-allowed"
                        )}
                        type="button"
                      >
                        {!authed ? "Login to buy" : "Buy"}
                      </button>
                    </div>

                    <div className="pointer-events-none mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition" />
                  </div>
                );
              })}
            </div>

            {/* ✅ LOAD MORE */}
            <div className="mt-6 flex items-center justify-center">
              {canLoadMore ? (
                <button
                  onClick={() => setVisibleCount((v) => Math.min(filtered.length, v + STEP))}
                  className={cls(
                    "rounded-2xl px-6 py-3 text-sm font-semibold border border-white/10 bg-white/5 text-white/90",
                    "hover:bg-white/10 hover:border-white/20 transition active:scale-[0.99]"
                  )}
                  type="button"
                >
                  Load more ({shown.length}/{filtered.length})
                </button>
              ) : (
                <div className="text-xs text-zinc-300/60">All results loaded.</div>
              )}
            </div>
          </>
        )}

        <ServiceModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          s={selected}
          authed={authed}
          onBuy={(id) => {
            setOpenModal(false);
            onBuy(id);
          }}
        />
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-black/25 p-6 text-sm text-zinc-200/70 backdrop-blur-xl shadow-soft">
        <div className="text-white font-semibold">Ordering flow</div>
        <div className="mt-2">
          Guests can browse. To order you need an account (sign in), then you’ll be redirected to create-order with the
          service pre-selected.
        </div>
      </div>
    </div>
  );
}
