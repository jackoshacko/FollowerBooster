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
      maxlength: 254,
      validate: {
        validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "")),
        message: "Invalid email format",
      },
    },

    passwordHash: {
      type: String,
      required: true,
      minlength: 10,
      select: false, // ✅ default ne vraćaj passwordHash iz query-a
    },

    role: { type: String, enum: ["user", "admin"], default: "user", index: true },

    balance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// ✅ extra index (nije obavezno ali je profi)
userSchema.index({ email: 1 }, { unique: true });

// ✅ safe JSON output (nikad ne leakuj passwordHash)
userSchema.set("toJSON", {
  transform: function (_doc, ret) {
    delete ret.passwordHash;
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model("User", userSchema);
