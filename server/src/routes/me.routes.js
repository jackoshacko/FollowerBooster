// server/src/routes/me.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { User } from "../models/User.js";
import { Order } from "../models/Order.js";

const router = Router();

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

// POSTOJI: GET /api/me
router.get("/me", requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    role: req.user.role,
  });
});

/**
 * NEW: GET /api/dashboard
 * User dashboard stats (brzo, bez listanja svih ordera)
 * returns:
 * - balance
 * - activeOrders
 * - spent30d
 */
router.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 30 dana unazad
    const now = new Date();
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);

    const [user, activeOrders, spentAgg] = await Promise.all([
      User.findById(userId).select("balance"),
      Order.countDocuments({
        userId,
        status: { $in: ["pending", "processing"] },
      }),
      Order.aggregate([
        {
          $match: {
            userId: typeof userId === "string" ? new (await import("mongoose")).default.Types.ObjectId(userId) : userId,
            createdAt: { $gte: d30 },
            // spent = ono što je realno plaćeno/rezervisano
            // izbacujemo failed/canceled
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
