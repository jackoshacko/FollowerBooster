// server/src/jobs/transactions.job.js
import { Transaction } from "../models/Transaction.js";

export function startTransactionsJob({ intervalMs = 10 * 60 * 1000 } = {}) {
  setInterval(async () => {
    try {
      // pending paypal topup stariji od 60 min -> expired
      const cutoff = new Date(Date.now() - 60 * 60 * 1000);

      const res = await Transaction.updateMany(
        {
          provider: "paypal",
          type: "topup",
          status: "pending",
          createdAt: { $lt: cutoff },
        },
        { $set: { status: "expired" } }
      );

      if (res.modifiedCount > 0) {
        console.log(`🧾 tx-job: expired ${res.modifiedCount} pending paypal topups`);
      }
    } catch (e) {
      console.error("tx-job error:", e?.message || e);
    }
  }, intervalMs);

  console.log(`🧾 tx-job started interval=${intervalMs}ms`);
}
