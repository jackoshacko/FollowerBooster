// server/src/routes/admin.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/admin.js";

import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import { Transaction } from "../models/Transaction.js";

const router = Router();

// sve admin rute moraju proći auth + admin
router.use(requireAuth, requireAdmin);

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

/**
 * GET /admin/stats
 * stats za admin dashboard
 * - vraća i "stare" ključeve (users, orders, pendingOrders, revenue)
 * - i "nove" (usersTotal, ordersTotal, ordersActive, ordersToday, revenue30d, series...)
 */
router.get("/stats", async (req, res, next) => {
  try {
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);

    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);

    const [
      usersTotal,
      ordersTotal,
      ordersActive,
      ordersToday,
      revenue30dAgg,
      revenue7dAgg,
      orders7dAgg,
    ] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: { $in: ["pending", "processing"] } }),
      Order.countDocuments({ createdAt: { $gte: todayStart } }),

      Transaction.aggregate([
        { $match: { type: "topup", status: "confirmed", createdAt: { $gte: d30 } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      Transaction.aggregate([
        { $match: { type: "topup", status: "confirmed", createdAt: { $gte: d7 } } },
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

    const revenue30d = round2(revenue30dAgg?.[0]?.total ?? 0);

    // normalize series for last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const revenueMap = new Map(revenue7dAgg.map((x) => [x._id, x.total]));
    const ordersMap = new Map(orders7dAgg.map((x) => [x._id, x.count]));

    const seriesRevenue7d = days.map((day) => ({
      day,
      value: round2(revenueMap.get(day) || 0),
    }));

    const seriesOrders7d = days.map((day) => ({
      day,
      value: ordersMap.get(day) || 0,
    }));

    // ✅ backwards compatible keys (ako frontend očekuje "revenue")
    return res.json({
      // old
      users: usersTotal,
      orders: ordersTotal,
      pendingOrders: ordersActive,
      revenue: revenue30d,

      // new
      usersTotal,
      ordersTotal,
      ordersActive,
      ordersToday,
      revenue30d,
      seriesRevenue7d,
      seriesOrders7d,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /admin/users?q=
 */
router.get("/users", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = q ? { email: { $regex: q, $options: "i" } } : {};

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .select("email role balance createdAt");

    return res.json(users);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /admin/users/:id/adjust-balance
 * body: { amount }
 */
router.post("/users/:id/adjust-balance", async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount);

    if (!Number.isFinite(amount) || amount === 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const user = await User.findById(req.params.id).select("_id balance email");
    if (!user) return res.status(404).json({ message: "User not found" });

    if (amount < 0 && user.balance + amount < 0) {
      return res.status(400).json({ message: "Balance cannot go below 0" });
    }

    await User.updateOne({ _id: user._id }, { $inc: { balance: amount } });

    await Transaction.create({
      userId: user._id,
      type: "adjustment",
      status: "confirmed",
      amount: round2(Math.abs(amount)),
      currency: "EUR",
      provider: "paypal", // dev workaround
      meta: {
        direction: amount > 0 ? "credit" : "debit",
        adminId: String(req.user.id),
        note: "admin_adjustment",
      },
    });

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /admin/orders?q=
 */
router.get("/orders", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();

    let userIds = [];
    if (q.includes("@")) {
      const users = await User.find({ email: { $regex: q, $options: "i" } }).select("_id");
      userIds = users.map((u) => u._id);
    }

    const isMongoId = /^[0-9a-fA-F]{24}$/.test(q);

    const filter = q
      ? {
          $or: [
            ...(isMongoId ? [{ _id: q }] : []),
            { providerOrderId: { $regex: q, $options: "i" } },
            ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
          ],
        }
      : {};

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("serviceId", "name")
      .populate("userId", "email");

    const out = orders.map((o) => ({
      _id: o._id,
      status: o.status,
      price: o.price,
      currency: "EUR",
      providerOrderId: o.providerOrderId || "",
      serviceName: o.serviceId?.name || "",
      userEmail: o.userId?.email || "",
      userId: o.userId?._id || o.userId,
      createdAt: o.createdAt,
    }));

    return res.json(out);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /admin/orders/:id/refund
 */
router.post("/orders/:id/refund", async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const existing = await Transaction.findOne({
      type: "refund",
      "meta.orderId": String(order._id),
      status: "confirmed",
    }).select("_id");

    if (existing) return res.json({ ok: true, already: true });

    const amount = round2(order.price || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid order price" });
    }

    await User.updateOne({ _id: order.userId }, { $inc: { balance: amount } });

    await Transaction.create({
      userId: order.userId,
      type: "refund",
      status: "confirmed",
      amount,
      currency: "EUR",
      provider: "paypal",
      meta: {
        orderId: String(order._id),
        adminId: String(req.user.id),
        note: "admin_refund",
      },
    });

    if (order.status !== "canceled" && order.status !== "failed") {
      order.status = "canceled";
      await order.save();
    }

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /admin/transactions
 */
router.get("/transactions", async (req, res, next) => {
  try {
    const txs = await Transaction.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("userId", "email");

    const out = txs.map((t) => ({
      _id: t._id,
      userId: t.userId?._id || t.userId,
      userEmail: t.userId?.email || "",
      type: t.type,
      status: t.status,
      amount: t.amount,
      currency: t.currency,
      provider: t.provider,
      providerOrderId: t.providerOrderId || "",
      createdAt: t.createdAt,
    }));

    return res.json(out);
  } catch (e) {
    next(e);
  }
});

export default router;
