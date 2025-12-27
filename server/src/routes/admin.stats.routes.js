import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/admin.js";

import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import { Transaction } from "../models/Transaction.js";

const router = Router();

/**
 * GET /admin/stats
 * Admin dashboard stats:
 * - usersTotal
 * - revenue30d (sum topup confirmed last 30d)
 * - ordersActive (pending/processing)
 * - ordersToday
 * - seriesRevenue7d (daily sum)
 * - seriesOrders7d (daily count)
 */
router.get("/stats", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const now = new Date();

    // today start (local server time)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);

    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);

    const [
      usersTotal,
      ordersActive,
      ordersToday,
      revenue30dAgg,
      revenue7dAgg,
      orders7dAgg,
    ] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments({ status: { $in: ["pending", "processing"] } }),
      Order.countDocuments({ createdAt: { $gte: todayStart } }),

      Transaction.aggregate([
        {
          $match: {
            type: "topup",
            status: "confirmed",
            createdAt: { $gte: d30 },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      Transaction.aggregate([
        {
          $match: {
            type: "topup",
            status: "confirmed",
            createdAt: { $gte: d7 },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      Order.aggregate([
        { $match: { createdAt: { $gte: d7 } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const revenue30d = revenue30dAgg?.[0]?.total ?? 0;

    // Normalize series to include all last 7 days (even if 0)
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      days.push(key);
    }

    const revenueMap = new Map(revenue7dAgg.map((x) => [x._id, x.total]));
    const ordersMap = new Map(orders7dAgg.map((x) => [x._id, x.count]));

    const seriesRevenue7d = days.map((day) => ({
      day,
      value: Math.round(((revenueMap.get(day) || 0) * 100)) / 100,
    }));

    const seriesOrders7d = days.map((day) => ({
      day,
      value: ordersMap.get(day) || 0,
    }));

    return res.json({
      usersTotal,
      revenue30d: Math.round(revenue30d * 100) / 100,
      ordersActive,
      ordersToday,
      seriesRevenue7d,
      seriesOrders7d,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
