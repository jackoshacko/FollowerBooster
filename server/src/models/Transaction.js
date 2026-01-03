// server/src/models/Transaction.js
import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * TRANSACTION MODEL (Full ausgestattet + safe)
 *
 * One model for:
 * - Wallet topup (PayPal/Stripe/Crypto/Revolut) -> credit (+)
 * - Order debit (wallet/internal) -> debit (-)
 * - Refund -> credit (+)
 * - Admin adjustment (+/-)
 *
 * Notes:
 * - amount can be + or -
 * - provider refs optional (empty string allowed)
 * - idempotency indexes are PARTIAL to avoid E11000 for empty strings
 */

function safeStr(x) {
  return String(x || "").trim();
}
function round2(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

const PROVIDERS = ["paypal", "stripe", "crypto", "revolut", "wallet", "internal"];
const TYPES = ["topup", "topup_credit", "order", "order_debit", "refund", "adjustment"];
const STATUSES = ["pending", "confirmed", "failed", "expired", "refunded"];

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
      enum: TYPES,
      required: true,
      index: true,
    },

    /**
     * STATUS
     */
    status: {
      type: String,
      enum: STATUSES,
      default: "pending",
      index: true,
    },

    /**
     * amount:
     * - + credit
     * - - debit
     */
    amount: { type: Number, required: true },

    currency: {
      type: String,
      default: "EUR",
      index: true,
    },

    /**
     * provider:
     * - external: paypal / stripe / crypto / revolut
     * - internal: wallet / internal
     */
    provider: {
      type: String,
      enum: PROVIDERS,
      required: true,
      index: true,
    },

    /**
     * Audit snapshots (optional)
     */
    balanceBefore: { type: Number, default: null },
    balanceAfter: { type: Number, default: null },

    /**
     * Provider refs:
     * - providerOrderId: e.g. PayPal order id / Stripe payment_intent id
     * - providerCaptureId: e.g. PayPal capture id (Stripe usually empty)
     * - providerEventId: webhook event id (Stripe/PayPal event.id) -> HARD idempotency
     */
    providerOrderId: { type: String, default: "", index: true },
    providerCaptureId: { type: String, default: "", index: true },
    providerEventId: { type: String, default: "", index: true },

    /**
     * When transaction became final/confirmed
     */
    confirmedAt: { type: Date, default: null, index: true },

    /**
     * meta: free JSON (orderId, serviceId, debug payload...)
     */
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

/* =========================
   NORMALIZE + BASIC VALIDATION
========================= */
TransactionSchema.pre("validate", function (next) {
  // normalize currency
  if (this.currency) this.currency = safeStr(this.currency).toUpperCase();

  // normalize provider refs
  this.providerOrderId = safeStr(this.providerOrderId);
  this.providerCaptureId = safeStr(this.providerCaptureId);
  this.providerEventId = safeStr(this.providerEventId);

  // normalize numbers
  if (typeof this.amount === "number" && Number.isFinite(this.amount)) {
    this.amount = round2(this.amount);
  }
  if (typeof this.balanceBefore === "number" && Number.isFinite(this.balanceBefore)) {
    this.balanceBefore = round2(this.balanceBefore);
  }
  if (typeof this.balanceAfter === "number" && Number.isFinite(this.balanceAfter)) {
    this.balanceAfter = round2(this.balanceAfter);
  }

  // safety: confirm requires confirmedAt
  if (this.status === "confirmed" && !this.confirmedAt) {
    this.confirmedAt = new Date();
  }

  next();
});

/* =========================
   INDEXES (Idempotency + perf)
========================= */

/**
 * 1) WEBHOOK EVENT ID idempotency
 * - Unique per provider + providerEventId (Stripe/PayPal event.id)
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
 * - Unique per provider + providerOrderId + type
 * - only for external providers + providerOrderId != ""
 *
 * Stripe: providerOrderId = payment_intent id (pi_...)
 * PayPal: order id
 */
TransactionSchema.index(
  { provider: 1, providerOrderId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider: { $in: ["paypal", "stripe", "crypto", "revolut"] },
      providerOrderId: { $type: "string", $ne: "" },
    },
  }
);

/**
 * 3) PROVIDER CAPTURE ID idempotency
 * - PayPal capture id etc.
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
TransactionSchema.index({ provider: 1, createdAt: -1 });
TransactionSchema.index({ type: 1, status: 1, createdAt: -1 });

export const Transaction = mongoose.model("Transaction", TransactionSchema);
