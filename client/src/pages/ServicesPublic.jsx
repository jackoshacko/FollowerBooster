// client/src/pages/ServicesPublic.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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

function PlatformPill({ label }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-zinc-200/80 backdrop-blur-xl">
      {label}
    </span>
  );
}

function buildNext(url) {
  // url is already a path like "/create-order?serviceId=..."
  return encodeURIComponent(url);
}

export default function ServicesPublic() {
  const nav = useNavigate();
  const loc = useLocation();

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState("pop"); // pop | priceAsc | priceDesc
  const [authed, setAuthed] = useState(() => !!localStorage.getItem("token"));

  // keep authed in sync (same tab + other tabs)
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

  // load services (public endpoint)
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
    for (const it of list) {
      if (it?.platform) s.add(String(it.platform));
    }
    return ["all", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [list]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let arr = list.slice();

    if (platform !== "all") {
      arr = arr.filter(
        (x) => String(x?.platform || "").toLowerCase() === platform.toLowerCase()
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

    // sorting
    if (sort === "priceAsc") {
      arr.sort(
        (a, b) => Number(a?.pricePer1000 || 0) - Number(b?.pricePer1000 || 0)
      );
    } else if (sort === "priceDesc") {
      arr.sort(
        (a, b) => Number(b?.pricePer1000 || 0) - Number(a?.pricePer1000 || 0)
      );
    }

    return arr;
  }, [list, q, platform, sort]);

  function onBuy(serviceId) {
    if (!serviceId) return;

    // IMPORTANT:
    // - If your private panel route is "/app/create-order", change target below accordingly.
    // - If your private route is "/create-order", leave as is.
    const target = `/create-order?serviceId=${encodeURIComponent(serviceId)}`;

    if (!authed) {
      // send them to login with next
      return nav(`/login?next=${buildNext(target)}`, {
        replace: false,
        state: { from: loc },
      });
    }

    nav(target);
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Services
          </h1>
          <p className="mt-1 text-sm text-zinc-300/70">
            Browse services. To buy, you need an account.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search services…"
            className={cls(
              "w-full sm:w-[320px] rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white",
              "placeholder:text-zinc-300/40 backdrop-blur-xl outline-none",
              "focus:border-white/20 focus:bg-white/7"
            )}
          />

          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full sm:w-[160px] rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white backdrop-blur-xl"
          >
            {platforms.map((p) => (
              <option key={p} value={p} className="bg-zinc-900">
                {p === "all" ? "All platforms" : p}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="w-full sm:w-[160px] rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white backdrop-blur-xl"
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
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-zinc-200/70 backdrop-blur-xl shadow-soft">
          Loading services…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-zinc-200/70 backdrop-blur-xl shadow-soft">
          No services found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const id = s?._id || s?.id || null;
            const cur = s?.currency || "EUR";
            const price = s?.pricePer1000 ?? s?.price ?? 0;
            const disabled = !id;

            return (
              <div
                key={id || `${s?.name || "service"}-${Math.random()}`}
                className={cls(
                  "rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl",
                  "shadow-soft"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-white truncate">
                      {s?.name || "Service"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {s?.platform ? <PlatformPill label={s.platform} /> : null}
                      {s?.type ? <PlatformPill label={s.type} /> : null}
                      {s?.category ? <PlatformPill label={s.category} /> : null}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-xs text-zinc-300/70">per 1k</div>
                    <div className="text-lg font-black text-white">
                      {fmtMoney(price, cur)}
                    </div>
                  </div>
                </div>

                {s?.min || s?.max ? (
                  <div className="mt-3 text-xs text-zinc-200/70">
                    Min:{" "}
                    <span className="text-white/90 font-semibold">
                      {s?.min ?? "—"}
                    </span>{" "}
                    • Max:{" "}
                    <span className="text-white/90 font-semibold">
                      {s?.max ?? "—"}
                    </span>
                  </div>
                ) : null}

                {s?.description ? (
                  <p className="mt-3 text-sm text-zinc-200/70 line-clamp-3">
                    {s.description}
                  </p>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-2">
                  {!authed ? (
                    <div className="text-xs text-zinc-300/60">
                      Create an account to order.
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-300/60">Ready to buy.</div>
                  )}

                  <button
                    disabled={disabled}
                    onClick={() => onBuy(id)}
                    className={cls(
                      "rounded-2xl px-4 py-2 text-sm font-semibold",
                      !authed
                        ? "border border-white/10 bg-white/5 hover:bg-white/10 text-white/90"
                        : "bg-white text-zinc-900 hover:bg-zinc-200",
                      "transition active:scale-[0.99]",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {!authed ? "Login to buy" : "Buy"}
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
