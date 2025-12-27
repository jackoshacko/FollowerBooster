import mongoose from "mongoose";

const RefreshSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    userAgent: {
      type: String,
      default: "",
    },
    ip: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// TTL – automatsko brisanje kad istekne
RefreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshSession = mongoose.model(
  "RefreshSession",
  RefreshSessionSchema
);
