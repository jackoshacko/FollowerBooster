// client/src/pages/Terms.jsx
import React from "react";
import { NavLink } from "react-router-dom";

function cls(...xs) { return xs.filter(Boolean).join(" "); }

function Box({ title, children }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 md:p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_55px_rgba(168,85,247,0.12)]">
      <h2 className="text-lg md:text-xl font-black text-white">{title}</h2>
      <div className="mt-3 text-sm text-zinc-200/80 leading-relaxed">{children}</div>
    </div>
  );
}

export default function Terms() {
  const effective = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full">
      <div className="mb-6">
        <div className="flex flex-col gap-2">
          <div className="text-xs text-zinc-300/70">Effective date: {effective}</div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white">Terms of Service</h1>
          <p className="text-sm md:text-base text-zinc-300/80 max-w-3xl">
            These Terms govern your use of FollowerBooster. By accessing or using the site, you agree to these Terms.
          </p>
        </div>

        <div className="mt-3 text-sm text-zinc-200/70">
          Need help? <NavLink className="underline hover:text-white" to="/contact">Contact support</NavLink>.
        </div>
      </div>

      <div className="grid gap-4">
        <Box title="1) Service scope (what we do / what we don’t)">
          <ul className="list-disc pl-5 space-y-2">
            <li>We provide digital services delivered to a target you specify (e.g., public profile link/username).</li>
            <li>We do not provide legal advice and do not guarantee compliance with any third-party platform rules.</li>
            <li>We do not ask for or store your third-party passwords. Do not share passwords with anyone.</li>
          </ul>
        </Box>

        <Box title="2) Eligibility, account & security">
          <ul className="list-disc pl-5 space-y-2">
            <li>You must provide accurate account information and keep your credentials secure.</li>
            <li>You are responsible for all activity under your account.</li>
            <li>We may suspend accounts for fraud, abuse, chargeback misuse, or policy violations.</li>
          </ul>
        </Box>

        <Box title="3) Orders, delivery & status">
          <ul className="list-disc pl-5 space-y-2">
            <li>Delivery times vary. Many services deliver gradually.</li>
            <li>Status updates are shown in your Orders page.</li>
            <li>Delivery may be affected by third-party platform restrictions, algorithm changes, or target accessibility.</li>
          </ul>
        </Box>

        <Box title="4) Your responsibilities (big one)">
          <ul className="list-disc pl-5 space-y-2">
            <li>You must enter the correct, accessible target. Wrong/invalid/private targets can cause failures.</li>
            <li>You agree not to use the services for illegal activities, harassment, or fraud.</li>
            <li>You acknowledge third-party platforms may remove/clean interactions at any time (“drops”).</li>
          </ul>
        </Box>

        <Box title="5) No guarantees; results may fluctuate">
          <ul className="list-disc pl-5 space-y-2">
            <li>We do not guarantee permanent results, zero-drop, or zero-risk outcomes.</li>
            <li>Platforms can limit, remove, or alter delivered outcomes without notice.</li>
            <li>Best-effort delivery applies to all services unless explicitly stated otherwise.</li>
          </ul>
        </Box>

        <Box title="6) Refunds, chargebacks & disputes">
          <ul className="list-disc pl-5 space-y-2">
            <li>Refund eligibility is defined in the <NavLink className="underline hover:text-white" to="/refund">Refund Policy</NavLink>.</li>
            <li>Chargebacks should be used only after contacting support and attempting resolution.</li>
            <li>We keep audit logs and delivery records to resolve disputes.</li>
            <li>Fraudulent disputes/chargebacks may result in account suspension and service denial.</li>
          </ul>
        </Box>

        <Box title="7) Limitation of liability">
          <ul className="list-disc pl-5 space-y-2">
            <li>To the maximum extent permitted by law, we are not liable for indirect or consequential damages.</li>
            <li>We are not responsible for third-party platform actions (restrictions, bans, removals, algorithm changes).</li>
            <li>Our total liability is limited to the amount paid for the specific affected order.</li>
          </ul>
        </Box>

        <Box title="8) Changes">
          <p>
            We may update these Terms from time to time. Continued use of the site after changes means you accept the updated Terms.
          </p>
        </Box>
      </div>
    </div>
  );
}
