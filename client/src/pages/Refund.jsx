// client/src/pages/Refund.jsx
import React from "react";
import { NavLink } from "react-router-dom";

function Box({ title, children }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 md:p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_55px_rgba(168,85,247,0.12)]">
      <h2 className="text-lg md:text-xl font-black text-white">{title}</h2>
      <div className="mt-3 text-sm text-zinc-200/80 leading-relaxed">{children}</div>
    </div>
  );
}

export default function Refund() {
  const effective = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full">
      <div className="mb-6">
        <div className="text-xs text-zinc-300/70">Effective date: {effective}</div>
        <h1 className="mt-2 text-2xl md:text-4xl font-black tracking-tight text-white">Refund Policy</h1>
        <p className="mt-2 max-w-3xl text-sm md:text-base text-zinc-300/80">
          Clear rules. Fast decisions. Protected business.
        </p>
      </div>

      <div className="grid gap-4">
        <Box title="1) General rule">
          <p>
            Digital services are considered “consumed” once processing starts. Refunds are considered only for
            <b> non-delivered</b> amounts when the target was valid, public, and accessible and the issue was not caused by user error or platform restrictions.
          </p>
        </Box>

        <Box title="2) Eligible for refund or credit (case-by-case)">
          <ul className="list-disc pl-5 space-y-2">
            <li>Order is not delivered or significantly under-delivered after a reasonable processing time.</li>
            <li>Target was correct, public, accessible, and not restricted during processing.</li>
            <li>No violation of Terms (abuse, fraud, chargeback misuse).</li>
            <li>Proof may be requested (timestamps, screenshots).</li>
          </ul>
        </Box>

        <Box title="3) Not eligible (common reasons)">
          <ul className="list-disc pl-5 space-y-2">
            <li>Wrong/invalid/private target, deleted account, removed content, or restricted link.</li>
            <li>Platform algorithm cleanup/drops after delivery (we do not control platforms).</li>
            <li>Order completed as described (including gradual delivery).</li>
            <li>Duplicate/conflicting orders placed on the same target.</li>
          </ul>
        </Box>

        <Box title="4) Resolution types">
          <ul className="list-disc pl-5 space-y-2">
            <li>Store credit (fastest).</li>
            <li>Partial refund for the undelivered part (if payment provider allows).</li>
            <li>Re-run / replacement (if applicable and safe).</li>
          </ul>
        </Box>

        <Box title="5) How to request">
          <p>
            Contact support with your <b>Order ID</b>, target, and a short description of the issue.
            Go to <NavLink className="underline hover:text-white" to="/contact">Contact</NavLink>.
          </p>
        </Box>

        <Box title="6) Chargebacks & disputes">
          <p>
            Please contact support before initiating a chargeback. We keep audit logs and delivery records.
            Fraudulent chargebacks may lead to account suspension and service denial.
          </p>
        </Box>
      </div>
    </div>
  );
}
