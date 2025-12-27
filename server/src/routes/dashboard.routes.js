import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middlewares/auth.js";

import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import { Transaction } from "../models/Transaction.js";
import { Service } from "../models/Service.js";

const router = Router();

/* =========================
   Helpers
========================= */
function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}
function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}
function isoDayUTC(d) {
  const x = new Date(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function makeLabels7dUTC(now = new Date()) {
  const labels = [];
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 6);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    labels.push(isoDayUTC(d));
  }
  return { labels, from7d: start };
}
function toPositiveMoney(amountSum) {
  return Math.abs(safeNum(amountSum, 0));
}
function normProvider(t) {
  const p1 = String(t?.provider || "").trim().toLowerCase();
  const p2 = String(t?.meta?.provider || "").trim().toLowerCase();
  return p1 || p2 || "unknown";
}
function normalizeStatusKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_"); // "in progress" / "in-progress" => "in_progress"
}
function toObjectIdMaybe(id) {
  try {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    const s = String(id);
    if (mongoose.Types.ObjectId.isValid(s)) return new mongoose.Types.ObjectId(s);
    return null;
  } catch {
    return null;
  }
}

// transaction type normalization
const TOPUP_TYPES = new Set([
  "topup",
  "topup_credit",
  "paypal_topup",
  "paypal_credit",
  "crypto_topup",
  "crypto_credit",
  "revolut_topup",
  "revolut_credit",
]);

const ORDER_DEBIT_TYPES = new Set(["order", "order_debit"]);

