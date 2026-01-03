// server/src/models/WebhookEvent.js
import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * WEBHOOK EVENT (Full ausgestattet + safe)
 *
 * Purpose:
 * - HARD idempotency (no double processing)
 * - Audit/debug trail for payment provider events
 * - Store minimal safe header snapshot + raw payload
 *
 * Supports:
 * - paypal
 * - stripe
 * (extend later) revolut, crypto...
 */

function safeStr(x) {
  return String(x ?? "").trim();
}

const PROVIDERS = ["paypal", "stripe"];
const MODES = ["sandbox", "live", ""];

/**
 * Limit stored headers (avoid leaking sensitive info)
 * Add more keys only if you truly need them for debugging.
 */
function sanitizeHeaders(h = {}) {
  const headers = {};
  const src = h || {};

  // Normalize header keys (express uses lowercase)
  const allow = [
    "user-agent",
    "content-type",
    "stripe-signature",
    "paypal-transmission-id",
    "paypal-transmission-time",
    "paypal-cert-url",
    "paypal-auth-algo",
    "paypal-transmission-sig",
    "x-forwarded-for",
    "x-real-ip",
    "host",
    "x-request-id",
  ];

  for (const k of allow) {
    const v = src[k];
    if (v !== undefined && v !== null && String(v).length) {
      headers[k] = safeStr(v);
    }
  }
  return headers;
}

const WebhookEventSchema = new Schema(
  {
    provider: {
      type: String,
      enum: PROVIDERS,
      required: true,
      index: true,
    },

    /**
     * Idempotency key:
     * - PayPal: event.id
     * - Stripe: event.id
     */
    eventId: { type: String, required: true, index: true, trim: true },

    /**
     * PayPal: event.event_type
     * Stripe: event.type
     */
    eventType: { type: String, default: "", index: true, trim: true },

    /**
     * Correlation id:
     * - PayPal: resource.id (order/capture/etc)
     * - Stripe: object.id (payment_intent, charge, etc)
     */
    resourceId: { type: String, default: "", index: true, trim: true },

    /**
     * "sandbox" / "live" / ""
     */
    mode: {
      type: String,
      enum: MODES,
      default: "",
      index: true,
    },

    /**
     * Received vs processed timestamps
     */
    receivedAt: { type: Date, default: Date.now, index: true },
    processedAt: { type: Date, default: null, index: true },

    /**
     * Lifecycle
     */
    status: {
      type: String,
      enum: ["received", "processed", "ignored", "failed"],
      default: "received",
      index: true,
    },

    /**
     * Error details if failed
     */
    error: {
      message: { type: String, default: "" },
      stack: { type: String, default: "" },
    },

    /**
     * Raw provider payload (can be large)
     */
    payload: { type: Schema.Types.Mixed, default: {} },

    /**
     * SAFE subset of headers for signature debugging
     */
    headers: { type: Schema.Types.Mixed, default: {} },

    /**
     * Optional: internal debug/meta
     */
    meta: { type: Schema.Types.Mixed, default: {} },

    /**
     * OPTIONAL: TTL cleanup support (set expiresAt when writing)
     */
    expiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

/* =========================
   HOOKS (safe normalization)
========================= */

WebhookEventSchema.pre("validate", function (next) {
  this.provider = safeStr(this.provider).toLowerCase();

  this.eventId = safeStr(this.eventId);
  this.eventType = safeStr(this.eventType);
  this.resourceId = safeStr(this.resourceId);

  // sanitize headers snapshot
  this.headers = sanitizeHeaders(this.headers || {});

  // set mode if missing
  if (!this.mode) {
    // best-effort default:
    // - production => live
    // - otherwise => sandbox
    this.mode =
      String(process.env.NODE_ENV || "").toLowerCase() === "production"
        ? "live"
        : "sandbox";
  }

  next();
});

/* =========================
   INDEXES (Idempotency + perf)
========================= */

/**
 * HARD idempotency:
 * unique by provider + eventId
 */
WebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

/**
 * Useful indexes for debugging/admin
 */
WebhookEventSchema.index({ provider: 1, resourceId: 1, createdAt: -1 });
WebhookEventSchema.index({ provider: 1, eventType: 1, createdAt: -1 });
WebhookEventSchema.index({ status: 1, createdAt: -1 });
WebhookEventSchema.index({ provider: 1, status: 1, createdAt: -1 });

/**
 * OPTIONAL TTL cleanup:
 * - If you want auto delete old webhook events:
 *   1) uncomment TTL index
 *   2) when storing, set expiresAt = Date.now() + N days
 *
 * Example (30 days):
 * expiresAt: new Date(Date.now() + 30*24*60*60*1000)
 */
// WebhookEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const WebhookEvent = mongoose.model("WebhookEvent", WebhookEventSchema);
