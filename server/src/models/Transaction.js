// server/src/models/Transaction.js
import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * TRANSACTION MODEL (Full austattung)
 *
 * One model for:
 * - Wallet topup (PayPal/Crypto/Revolut) -> credit (+)
 * - Order debit (wallet/internal) -> debit (-)
 * - Refund -> credit (+)
 * - Admin adjustment (+/-)
 *
 * Notes:
 * - amount can be + or -
 * - wallet/internal tx have empty provider IDs
 * - idempotency indexes are PARTIAL to avoid E11000 for empty strings
 */

const TransactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /**
     * TYPES
     */
    type: {
      type: String,
      enum: [
        "topup",
        "topup_credit",
        "order",
        "order_debit",
        "refund",
        "adjustment",
      ],
      required: true,
      index: true,
    },

    /**
     * STATUS
     * - pending: not final yet
     * - confirmed: booked / credited / debited
     * - failed: failed attempt
     * - expired: timed out / abandoned
     * - refunded: optional future (refund after confirmed)
     */
    status: {
      type: String,
      enum: ["pending", "confirmed", "failed", "expired", "refunded"],
      default: "pending",
      index: true,
    },

    /**
     * amount:
     * - can be + or -
     * - normalized to 2 decimals in pre-save hook
     */
    amount: { type: Number, required: true },

    currency: {
      type: String,
      default: "EUR",
      index: true,
    },

    /**
     * provider:
     * - external: paypal / crypto / revolut
     * - internal: wallet / internal
     */
    provider: {
      type: String,
      enum: ["paypal", "crypto", "revolut", "wallet", "internal"],
      required: true,
      index: true,
    },

    /**
     * Audit snapshots (optional)
     */
    balanceBefore: { type: Number, default: null },
    balanceAfter: { type: Number, default: null },

    /**
     * Provider refs (PayPal etc.)
     */
    providerOrderId: { type: String, default: "", index: true },
    providerCaptureId: { type: String, default: "", index: true },
    providerEventId: { type: String, default: "", index: true },

    /**
     * When transaction became final/confirmed
     * (super useful for dashboards + audits)
     */
    confirmedAt: { type: Date, default: null, index: true },

    /**
     * meta: free JSON (orderId, serviceId, reason, debug payload...)
     */
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

/* =========================
   INDEXES (Idempotency + perf)
========================= */

/**
 * 1) WEBHOOK EVENT ID idempotency
 * - only when providerEventId != ""
 */
TransactionSchema.index(
  { provider: 1, providerEventId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerEventId: { $type: "string", $ne: "" },
    },
  }
);

/**
 * 2) PROVIDER ORDER ID idempotency
 * - only for external providers + providerOrderId != ""
 */
TransactionSchema.index(
  { provider: 1, providerOrderId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider: { $in: ["paypal", "crypto", "revolut"] },
      providerOrderId: { $type: "string", $ne: "" },
    },
  }
);

/**
 * 3) PROVIDER CAPTURE ID idempotency
 * - only for external providers + providerCaptureId != ""
 */
TransactionSchema.index(
  { provider: 1, providerCaptureId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider: { $in: ["paypal", "crypto", "revolut"] },
      providerCaptureId: { $type: "string", $ne: "" },
    },
  }
);

/**
 * 4) perf listing: wallet page + admin tx page
 */
TransactionSchema.index({ userId: 1, createdAt: -1 });

/* =========================
   NORMALIZE NUMBERS (2 decimals)
========================= */
TransactionSchema.pre("save", function (next) {
  if (typeof this.amount === "number" && Number.isFinite(this.amount)) {
    this.amount = Math.round(this.amount * 100) / 100;
  }
  if (typeof this.balanceBefore === "number" && Number.isFinite(this.balanceBefore)) {
    this.balanceBefore = Math.round(this.balanceBefore * 100) / 100;
  }
  if (typeof this.balanceAfter === "number" && Number.isFinite(this.balanceAfter)) {
    this.balanceAfter = Math.round(this.balanceAfter * 100) / 100;
  }
  next();
});

export const Transaction = mongoose.model("Transaction", TransactionSchema);
