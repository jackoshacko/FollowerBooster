// server/src/models/Service.js
import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema(
  {
    /* ===========================
       DISPLAY
    =========================== */
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "", trim: true },

    /* ===========================
       TAXONOMY
    =========================== */
    platform: {
      type: String,
      enum: [
        "instagram",
        "tiktok",
        "youtube",
        "facebook",
        "twitter",
        "telegram",
        "spotify",
        "snapchat",
        "discord",
        "website",
        "other",
      ],
      default: "other",
      index: true,
    },

    type: {
      type: String,
      enum: [
        "followers",
        "likes",
        "views",
        "comments",
        "shares",
        "saves",
        "live",
        "watchtime",
        "traffic",
        "other",
      ],
      default: "other",
      index: true,
    },

    category: { type: String, default: "Other", trim: true, index: true },

    /* ===========================
       PRICING & LIMITS
    =========================== */
    pricePer1000: { type: Number, required: true, min: 0 },
    min: { type: Number, default: 1, min: 1 },
    max: { type: Number, default: 1_000_000, min: 1 },

    /* ===========================
       PROVIDER
    =========================== */
    provider: { type: String, default: "default", index: true },

    // ✅ CANONICAL (backend ga traži)
    externalServiceId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    // ✅ legacy / backward compat
    providerServiceId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    /* ===========================
       STATUS
    =========================== */
    enabled: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, minimize: false }
);

/* ===========================
   INDEXES
=========================== */
ServiceSchema.index({ platform: 1, enabled: 1 });
ServiceSchema.index({ platform: 1, type: 1, enabled: 1 });
ServiceSchema.index({ pricePer1000: 1 });

// provider mapping index
ServiceSchema.index({ provider: 1, externalServiceId: 1 });
ServiceSchema.index({ provider: 1, providerServiceId: 1 });

/**
 * ✅ Auto-alias sync (da nikad ne bude mismatch)
 */
ServiceSchema.pre("save", function (next) {
  if (!this.externalServiceId && this.providerServiceId) {
    this.externalServiceId = String(this.providerServiceId);
  }
  if (!this.providerServiceId && this.externalServiceId) {
    this.providerServiceId = String(this.externalServiceId);
  }
  next();
});

export const Service = mongoose.model("Service", ServiceSchema);
