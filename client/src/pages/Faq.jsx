import React from "react";

function Item({ q, a }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="font-semibold">{q}</div>
      <div className="mt-2 text-sm text-zinc-300">{a}</div>
    </div>
  );
}

export default function Faq() {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl font-semibold">Help / FAQ</h1>

      <div className="grid gap-3">
        <Item
          q="Payment completed but balance not updated"
          a="It can take a short time for provider confirmation. If it still doesn’t update, contact support with the payment reference."
        />
        <Item
          q="Where is my order?"
          a="Open Orders page to see status. Some services start with a delay depending on provider capacity."
        />
        <Item
          q="Do you guarantee results?"
          a="Results may vary depending on platform conditions. We do not guarantee specific engagement outcomes."
        />
        <Item
          q="Refunds"
          a="Refund eligibility depends on service status. See Refund Policy for details."
        />
      </div>
    </div>
  );
}
