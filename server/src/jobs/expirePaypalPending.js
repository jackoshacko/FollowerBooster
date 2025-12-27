import { Transaction } from "../models/Transaction.js";

export async function expirePaypalPending() {
  await Transaction.updateMany(
    {
      provider: "paypal",
      status: "pending",
      createdAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) },
    },
    { $set: { status: "expired" } }
  );
}