/* =========================
   GET /api/dashboard
========================= */
router.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const userIdStr = String(req.user?.id || "");
    const userIdObj = toObjectIdMaybe(userIdStr);

    // 🔥 critical: match BOTH string + ObjectId (legacy safe)
    const userMatch =
      userIdObj
        ? { $or: [{ userId: userIdObj }, { userId: userIdStr }] }
        : { userId: userIdStr };

    const now = new Date();
    const from30d = new Date(now);
    from30d.setDate(from30d.getDate() - 30);

    const { labels, from7d } = makeLabels7dUTC(now);

    // USER
    const user = userIdObj
      ? await User.findById(userIdObj).select("balance currency email").lean()
      : await User.findOne({ _id: userIdStr }).select("balance currency email").lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    const currency = String(user.currency || "EUR").toUpperCase();

    // =========================
    // ORDERS: status breakdown (LIVE) - robust (string + ObjectId safe)
    // =========================
    const ordersStatusAgg = await Order.aggregate([
      { $match: userMatch },
      {
        $project: {
          statusNorm: {
            $toLower: {
              $ifNull: ["$status", "unknown"],
            },
          },
        },
      },
      { $group: { _id: "$statusNorm", c: { $sum: 1 } } },
    ]);

    const oMap = new Map();
    for (const x of ordersStatusAgg || []) {
      const key = normalizeStatusKey(x?._id);
      oMap.set(key, (oMap.get(key) || 0) + safeNum(x?.c, 0));
    }

    const pendingOrders =
      (oMap.get("pending") || 0) +
      (oMap.get("queued") || 0) +
      (oMap.get("queue") || 0) +
      (oMap.get("waiting") || 0);

    const processingOrders =
      (oMap.get("processing") || 0) +
      (oMap.get("inprogress") || 0) +
      (oMap.get("in_progress") || 0) +
      (oMap.get("active") || 0) +
      (oMap.get("progress") || 0);

    const completedOrders = (oMap.get("completed") || 0) + (oMap.get("success") || 0);

    const failedOrders =
      (oMap.get("failed") || 0) +
      (oMap.get("canceled") || 0) +
      (oMap.get("cancelled") || 0) +
      (oMap.get("refunded") || 0) +
      (oMap.get("error") || 0);

    const activeOrders = pendingOrders + processingOrders;

    // =========================
    // SPEND: 30d + all-time (confirmed order debits)
    // =========================
    const spendAgg = await Transaction.aggregate([
      {
        $match: {
          ...userMatch,
          status: "confirmed",
          type: { $in: Array.from(ORDER_DEBIT_TYPES) },
        },
      },
      {
        $group: {
          _id: null,
          all: { $sum: "$amount" },
          d30: {
            $sum: {
              $cond: [{ $gte: ["$createdAt", from30d] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const spentAllTime = toPositiveMoney(spendAgg?.[0]?.all);
    const spent30d = toPositiveMoney(spendAgg?.[0]?.d30);

    // =========================
    // LAST TOPUPS (12)
    // =========================
    const lastTopupsRaw = await Transaction.find({
      ...userMatch,
      type: { $in: Array.from(TOPUP_TYPES) },
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .select(
        "_id amount currency status provider createdAt confirmedAt providerOrderId providerCaptureId providerEventId meta"
      )
      .lean();

    const lastTopups = (lastTopupsRaw || [])
      .map((t) => {
        const provider = normProvider(t);
        return {
          id: String(t._id),
          amount: round2(t.amount),
          currency: String(t.currency || currency).toUpperCase(),
          status: t.status || "pending",
          provider,
          createdAt: t.createdAt,
          confirmedAt: t.confirmedAt || null,
          providerOrderId: t.providerOrderId || "",
          providerCaptureId: t.providerCaptureId || "",
          providerEventId: t.providerEventId || "",
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // =========================
    // LAST ORDERS (12)
    // =========================
    const lastOrdersRaw = await Order.find(userMatch)
      .sort({ createdAt: -1 })
      .limit(12)
      .select("serviceId status quantity createdAt price link providerOrderId")
      .lean();

    const serviceIds = (lastOrdersRaw || []).map((o) => o.serviceId).filter(Boolean);
    const services = serviceIds.length
      ? await Service.find({ _id: { $in: serviceIds } }).select("name").lean()
      : [];

    const serviceMap = new Map((services || []).map((s) => [String(s._id), s.name]));

    const lastOrders = (lastOrdersRaw || []).map((o) => {
      const sName =
        (o.serviceId ? serviceMap.get(String(o.serviceId)) : null) ||
        "Service";

      return {
        id: String(o._id),
        status: o.status || "pending",
        quantity: safeNum(o.quantity, 0),
        total: round2(o.price ?? 0),
        currency,
        serviceName: sName,
        link: o.link || "",
        createdAt: o.createdAt,
        providerOrderId: o.providerOrderId || "",
      };
    });

    // =========================
    // SERIES 7d: Orders by createdAt
    // =========================
    const orders7 = await Order.aggregate([
      { $match: { ...userMatch, createdAt: { $gte: from7d } } },
      {
        $group: {
          _id: {
            day: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" },
            },
          },
          c: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]);

    const ordersDayMap = new Map((orders7 || []).map((x) => [x._id.day, safeNum(x.c, 0)]));
    const seriesOrders = labels.map((lab) => safeNum(ordersDayMap.get(lab), 0));

    // =========================
    // Topups 7d (confirmedAt preferred)
    // =========================
    const topups7 = await Transaction.aggregate([
      { $match: { ...userMatch, type: { $in: Array.from(TOPUP_TYPES) } } },
      {
        $addFields: {
          statusNorm: { $toLower: { $ifNull: ["$status", "pending"] } },
          effectiveDate: { $ifNull: ["$confirmedAt", "$createdAt"] },
        },
      },
      { $match: { effectiveDate: { $gte: from7d } } },
      {
        $group: {
          _id: {
            day: {
              $dateToString: { format: "%Y-%m-%d", date: "$effectiveDate", timezone: "UTC" },
            },
          },
          confirmed: {
            $sum: { $cond: [{ $eq: ["$statusNorm", "confirmed"] }, "$amount", 0] },
          },
          pending: {
            $sum: {
              $cond: [{ $in: ["$statusNorm", ["pending", "created", "processing"]] }, "$amount", 0],
            },
          },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]);

    const topupsDayMap = new Map(
      (topups7 || []).map((x) => [
        x._id.day,
        { confirmed: round2(safeNum(x.confirmed, 0)), pending: round2(safeNum(x.pending, 0)) },
      ])
    );

    const seriesTopupsConfirmed = labels.map((lab) =>
      round2(safeNum(topupsDayMap.get(lab)?.confirmed, 0))
    );
    const seriesTopupsPending = labels.map((lab) =>
      round2(safeNum(topupsDayMap.get(lab)?.pending, 0))
    );

    const topups7dTotalConfirmed = round2(seriesTopupsConfirmed.reduce((a, b) => a + safeNum(b, 0), 0));
    const topups7dTotalPending = round2(seriesTopupsPending.reduce((a, b) => a + safeNum(b, 0), 0));
    const topups7dTotalAll = round2(topups7dTotalConfirmed + topups7dTotalPending);

    // =========================
    // QUALITY (7d): uses completedAt if exists
    // =========================
    let successRate7d = null;
    let avgFulfillMins7d = null;

    const perfAgg = await Order.aggregate([
      { $match: { ...userMatch, createdAt: { $gte: from7d } } },
      {
        $project: {
          statusKey: { $toLower: { $ifNull: ["$status", "unknown"] } },
          createdAt: 1,
          completedAt: 1,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          ok: { $sum: { $cond: [{ $in: ["$statusKey", ["completed", "success"]] }, 1, 0] } },
          fulfillMinsSum: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$statusKey", ["completed", "success"]] },
                    { $ne: ["$completedAt", null] },
                  ],
                },
                { $divide: [{ $subtract: ["$completedAt", "$createdAt"] }, 1000 * 60] },
                0,
              ],
            },
          },
          fulfillMinsCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$statusKey", ["completed", "success"]] },
                    { $ne: ["$completedAt", null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const perf = perfAgg?.[0];
    if (perf && safeNum(perf.total, 0) > 0) {
      successRate7d = Math.round((safeNum(perf.ok, 0) / safeNum(perf.total, 1)) * 1000) / 10;
    }
    if (perf && safeNum(perf.fulfillMinsCount, 0) > 0) {
      avgFulfillMins7d =
        Math.round((safeNum(perf.fulfillMinsSum, 0) / safeNum(perf.fulfillMinsCount, 1)) * 10) / 10;
    }

    return res.json({
      balance: round2(user.balance || 0),
      currency,

      activeOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      failedOrders,

      spent30d: round2(spent30d),
      spentAllTime: round2(spentAllTime),

      successRate7d,
      avgFulfillMins7d,

      lastTopups,
      lastOrders,

      series7d: {
        labels,
        orders: seriesOrders,
        topups: seriesTopupsConfirmed, // graf = real confirmed
      },

      pendingTopups7d: topups7dTotalPending,
      topups7dIncludingPending: topups7dTotalAll,

      debug: {
        userIdStr,
        userIdObj: userIdObj ? userIdObj.toString() : null,
        now: now.toISOString(),
        from7d: from7d.toISOString(),
        topups7dConfirmed: topups7dTotalConfirmed,
        topups7dPending: topups7dTotalPending,
        topups7dAll: topups7dTotalAll,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
