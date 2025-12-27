// server/src/models/Order.js
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // =========================
    // RELATIONS
    // =========================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },

    // =========================
    // ORDER DATA
    // =========================
    link: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // unit/total price you already use (keep it)
    price: {
      type: Number,
      required: true, // calculated on create
      min: 0,
    },

    // =========================
    // STATUS
    // =========================
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "canceled"],
      default: "pending",
      index: true,
    },

    // =========================
    // PROVIDER
    // =========================
    providerOrderId: {
      type: String,
      default: null,
      index: true,
    },

    // raw provider status (for debug in Orders inspector)
    providerStatus: {
      type: String,
      default: null,
    },

    lastError: {
      type: String,
      default: null,
    },

    // ✅ IMPORTANT: for dashboard quality metrics + avg fulfill time
    completedAt: {
      type: Date,
      default: null,
      index: true,
    },

    // =========================
    // META / ADMIN
    // =========================
    note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

/**
 * Helpful indexes for dashboard:
 * - quickly find pending/processing by user
 * - quickly sync by providerOrderId
 * - 7d charts by createdAt
 */
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ userId: 1, status: 1, updatedAt: -1 });
orderSchema.index({ status: 1, providerOrderId: 1 });
orderSchema.index({ providerOrderId: 1 }, { sparse: true });

export const Order = mongoose.model("Order", orderSchema);
