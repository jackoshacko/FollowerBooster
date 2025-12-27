import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";

const router = Router();

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

function toSignedAmount(tx) {
  // topup/adjustment je +
  // order/refund zavisi kako vodiš logiku; ja ovde pravim:
  // - topup: +
  // - refund: +
  // - order: -
  // - adjustment: može biti + ili - (zavisi kako ga kreiraš; ovde tretiram kao +)
  if (tx.type === "order") return -Math.abs(tx.amount);
  return Math.abs(tx.amount);
}

function makeLabel(tx) {
  const p = (tx.provider || "").toLowerCase();

  if (tx.type === "topup") {
    if (p === "paypal") return "PayPal top-up";
    if (p === "crypto") return "Crypto top-up";
    if (p === "revolut") return "Revolut top-up";
    return "Top-up";
  }

  if (tx.type === "order") return "Order payment";
  if (tx.type === "refund") return "Refund";
  if (tx.type === "adjustment") return "Adjustment";

  return "Transaction";
}

function shortId(id = "") {
  if (!id) return "";
  const s = String(id);
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

/**
 * GET /wallet
 * vraca trenutni balance + zadnjih 20 transakcija (formatirano za UI)
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("balance email");
    if (!user) return res.status(404).json({ message: "User not found" });

    const txs = await Transaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("provider providerOrderId providerEventId status amount currency createdAt type");

    const out = txs.map((tx) => {
      const signed = round2(toSignedAmount(tx));
      const label = makeLabel(tx);

      return {
        _id: tx._id,
        type: tx.type,
        status: tx.status,
        provider: tx.provider,
        currency: tx.currency,
        amount: round2(tx.amount),
        signedAmount: signed,
        label,

        providerOrderId: tx.providerOrderId || null,
        displayId: shortId(tx.providerOrderId || tx._id),

        createdAt: tx.createdAt,
      };
    });

    return res.json({
      balance: round2(user.balance || 0),
      currency: "EUR", // ako imaš multi-currency wallet kasnije, menjamo
      transactions: out,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
