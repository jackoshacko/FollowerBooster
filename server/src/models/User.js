// server/src/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // ✅ for local auth (email+password)
    passwordHash: { type: String, required: true },

    // ✅ oauth mapping
    provider: { type: String, enum: ["local", "google"], default: "local", index: true },
    providerId: { type: String, default: "", index: true }, // google profile.id

    // ✅ optional profile
    name: { type: String, default: "", trim: true },
    avatarUrl: { type: String, default: "" },

    // role-based access
    role: { type: String, enum: ["user", "admin"], default: "user" },

    balance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// ✅ allow multiple users without providerId, but unique when providerId exists
userSchema.index(
  { provider: 1, providerId: 1 },
  { unique: true, partialFilterExpression: { providerId: { $type: "string", $ne: "" } } }
);

export const User = mongoose.model("User", userSchema);
