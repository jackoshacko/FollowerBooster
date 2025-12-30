import React from "react";

export default function Contact() {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl font-semibold">Contact</h1>
      <p className="text-zinc-300">
        For support, billing, or policy questions, contact us:
      </p>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-zinc-200">
        <div className="text-sm text-zinc-400">Support email</div>
        <div className="font-semibold">support@your-domain.com</div>
        <div className="mt-2 text-sm text-zinc-400">
          Tip: include your account email + order ID for faster help.
        </div>
      </div>
      <p className="text-zinc-400 text-sm">
        Replace the email with your real domain email before going live.
      </p>
    </div>
  );
}
