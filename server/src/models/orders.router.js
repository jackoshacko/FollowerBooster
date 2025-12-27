import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middlewares/auth.js";
import { Service } from "../models/Service.js";
import { Order } from "../models/Order.js";

const router = Router();

// helper: simple link validation
function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * GET /orders
 * user sees only own orders
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .populate("serviceId")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /orders
 * body: { serviceId, link, quantity }
 */
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { serviceId, link, quantity } = req.body;

    if (!serviceId || !mongoose.isValidObjectId(serviceId)) {
      return res.status(400).json({ message: "Invalid serviceId" });
    }

    if (!link || typeof link !== "string" || link.trim().length < 6) {
      return res.status(400).json({ message: "Invalid link" });
    }

    if (!isValidUrl(link.trim())) {
      return res.status(400).json({ message: "Link must be a valid URL (http/https)" });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const service = await Service.findById(serviceId);
    if (!service || !service.active) {
      return res.status(404).json({ message: "Service not found" });
    }

    if (qty < service.min || qty > service.max) {
      return res.status(400).json({
        message: `Quantity must be between ${service.min} and ${service.max}`,
      });
    }

    // price calculation
    const rawPrice = (qty / 1000) * service.pricePer1000;
    const price = Math.round(rawPrice * 100) / 100; // 2 decimals

    const order = await Order.create({
      userId: req.user.id,
      serviceId: service._id,
      link: link.trim(),
      quantity: qty,
      price,
      status: "pending",
    });

    res.status(201).json(order);
  } catch (e) {
    next(e);
  }
});

export default router;
