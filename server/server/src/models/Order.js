import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },

    link: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true },

    price: { type: Number, required: true }, // calculated
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "canceled"],
      default: "pending",
    },

    providerOrderId: { type: String, default: null }, // later (provider API)
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
