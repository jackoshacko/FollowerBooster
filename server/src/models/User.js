// server/src/models/User.js
import mongoose from "mongoose";

const { Schema } = mongoose;

function safeStr(x) {
  return String(x || "").trim();
}
function round2(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

const PROVIDERS = ["local", "google"];
const ROLES = ["user", "admin"];

/* =========================
   SCHEMA
========================= */

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true, // unique index created by mongoose
      lowercase: true,
      trim: true,
      index: true,
    },

    /**
     * Local auth:
     * - REQUIRED if provider === "local"
     * OAuth users can have empty hash (passwordless)
     *
     * SECURITY: select:false => won't be returned unless explicitly selected.
     */
    passwordHash: {
      type: String,
      default: "",
      select: false, // ✅ don't leak hash by default
      validate: {
        validator: function (v) {
          // if local user => must have hash
          if (this.provider === "local") return typeof v === "string" && v.length > 0;
          return true;
        },
        message: "passwordHash required for local users",
      },
    },

    // ✅ oauth mapping
    provider: { type: String, enum: PROVIDERS, default: "local", index: true },
    providerId: { type: String, default: "", index: true }, // google profile.id

    // ✅ optional profile
    name: { type: String, default: "", trim: true },
    avatarUrl: { type: String, default: "" },

    // future-ready flags
    emailVerified: { type: Boolean, default: false, index: true },
    isDisabled: { type: Boolean, default: false, index: true },
    lastLoginAt: { type: Date, default: null, index: true },

    // role-based access
    role: { type: String, enum: ROLES, default: "user", index: true },

    /**
     * Wallet balance (EUR)
     */
    balance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

/* =========================
   NORMALIZATION / SAFETY
========================= */

userSchema.pre("validate", function (next) {
  this.email = safeStr(this.email).toLowerCase();
  this.providerId = safeStr(this.providerId);
  this.name = safeStr(this.name);
  this.balance = round2(this.balance);

  // soft safety: google provider without providerId is pointless
  // (not throwing to avoid breaking old data)
  next();
});

/* =========================
   INDEXES (perf + correctness)
========================= */

// ✅ allow multiple users without providerId, but unique when providerId exists
userSchema.index(
  { provider: 1, providerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerId: { $type: "string", $ne: "" },
    },
  }
);

// quick lists / admin panels
userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1, createdAt: -1 });

/* =========================
   QUERY HELPERS (IMPORTANT)
========================= */

/**
 * Use this ONLY in auth flows (login/reset) where you need passwordHash.
 * Example:
 *   const user = await User.findOne({ email }).withPassword();
 */
userSchema.query.withPassword = function () {
  return this.select("+passwordHash");
};

export const User = mongoose.model("User", userSchema);
