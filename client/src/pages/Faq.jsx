// client/src/pages/FaqPublic.jsx
import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

function Section({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_55px_rgba(168,85,247,0.12)]">
      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">{title}</h2>
          {subtitle ? <p className="text-sm md:text-base text-zinc-300/80">{subtitle}</p> : null}
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "border-white/10 bg-white/5 text-white/85",
    ok: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
    warn: "border-amber-500/25 bg-amber-500/10 text-amber-100",
    bad: "border-red-500/25 bg-red-500/10 text-red-100",
    info: "border-sky-500/25 bg-sky-500/10 text-sky-100",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-100",
  };
  return (
    <span
      className={cls(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-xl",
        tones[tone] || tones.neutral
      )}
    >
      {children}
    </span>
  );
}

function AccordionItem({ q, a, tags = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 hover:bg-black/25 transition">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left"
      >
        <div className="mt-0.5 shrink-0 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs font-black text-white">
          ?
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm md:text-[15px] font-extrabold text-white">{q}</div>
            {tags?.length ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Pill key={t} tone="info">
                    {t}
                  </Pill>
                ))}
              </div>
            ) : null}
          </div>
          {open ? (
            <div className="mt-2 text-sm text-zinc-200/80 leading-relaxed">
              {Array.isArray(a) ? (
                <ul className="list-disc pl-5 space-y-1">
                  {a.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p>{a}</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-white/70 text-lg leading-none">{open ? "−" : "+"}</div>
      </button>
    </div>
  );
}

export default function FaqPublic() {
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("all");

  const buckets = [
    { id: "all", name: "All" },
    { id: "ordering", name: "Ordering" },
    { id: "delivery", name: "Delivery" },
    { id: "refunds", name: "Refunds" },
    { id: "accounts", name: "Accounts" },
    { id: "safety", name: "Safety" },
    { id: "billing", name: "Billing" },
    { id: "legal", name: "Legal" },
  ];

  const faqs = useMemo(
    () => [
      // ORDERING
      {
        bucket: "ordering",
        q: "How do I place an order?",
        tags: ["Flow"],
        a: [
          "Create an account (or sign in).",
          "Choose a service in Services catalog.",
          "Open Create Order, enter the required target (username/link), set quantity within min/max.",
          "Confirm details and submit. You’ll see live status in Orders.",
        ],
      },
      {
        bucket: "ordering",
        q: "Can I order as a guest?",
        tags: ["Guest"],
        a: [
          "Guests can browse the catalog only.",
          "Ordering requires an account for security, audit logs, and support handling.",
        ],
      },
      {
        bucket: "ordering",
        q: "What information do you need from me?",
        tags: ["Input"],
        a: [
          "Only the target needed to deliver the service (e.g., public profile link/username).",
          "We do NOT ask for your passwords.",
          "If any service requires extra fields, it will be clearly shown before checkout.",
        ],
      },
      {
        bucket: "ordering",
        q: "Can I cancel an order after submitting?",
        tags: ["Policy"],
        a: [
          "If processing has NOT started, cancellation may be possible.",
          "Once processing starts, cancellation is typically not possible (resources are already allocated).",
          "If you need cancellation, contact support immediately with your Order ID.",
        ],
      },

      // DELIVERY
      {
        bucket: "delivery",
        q: "How long does delivery take?",
        tags: ["SLA"],
        a: [
          "Delivery time varies by service, volume, and platform load.",
          "Each service is provided on a best-effort basis and may be delivered gradually.",
          "You can always track status updates in Orders.",
        ],
      },
      {
        bucket: "delivery",
        q: "Why does my order show 'Partial' or 'Processing'?",
        tags: ["Status"],
        a: [
          "Partial/Processing means delivery is ongoing or completed partially due to platform limits.",
          "Some services deliver in waves to reduce drop risk and platform restrictions.",
          "If it stays stuck unusually long, contact support with Order ID.",
        ],
      },
      {
        bucket: "delivery",
        q: "What if the target link/username is wrong?",
        tags: ["Important"],
        a: [
          "You are responsible for entering the correct target.",
          "Wrong/invalid/private targets can’t be delivered and may not be eligible for refund.",
          "Always double-check before submitting.",
        ],
      },
      {
        bucket: "delivery",
        q: "My account is private / content removed — what happens?",
        tags: ["Platform"],
        a: [
          "Services require public accessibility of the target during processing.",
          "If target becomes private, deleted, or restricted, delivery may stop and is not guaranteed.",
        ],
      },

      // REFUNDS
      {
        bucket: "refunds",
        q: "What is your refund policy in one sentence?",
        tags: ["Refunds"],
        a: "Refunds are considered only for non-delivered amounts where the target was valid and accessible, and the issue is not caused by platform restrictions or user input errors.",
      },
      {
        bucket: "refunds",
        q: "When do I qualify for a refund or credit?",
        tags: ["Eligibility"],
        a: [
          "Order is not delivered (or significantly under-delivered) after a reasonable processing window.",
          "Target was correct, public, and accessible during the order time.",
          "No violation of Terms (e.g., abuse, chargeback fraud).",
          "Evidence is provided if requested (screenshots / timestamps).",
        ],
      },
      {
        bucket: "refunds",
        q: "When do refunds get rejected?",
        tags: ["Non-eligible"],
        a: [
          "Wrong/invalid link or username, private target, removed content/account.",
          "Natural fluctuations/drops due to platform cleanup/algorithm changes.",
          "Order completed as described (including gradual delivery).",
          "Duplicate orders or conflicting orders on the same target.",
        ],
      },

      // ACCOUNTS
      {
        bucket: "accounts",
        q: "Do you store my passwords?",
        tags: ["Security"],
        a: [
          "No. We never ask for platform passwords.",
          "Account access is via your site login only (email + password).",
        ],
      },
      {
        bucket: "accounts",
        q: "I can’t log in — what should I do?",
        tags: ["Support"],
        a: [
          "Use the correct email/username and reset your password if available.",
          "If still locked out, contact support with your account email.",
        ],
      },

      // BILLING
      {
        bucket: "billing",
        q: "Are payments refundable after delivery?",
        tags: ["Billing"],
        a: [
          "If an order is delivered, it is considered consumed and is not refundable.",
          "For eligible cases, we may issue store credit or partial refund for the undelivered part.",
        ],
      },
      {
        bucket: "billing",
        q: "Do you support chargebacks?",
        tags: ["Chargeback"],
        a: [
          "Chargebacks should be the last resort.",
          "If you chargeback without contacting support, we may suspend the account and deny further service.",
          "We keep audit logs and delivery records for dispute resolution.",
        ],
      },

      // SAFETY
      {
        bucket: "safety",
        q: "Is this safe for my account?",
        tags: ["Safety"],
        a: [
          "No service can guarantee a risk-free outcome due to platform rules and algorithms.",
          "We use best-effort, gradual delivery methods where applicable.",
          "You should avoid ordering unrealistic quantities in short time windows.",
        ],
      },
      {
        bucket: "safety",
        q: "Do you guarantee zero drop or zero risk?",
        tags: ["No guarantee"],
        a: [
          "No. Platforms can remove/clean interactions at any time.",
          "We do not guarantee permanent results.",
        ],
      },

      // LEGAL
      {
        bucket: "legal",
        q: "Do you provide legal advice or guarantee compliance with platform terms?",
        tags: ["Legal"],
        a: [
          "No. You are responsible for how you use the services and for compliance with third-party platform rules.",
          "We provide a technical service; outcomes depend on third-party systems.",
        ],
      },
      {
        bucket: "legal",
        q: "How do disputes get handled?",
        tags: ["Disputes"],
        a: [
          "Contact support first with Order ID and details.",
          "We investigate using logs and provider status.",
          "Resolution is typically credit, partial refund, or a re-run (if applicable).",
        ],
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return faqs.filter((x) => {
      if (bucket !== "all" && x.bucket !== bucket) return false;
      if (!needle) return true;
      const hay = [x.q, ...(Array.isArray(x.a) ? x.a : [x.a]), ...(x.tags || [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [faqs, q, bucket]);

  return (
    <div className="w-full">
      {/* HERO */}
      <div className="mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="violet">2050</Pill>
              <Pill tone="info">Help Center</Pill>
              <Pill tone="ok">Professional Policy</Pill>
            </div>

            <h1 className="mt-3 text-2xl md:text-4xl font-black tracking-tight text-white">
              Help & FAQ
            </h1>
            <p className="mt-2 max-w-3xl text-sm md:text-base text-zinc-300/80">
              Transparent rules, clear outcomes. Read this once and you’ll avoid 99% of issues.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <NavLink
              to="/services"
              className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition"
            >
              Browse Services
            </NavLink>
            <NavLink
              to="/contact"
              className="rounded-2xl px-4 py-2 text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-200 transition active:scale-[0.99]"
            >
              Contact Support
            </NavLink>
          </div>
        </div>
      </div>

      {/* QUICK RULES */}
      <Section
        title="Quick rules (no drama)"
        subtitle="If you follow these, orders go smooth and support is fast."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-extrabold text-white">1) Correct target</div>
            <div className="mt-1 text-sm text-zinc-200/75">
              Wrong link/username = delivery may fail and refunds can be rejected.
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-extrabold text-white">2) Keep it public</div>
            <div className="mt-1 text-sm text-zinc-200/75">
              Private/deleted/restricted targets stop processing. Platforms decide that — not us.
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-extrabold text-white">3) Realistic volume</div>
            <div className="mt-1 text-sm text-zinc-200/75">
              Big spikes can increase platform cleanup risk. Gradual is safer.
            </div>
          </div>
        </div>
      </Section>

      {/* SEARCH + FILTER */}
      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search: refunds, delivery, wrong link, chargeback..."
              className={cls(
                "w-full md:w-[420px] rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white",
                "placeholder:text-zinc-300/40 backdrop-blur-xl outline-none",
                "focus:border-white/20 focus:bg-white/10"
              )}
            />
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full md:w-[220px] rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white backdrop-blur-xl"
            >
              {buckets.map((b) => (
                <option key={b.id} value={b.id} className="bg-zinc-900">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-zinc-300/70">
            Showing <span className="text-white/90 font-semibold">{filtered.length}</span> items
          </div>
        </div>
      </div>

      {/* FAQ LIST */}
      <div className="mt-4 grid gap-3">
        {filtered.map((x, i) => (
          <AccordionItem key={i} q={x.q} a={x.a} tags={x.tags} />
        ))}
      </div>

      {/* POLICY LINKS */}
      <div className="mt-8 rounded-3xl border border-white/10 bg-black/25 p-6 text-sm text-zinc-200/70 backdrop-blur-xl shadow-soft">
        <div className="text-white font-semibold">Policies & Legal</div>
        <div className="mt-2 flex flex-wrap gap-3">
          <NavLink className="hover:text-white underline underline-offset-4" to="/terms">Terms</NavLink>
          <NavLink className="hover:text-white underline underline-offset-4" to="/privacy">Privacy</NavLink>
          <NavLink className="hover:text-white underline underline-offset-4" to="/refund">Refund Policy</NavLink>
          <NavLink className="hover:text-white underline underline-offset-4" to="/contact">Contact</NavLink>
        </div>
        <div className="mt-3 text-xs text-zinc-300/70">
          Using the site means you agree to these policies. They exist to protect both you and us.
        </div>
      </div>
    </div>
  );
}
