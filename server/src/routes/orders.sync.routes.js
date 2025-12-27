import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { Order } from "../models/Order.js";
import { providerGetStatus } from "../services/provider/providerApi.js";

const router = Router();

// GET /orders/:id  (get single order)
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id })
      .populate("serviceId");
    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({ order });
  } catch (e) {
    next(e);
  }
});

// POST /orders/:id/sync  (manual provider sync)
router.post("/:id/sync", requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.providerOrderId) {
      return res.status(400).json({ message: "Order has no providerOrderId yet" });
    }

    const st = await providerGetStatus(order.providerOrderId);

    order.providerStatus = st.status || order.providerStatus;

    if (st.status === "completed") order.status = "completed";
    else if (st.status === "failed") order.status = "failed";
    else order.status = "processing";

    await order.save();

    res.json({ ok: true, order, provider: st });
  } catch (e) {
    next(e);
  }
});

export default router;
