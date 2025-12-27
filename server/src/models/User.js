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
    passwordHash: { type: String, required: true },

    // role-based access
    role: { type: String, enum: ["user", "admin"], default: "user" },

    balance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
