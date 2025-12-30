import React from "react";

export default function Refund() {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl font-semibold">Refund Policy</h1>
      <p className="text-zinc-300">
        Refunds are handled on a case-by-case basis depending on service status.
      </p>
      <ul className="list-disc pl-6 text-zinc-300 space-y-2">
        <li>If an order has not started, we may refund to wallet or original method.</li>
        <li>If an order is partially completed, a partial refund may apply.</li>
        <li>Completed orders are generally not refundable.</li>
        <li>Chargebacks or fraud attempts may result in account suspension.</li>
      </ul>
      <p className="text-zinc-400 text-sm">
        Contact support for review of a specific order/payment.
      </p>
    </div>
  );
}
