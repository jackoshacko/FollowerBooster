// server/src/routes/me.routes.js
import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middlewares/auth.js";
import { User } from "../models/User.js";
import { Order } from "../models/Order.js";

const router = Router();

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

function requireMongoId(req, res) {
  const userId = String(req.user?.id || "").trim();
  if (!mongoose.isValidObjectId(userId)) {
    res.status(401).json({ message: "Invalid user id" });
    return null;
  }
  return userId;
}

// GET /api/me (token-only)
router.get("/me", requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
    balance: req.user.balance,
    name: req.user.name || "",
    avatarUrl: req.user.avatarUrl || "",
  });
});

/**
 * GET /api/dashboard
 * - balance
 * - activeOrders
 * - spent30d
 */
router.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const userId = requireMongoId(req, res);
    if (!userId) return;

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const now = new Date();
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);

    const [user, activeOrders, spentAgg] = await Promise.all([
      User.findById(userId).select("balance"),
      Order.countDocuments({
        userId: userObjectId, // ✅ always ObjectId for consistency
        status: { $in: ["pending", "processing"] },
      }),
      Order.aggregate([
        {
          $match: {
            userId: userObjectId, // ✅ safe
            createdAt: { $gte: d30 },
            status: { $in: ["pending", "processing", "completed"] },
          },
        },
        { $group: { _id: null, total: { $sum: "$price" } } },
      ]),
    ]);

    const spent30d = spentAgg?.[0]?.total ?? 0;

    return res.json({
      balance: round2(user?.balance || 0),
      currency: "EUR",
      activeOrders,
      spent30d: round2(spent30d),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
