// client/src/pages/Privacy.jsx
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

export default function Privacy() {
  const effective = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full">
      <div className="mb-6">
        <div className="text-xs text-zinc-300/70">Effective date: {effective}</div>
        <h1 className="mt-2 text-2xl md:text-4xl font-black tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-2 max-w-3xl text-sm md:text-base text-zinc-300/80">
          This explains what data we collect, why we collect it, and how we protect it.
        </p>
      </div>

      <div className="grid gap-4">
        <Box title="1) Data we collect">
          <ul className="list-disc pl-5 space-y-2">
            <li>Account data: email/username, hashed password, login metadata (basic).</li>
            <li>Order data: target link/username you submit, service selection, quantity, timestamps.</li>
            <li>Payment data: provider transaction identifiers and status (we do not store full card details).</li>
            <li>Technical data: IP address, device/browser info, logs for security and debugging.</li>
          </ul>
        </Box>

        <Box title="2) What we DO NOT collect">
          <ul className="list-disc pl-5 space-y-2">
            <li>We do not ask for or store your third-party platform passwords.</li>
            <li>We do not sell your personal data.</li>
          </ul>
        </Box>

        <Box title="3) Why we use data">
          <ul className="list-disc pl-5 space-y-2">
            <li>To provide and deliver services and show order status.</li>
            <li>To prevent fraud/abuse and secure accounts.</li>
            <li>To handle support tickets, disputes, and chargeback evidence.</li>
            <li>To comply with legal obligations when applicable.</li>
          </ul>
        </Box>

        <Box title="4) Cookies">
          <p>
            We may use essential cookies for sessions/authentication and basic preferences.
            See the cookie notice shown on the site. You can disable non-essential cookies where available.
          </p>
        </Box>

        <Box title="5) Data retention">
          <p>
            We retain data as long as necessary for providing services, resolving disputes, and meeting legal/security requirements.
            You may request deletion of your account data where legally possible.
          </p>
        </Box>

        <Box title="6) Your rights & contact">
          <p>
            You can request access, correction, or deletion (where applicable) by contacting us.
            Use <NavLink className="underline hover:text-white" to="/contact">Contact</NavLink>.
          </p>
        </Box>

        <Box title="7) Security">
          <p>
            We use reasonable technical and organizational measures to protect data (encryption in transit, access controls, logging).
            However, no system is 100% secure.
          </p>
        </Box>
      </div>
    </div>
  );
}
