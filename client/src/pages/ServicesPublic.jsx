// client/src/pages/ServicesPublic.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-zinc-200/80 backdrop-blur-xl">
      {children}
    </span>
  );
}

function buildNext(url) {
  return encodeURIComponent(url);
}

export default function ServicesPublic() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);

  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("pop"); // pop | priceAsc | priceDesc

  const [authed, setAuthed] = useState(() => !!localStorage.getItem("token"));

  // ✅ keep authed in sync (same tab + other tabs)
  useEffect(() => {
    const sync = () => setAuthed(!!localStorage.getItem("token"));

    const onAuthChanged = () => sync();
    const onStorage = (e) => {
      if (e.key === "token") sync();
    };

    window.addEventListener("auth-changed", onAuthChanged);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // ✅ load services (public)
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

    return () => {
      alive = false;
    };
  }, []);

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
    const needle = q.trim().toLowerCase();
    let arr = list.slice();

    if (platform !== "all") {
      arr = arr.filter(
        (x) =>
          String(x?.platform || "").toLowerCase() === platform.toLowerCase()
      );
    }
    if (category !== "all") {
      arr = arr.filter(
        (x) =>
          String(x?.category || "").toLowerCase() === category.toLowerCase()
      );
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

    if (sort === "priceAsc")
      arr.sort(
        (a, b) =>
          Number(a?.pricePer1000 || 0) - Number(b?.pricePer1000 || 0)
      );
    if (sort === "priceDesc")
      arr.sort(
        (a, b) =>
          Number(b?.pricePer1000 || 0) - Number(a?.pricePer1000 || 0)
      );

    return arr;
  }, [list, q, platform, category, sort]);

  function onBuy(serviceId) {
    const target = `/create-order?serviceId=${encodeURIComponent(serviceId)}`;
    if (!authed) return nav(`/login?next=${buildNext(target)}`);
    nav(target);
  }

  function resetFilters() {
    setQ("");
    setPlatform("all");
    setCategory("all");
    setSort("pop");
  }

  const total = list.length;
  const shown = filtered.length;

  // ✅ iOS / mobile PERFECT: sticky below fixed PublicLayout topbar
  // PublicLayout sets: --pubTop: calc(env(safe-area-inset-top) + 64px)
  const stickyTop = "calc(var(--pubTop) + 10px)";

  const glass2050 = cls(
    "rounded-3xl border border-white/10",
    "bg-black/45 backdrop-blur-2xl",
    "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_22px_70px_rgba(168,85,247,0.16)]"
  );

  return (
    <div className="w-full">
      {/* HEADER */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Services
          </h1>
          <p className="mt-1 text-sm text-zinc-300/70">
            Browse services. To buy, you need an account.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-300/60">
          <Pill>
            Showing{" "}
            <span className="text-white/90 font-semibold">&nbsp;{shown}</span> of{" "}
            <span className="text-white/90 font-semibold">&nbsp;{total}</span>
          </Pill>
          <Pill>{authed ? "Signed in" : "Guest"}</Pill>
        </div>
      </div>

      {/* ✅ STICKY FILTER BAR (FULL AUSTATTUNG iOS FIX) */}
      <div
        className={cls("sticky z-40 transform-gpu")}
        style={{ top: stickyTop, willChange: "transform" }}
      >
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/18 to-transparent opacity-70" />

        <div className={glass2050}>
          <div className="p-3 md:p-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
              {/* search */}
              <div className="md:col-span-5">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, type, category, description…"
                  className={cls(
                    "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white",
                    "placeholder:text-zinc-300/40 backdrop-blur-xl outline-none",
                    "focus:border-white/20 focus:bg-white/10"
                  )}
                />
              </div>

              {/* platform */}
              <div className="md:col-span-3">
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white backdrop-blur-xl"
                >
                  {platforms.map((p) => (
                    <option key={p} value={p} className="bg-zinc-900">
                      {p === "all" ? "All platforms" : p}
                    </option>
                  ))}
                </select>
              </div>

              {/* category */}
              <div className="md:col-span-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white backdrop-blur-xl"
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-zinc-900">
                      {c === "all" ? "All categories" : c}
                    </option>
                  ))}
                </select>
              </div>

              {/* reset */}
              <div className="md:col-span-1">
                <button
                  type="button"
                  onClick={resetFilters}
                  className={cls(
                    "w-full rounded-2xl px-3 py-2.5 text-sm font-semibold",
                    "border border-white/10 bg-white/5 hover:bg-white/10 text-white/90",
                    "transition active:scale-[0.99]"
                  )}
                  title="Reset filters"
                >
                  Reset
                </button>
              </div>

              {/* sort row */}
              <div className="md:col-span-12">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                      className="w-full md:w-[220px] rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white backdrop-blur-xl"
                    >
                      <option value="pop" className="bg-zinc-900">
                        Sort
                      </option>
                      <option value="priceAsc" className="bg-zinc-900">
                        Price ↑
                      </option>
                      <option value="priceDesc" className="bg-zinc-900">
                        Price ↓
                      </option>
                    </select>

                    <Pill>2050 UI</Pill>
                  </div>

                  <div className="text-[11px] text-zinc-300/55">
                    Tip: tap{" "}
                    <span className="text-white/80 font-semibold">Buy</span> → guest gets redirected to login.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* spacing under sticky bar */}
      <div className="h-4" />

      {/* LIST */}
      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-zinc-200/70 backdrop-blur-xl shadow-soft">
          Loading services…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-zinc-200/70 backdrop-blur-xl shadow-soft">
          No services found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const id = s?._id || s?.id;
            const cur = s?.currency || "EUR";
            const price = s?.pricePer1000 ?? s?.price ?? 0;
            const disabled = !id;

            return (
              <div
                key={id || Math.random()}
                className={cls(
                  "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl",
                  "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_30px_90px_rgba(168,85,247,0.14)]",
                  disabled && "opacity-70"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-extrabold text-white truncate">
                      {s?.name || "Service"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s?.platform ? <Pill>{String(s.platform)}</Pill> : null}
                      {s?.type ? <Pill>{String(s.type)}</Pill> : null}
                      {s?.category ? <Pill>{String(s.category)}</Pill> : null}
                      <Pill>per 1k</Pill>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-300/60">
                      Price / 1k
                    </div>
                    <div className="text-2xl font-black text-white">
                      {fmtMoney(price, cur)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-200/70">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="text-[11px] text-zinc-300/60">Min</div>
                    <div className="mt-1 text-white/90 font-semibold">
                      {s?.min ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="text-[11px] text-zinc-300/60">Max</div>
                    <div className="mt-1 text-white/90 font-semibold">
                      {s?.max ?? "—"}
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm text-zinc-200/70 line-clamp-3">
                  {s?.description ||
                    "Premium catalog item. Open details for full specs."}
                </p>

                <div className="mt-5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      id ? nav(`/services?focus=${encodeURIComponent(id)}`) : null
                    }
                    className={cls(
                      "rounded-2xl px-4 py-2 text-sm font-semibold",
                      "border border-white/10 bg-white/5 hover:bg-white/10 text-white/90",
                      "transition active:scale-[0.99]",
                      !id && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={!id}
                  >
                    Details
                  </button>

                  <button
                    disabled={disabled}
                    onClick={() => onBuy(id)}
                    className={cls(
                      "rounded-2xl px-5 py-2 text-sm font-semibold",
                      authed
                        ? "bg-white text-zinc-900 hover:bg-zinc-200"
                        : "border border-white/10 bg-white/5 hover:bg-white/10 text-white/90",
                      "transition active:scale-[0.99]",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {authed ? "Buy" : "Login to buy"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
