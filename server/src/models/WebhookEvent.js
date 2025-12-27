// server/src/models/WebhookEvent.js
import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * WEBHOOK EVENT (Full ausgestattet)
 *
 * Purpose:
 * - Hard idempotency (no double processing)
 * - Audit/debug trail for payment provider events (PayPal now, extend later)
 *
 * Design:
 * - We store the raw payload (Mixed) + optional headers snapshot
 * - We track lifecycle: received -> processed/ignored/failed
 * - eventId is the idempotency key (PayPal: event.id)
 */

const WebhookEventSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ["paypal"], // extend later: "stripe", "revolut", etc.
      required: true,
      index: true,
    },

    /**
     * PayPal: event.id
     * This should be unique and is our idempotency key.
     */
    eventId: { type: String, required: true, index: true },

    /**
     * PayPal: event.event_type
     */
    eventType: { type: String, default: "", index: true },

    /**
     * Helpful correlation id:
     * - orderId or captureId (whatever we can extract)
     */
    resourceId: { type: String, default: "", index: true },

    /**
     * Mode/source for audit:
     * - sandbox / live
     */
    mode: {
      type: String,
      enum: ["sandbox", "live", ""],
      default: "",
      index: true,
    },

    /**
     * Received vs processed timestamps:
     * - receivedAt: when we stored the event
     * - processedAt: when we actually handled it (confirm/credit/etc.)
     */
    receivedAt: { type: Date, default: Date.now, index: true },
    processedAt: { type: Date, default: null, index: true },

    /**
     * Processing status:
     * - received: stored but not processed (rare; if you queue)
     * - processed: successfully handled
     * - ignored: valid event but not relevant (e.g. non-payment)
     * - failed: processing error (store error for later debug/retry)
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
     * Raw provider payload
     * (Mixed to allow any PayPal JSON structure)
     */
    payload: { type: Schema.Types.Mixed, default: {} },

    /**
     * Optional debug: request headers snapshot (safe subset)
     * Useful in LIVE for signature issues.
     */
    headers: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

/* =========================
   INDEXES
========================= */

/**
 * HARD idempotency:
 * - PayPal eventId is globally unique, but keeping provider in index is fine too.
 */
WebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

/**
 * Helpful indexes for admin/debug screens
 */
WebhookEventSchema.index({ provider: 1, resourceId: 1, createdAt: -1 });
WebhookEventSchema.index({ provider: 1, eventType: 1, createdAt: -1 });
WebhookEventSchema.index({ status: 1, createdAt: -1 });

export const WebhookEvent = mongoose.model("WebhookEvent", WebhookEventSchema);
