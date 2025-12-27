import mongoose from "mongoose";

const PayPalPaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },

    provider: { type: String, default: "paypal" },
    currency: { type: String, required: true },
    amount: { type: Number, required: true },

    // PayPal order id (token)
    orderId: { type: String, required: true, unique: true, index: true },

    status: { type: String, default: "CREATED", index: true }, // CREATED, APPROVED, COMPLETED

    // webhook / capture ids
    captureId: { type: String, default: "" },

    // idempotency (event.id)
    lastEventId: { type: String, default: "" },
  },
  { timestamps: true }
);

export const PayPalPayment = mongoose.model("PayPalPayment", PayPalPaymentSchema);
