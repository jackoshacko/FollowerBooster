// client/src/pages/Contact.jsx
import React, { useState } from "react";

function cls(...xs) { return xs.filter(Boolean).join(" "); }

function Box({ title, children }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 md:p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_55px_rgba(168,85,247,0.12)]">
      <h2 className="text-lg md:text-xl font-black text-white">{title}</h2>
      <div className="mt-3 text-sm text-zinc-200/80 leading-relaxed">{children}</div>
    </div>
  );
}

export default function Contact() {
  const [copied, setCopied] = useState(false);

  // TODO: zameni sa tvojim mailom / support kanalima
  const SUPPORT_EMAIL = "followerbooster96@gmail.com";

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white">Contact Support</h1>
        <p className="mt-2 max-w-3xl text-sm md:text-base text-zinc-300/80">
          Fastest support happens when you send the right info. Use the template below.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Box title="Support email">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/90">
              {SUPPORT_EMAIL}
            </div>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(SUPPORT_EMAIL);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                } catch {}
              }}
              className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-3 text-xs text-zinc-300/70">
            Response time depends on queue + order complexity. Include Order ID for priority handling.
          </div>
        </Box>

        <Box title="Required info (so nobody can complain later)">
          <ul className="list-disc pl-5 space-y-2">
            <li><b>Order ID</b></li>
            <li><b>Target</b> (username/link exactly as submitted)</li>
            <li><b>What you expected</b> vs <b>what happened</b></li>
            <li><b>Time window</b> (when placed)</li>
            <li>Screenshots (optional, but helps)</li>
          </ul>
        </Box>
      </div>

      <div className="mt-4">
        <Box title="Copy/paste template">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-200/80 whitespace-pre-wrap">
{`Subject: Support request — Order ID: [YOUR_ORDER_ID]

Hello Support,

Order ID: [YOUR_ORDER_ID]
Account email: [YOUR_EMAIL]
Target: [USERNAME/LINK]
Service: [SERVICE NAME]
Quantity: [QTY]

Issue:
[Describe clearly: status, delivery amount, errors, timing]

Expected outcome:
[What you expected]

Additional notes:
[Anything important, screenshots if relevant]

Thank you.`}
          </div>
        </Box>
      </div>
    </div>
  );
}
