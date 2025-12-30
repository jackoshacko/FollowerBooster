import React from "react";

export default function Privacy() {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      <p className="text-zinc-300">
        We collect only the data required to provide the service (e.g. account email, orders, wallet
        and payment logs). We do not sell your personal data.
      </p>
      <p className="text-zinc-300">
        Authentication may store tokens in localStorage to keep you signed in. We may use cookies
        for session/refresh security depending on your configuration.
      </p>
      <p className="text-zinc-300">
        Payments are processed through payment providers (e.g. PayPal). Provider event IDs may be
        stored for fraud prevention and idempotent crediting.
      </p>
      <p className="text-zinc-400 text-sm">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>
    </div>
  );
}
