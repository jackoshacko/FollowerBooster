// client/src/pages/Wallet.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Wallet as WalletIcon,
  RefreshCcw,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Apple,
  Smartphone,
  Bitcoin,
  BadgeCheck,
  AlertCircle,
  Info,
  Euro,
  ArrowUpRight,
  Copy,
  ExternalLink,
  Clock,
  Hash,
  X,
} from "lucide-react";

/* =========================
   Helpers
========================= */

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function money2(n) {
  return (Math.round(safeNum(n, 0) * 100) / 100).toFixed(2);
}

function fmtMoney(n, cur = "EUR") {
  const x = safeNum(n, 0);
  try {
    return `${x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
  } catch {
    return `${money2(x)} ${cur}`;
  }
}

function cap(s) {
  if (!s) return "";
  const t = String(s);
  return t.slice(0, 1).toUpperCase() + t.slice(1);
}

function shortId(id) {
  if (!id) return "—";
  const s = String(id);
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(String(text ?? ""));
    return true;
  } catch {
    return false;
  }
}

function parseAmount(v) {
  const x = Number(String(v).replace(",", "."));
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

/* =========================
   Glass UI atoms
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

function Skeleton({ className = "" }) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/10", className)} />;
}

function Badge({ children, tone = "zinc", className = "" }) {
  const tones = {
    zinc: "border-white/10 bg-white/5 text-zinc-100",
    blue: "border-sky-500/20 bg-sky-500/10 text-sky-100",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-100",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
    red: "border-red-500/20 bg-red-500/10 text-red-100",
    violet: "border-violet-500/20 bg-violet-500/10 text-violet-100",
    purple: "border-purple-500/20 bg-purple-500/10 text-purple-100",
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

function Pill({ label, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
        active
          ? "border-sky-500/25 bg-sky-500/10 text-sky-100 shadow-[0_0_0_4px_rgba(56,189,248,0.10)]"
          : "border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
      )}
    >
      {label}
    </button>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => onClose?.(), 4200);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  const tone =
    toast.type === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
      : toast.type === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-100"
      : "border-white/10 bg-white/5 text-zinc-100";

  const Icon =
    toast.type === "success" ? BadgeCheck : toast.type === "error" ? AlertCircle : Info;

  return (
    <div className="fixed right-6 top-6 z-50 w-[min(360px,92vw)]">
      <div className={cn("rounded-2xl border p-3 backdrop-blur-xl shadow-[0_12px_30px_rgba(0,0,0,0.45)]", tone)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{toast.title}</div>
              <div className="mt-1 text-xs opacity-80">{toast.msg}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-zinc-100 hover:bg-white/10"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Tx row
========================= */

function TxRow({ tx, onCopy }) {
  const type = String(tx?.type || tx?.kind || tx?.provider || "tx").toLowerCase();
  const status = String(tx?.status || "completed").toLowerCase();
  const amount = safeNum(tx?.amount ?? tx?.delta ?? 0, 0);
  const cur = String(tx?.currency || "EUR").toUpperCase();

  const created = tx?.createdAt ? tx.createdAt : tx?.created_at;
  const id = tx?._id || tx?.id || tx?.providerOrderId || tx?.provider_order_id || "";

  const label =
    type.includes("paypal") ? "PayPal top-up" :
    type.includes("stripe") ? "Card top-up" :
    type.includes("revolut") ? "Revolut top-up" :
    type.includes("crypto") ? "Crypto top-up" :
    "Transaction";

  const badgeTone =
    status === "completed" || status === "success"
      ? "emerald"
      : status === "pending"
      ? "amber"
      : "red";

  const sign = amount >= 0 ? "+" : "-";

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-white">{label}</div>
          <Badge tone={badgeTone}>{status}</Badge>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-200/60">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {fmtDateTime(created)}
          </span>
          {id ? (
            <span className="inline-flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" />
              {shortId(id)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-sm font-black text-white">
          {sign} {money2(Math.abs(amount))} {cur}
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          {id ? (
            <button
              onClick={() => onCopy?.(id, "Transaction ID copied ✅")}
              className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-100 hover:bg-white/10"
              title="Copy transaction id"
              type="button"
            >
              <Copy className="h-4 w-4" />
            </button>
          ) : null}

          {tx?.link ? (
            <a
              href={String(tx.link)}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-100 hover:bg-white/10"
              title="Open link"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Wallet Page
========================= */

export default function Wallet() {
  const loc = useLocation();
  const nav = useNavigate();

  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  // topup
  const [amount, setAmount] = useState("10");
  const [currency, setCurrency] = useState("EUR");
  const [paying, setPaying] = useState(false);

  // toast + error
  const [toast, setToast] = useState(null); // {type,title,msg}
  const [err, setErr] = useState("");

  const toastRef = useRef(null);

  const qs = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const paypalStatus = qs.get("paypal"); // success | fail | cancel | error | missing_order
  const paypalOrderId = qs.get("orderId");

  function showToast(t) {
    setToast(t);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3800);
  }

  async function loadWallet() {
    setLoading(true);
    setErr("");
    try {
      const data = await api.get("/wallet");
      const b = safeNum(data?.balance ?? data?.user?.balance ?? 0, 0);
      const list = data?.txs || data?.transactions || [];
      setBalance(b);
      setTxs(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e?.message || "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWallet();
    return () => {
      if (toastRef.current) clearTimeout(toastRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PayPal status -> toast + cleanup URL
  useEffect(() => {
    if (!paypalStatus) return;

    if (paypalStatus === "success") {
      showToast({
        type: "success",
        title: "Payment completed ✅",
        msg: paypalOrderId ? `Order: ${paypalOrderId}` : "Funds will reflect instantly.",
      });
      loadWallet();
    } else if (paypalStatus === "cancel") {
      showToast({
        type: "info",
        title: "Payment cancelled",
        msg: "No worries — you can try again anytime.",
      });
    } else if (paypalStatus === "fail") {
      showToast({
        type: "error",
        title: "Payment failed",
        msg: "Something went wrong. Please try again.",
      });
    } else {
      showToast({
        type: "error",
        title: "Payment error",
        msg: "We couldn't confirm the payment. Try again or contact support.",
      });
    }

    nav(loc.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paypalStatus]);

  function preset(n) {
    setAmount(String(n));
  }

  async function onCopy(text, label = "Copied ✅") {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) showToast({ type: "success", title: label, msg: "Saved to clipboard." });
    else showToast({ type: "error", title: "Clipboard blocked", msg: "Browser blocked clipboard access." });
  }

  async function startPayPal() {
    const a = parseAmount(amount);

    if (!a || a <= 0) {
      showToast({ type: "error", title: "Invalid amount", msg: "Enter a valid top-up amount." });
      return;
    }

    setPaying(true);
    setErr("");
    try {
      const out = await api.post("/payments/paypal/create", { amount: a, currency });
      const approveUrl = out?.approveUrl;
      if (!approveUrl) throw new Error("Missing approveUrl from server");
      window.location.href = approveUrl;
    } catch (e) {
      setPaying(false);
      showToast({
        type: "error",
        title: "Could not start payment",
        msg: e?.message || "Try again in a moment.",
      });
    }
  }

  // future methods placeholders (UI only)
  function soon(methodName) {
    showToast({
      type: "info",
      title: `${methodName} (soon)`,
      msg: "UI is ready — next step is provider wiring + webhook idempotency.",
    });
  }

  const spent = useMemo(() => txs.reduce((s, t) => s + safeNum(t?.amount ?? t?.delta ?? 0, 0), 0), [txs]);
  const topups = useMemo(
    () => txs.filter((t) => String(t?.type || t?.kind || t?.provider || "").toLowerCase().includes("top")).length,
    [txs]
  );

  return (
    <div className="space-y-4">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* HERO */}
      <GlassCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-3xl font-black tracking-tight text-white">Wallet</div>
              <Badge tone="violet">
                <Sparkles className="h-3.5 w-3.5" /> Mansory Ultra
              </Badge>
              <Badge tone="blue">
                <ShieldCheck className="h-3.5 w-3.5" /> Secure top-ups
              </Badge>
              <Badge tone="amber">
                <WalletIcon className="h-3.5 w-3.5" /> Live balance
              </Badge>
            </div>

            <div className="mt-2 text-sm text-zinc-200/70">
              Top up balance and track transactions — clean SaaS workflow, ready for Apple Pay / Google Pay / Crypto.
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={loadWallet}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10 disabled:opacity-50"
              type="button"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </GlassCard>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Balance</div>
          <div className="mt-2 text-2xl font-black text-white">
            {loading ? <span className="inline-block h-7 w-28 rounded-full bg-white/10 animate-pulse" /> : fmtMoney(balance, currency)}
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Currency</div>
          <div className="mt-2 text-2xl font-black text-white">{currency}</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Transactions</div>
          <div className="mt-2 text-2xl font-black text-white">{txs.length}</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Top-ups</div>
          <div className="mt-2 text-2xl font-black text-white">{topups}</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Net activity</div>
          <div className="mt-2 text-2xl font-black text-white">
            {loading ? "—" : `${spent >= 0 ? "+" : "-"}${money2(Math.abs(spent))} ${currency}`}
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Status</div>
          <div className="mt-2 inline-flex items-center gap-2 text-white">
            <Badge tone="emerald">
              <BadgeCheck className="h-3.5 w-3.5" /> Ready
            </Badge>
          </div>
        </GlassCard>
      </div>

      {/* error */}
      {err ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div className="min-w-0">{err}</div>
          </div>
        </div>
      ) : null}

      {/* GRID */}
      <div className="grid gap-3 lg:grid-cols-12">
        {/* LEFT: Top up */}
        <GlassCard className="p-4 lg:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Top up</div>
              <div className="mt-1 text-xs text-zinc-200/60">
                Choose a preset or enter a custom amount — PayPal live now.
              </div>
            </div>
            <Badge tone="blue">
              <ShieldCheck className="h-3.5 w-3.5" /> PayPal
            </Badge>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Pill label="+10" onClick={() => preset(10)} active={amount === "10"} />
              <Pill label="+25" onClick={() => preset(25)} active={amount === "25"} />
              <Pill label="+50" onClick={() => preset(50)} active={amount === "50"} />
              <Pill label="+100" onClick={() => preset(100)} active={amount === "100"} />
              <Pill label="+250" onClick={() => preset(250)} active={amount === "250"} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Amount</div>
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <Euro className="h-4 w-4 text-zinc-200/60" />
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="10"
                    inputMode="decimal"
                    className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-200/40"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-200/60">Currency</div>
                <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-transparent text-sm text-zinc-100 outline-none"
                  >
                    <option value="EUR" className="bg-zinc-950">
                      EUR
                    </option>
                    <option value="CHF" className="bg-zinc-950">
                      CHF
                    </option>
                    <option value="USD" className="bg-zinc-950">
                      USD
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={startPayPal}
              disabled={paying}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-black transition",
                "bg-amber-500 text-black hover:bg-amber-400",
                paying ? "opacity-70 cursor-not-allowed" : ""
              )}
              type="button"
            >
              <CreditCard className="h-4 w-4" />
              {paying ? "Redirecting to PayPal…" : "Add funds with PayPal"}
              <ArrowUpRight className="h-4 w-4" />
            </button>

            <div className="text-xs text-zinc-200/60">
              Funds are credited after confirmation. Webhooks will enforce idempotency (event.id) on live.
            </div>
          </div>

          {/* FUTURE PAYMENT METHODS (UI READY) */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">Payment methods</div>
              <Badge tone="violet">
                <Sparkles className="h-3.5 w-3.5" /> Ready to plug-in
              </Badge>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => soon("Apple Pay")}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 hover:bg-white/5"
              >
                <span className="inline-flex items-center gap-2">
                  <Apple className="h-4 w-4" /> Apple Pay
                </span>
                <Badge tone="zinc">soon</Badge>
              </button>

              <button
                type="button"
                onClick={() => soon("Google Pay")}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 hover:bg-white/5"
              >
                <span className="inline-flex items-center gap-2">
                  <Smartphone className="h-4 w-4" /> Google Pay
                </span>
                <Badge tone="zinc">soon</Badge>
              </button>

              <button
                type="button"
                onClick={() => soon("Crypto")}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 hover:bg-white/5"
              >
                <span className="inline-flex items-center gap-2">
                  <Bitcoin className="h-4 w-4" /> Crypto
                </span>
                <Badge tone="zinc">soon</Badge>
              </button>

              <button
                type="button"
                onClick={() => soon("Revolut")}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 hover:bg-white/5"
              >
                <span className="inline-flex items-center gap-2">
                  <WalletIcon className="h-4 w-4" /> Revolut
                </span>
                <Badge tone="zinc">soon</Badge>
              </button>
            </div>
          </div>
        </GlassCard>

        {/* RIGHT: Transactions */}
        <GlassCard className="p-4 lg:col-span-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Transactions</div>
              <div className="mt-1 text-xs text-zinc-200/60">
                Latest activity on your account (top-ups, refunds, deductions).
              </div>
            </div>

            <Badge tone="zinc">
              <Clock className="h-3.5 w-3.5" /> Live feed
            </Badge>
          </div>

          <div className="mt-4 grid gap-2">
            {loading ? (
              <>
                <Skeleton className="h-[74px] w-full" />
                <Skeleton className="h-[74px] w-full" />
                <Skeleton className="h-[74px] w-full" />
              </>
            ) : txs.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="text-sm font-semibold text-white">No transactions yet</div>
                <div className="mt-1 text-xs text-zinc-200/60">
                  Top up your wallet to get started.
                </div>
              </div>
            ) : (
              txs.map((t) => (
                <TxRow
                  key={t?._id || t?.id || JSON.stringify(t)}
                  tx={t}
                  onCopy={onCopy}
                />
              ))
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start gap-2 text-xs text-zinc-200/60">
              <Info className="mt-0.5 h-4 w-4" />
              <div className="min-w-0">
                Pro tip: for live launch we’ll store PayPal webhook <b>event.id</b> + provider order id mapping to guarantee
                <b> idempotent credits</b> (no double credits, no missed credits).
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
