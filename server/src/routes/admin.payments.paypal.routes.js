// server/src/routes/admin.payments.paypal.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

import { Transaction } from "../models/Transaction.js";

import {
  adminReconcilePayPalPending,
  adminGetPayPalOrderDetails,
  adminCaptureOrderSafe,
} from "../services/payments/paypal.js";

const router = Router();

/**
 * GET /admin/payments/paypal/paypal/order/:orderId
 * - debug: povuci PayPal order detalje
 */
router.get("/paypal/order/:orderId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const out = await adminGetPayPalOrderDetails({ orderId });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /admin/payments/paypal/paypal/capture/:orderId
 * - admin "manual capture" (SAFE + idempotent)
 */
router.post("/paypal/capture/:orderId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const out = await adminCaptureOrderSafe({ orderId });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /admin/payments/paypal/paypal/reconcile
 * body: { minutes?: number, limit?: number }
 * - nađe pending paypal topups, proveri na PayPal,
 *   i ako je paid/captured -> potvrdi + kredituje wallet (idempotent)
 */
router.post("/paypal/reconcile", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const minutes = Number(req.body?.minutes ?? 24 * 60); // default: 24h
    const limit = Number(req.body?.limit ?? 50);

    const out = await adminReconcilePayPalPending({ minutes, limit });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /admin/payments/paypal/paypal/pending?minutes=1440&limit=50
 * - lista pending paypal topups iz DB (za admin UI)
 */
router.get("/paypal/pending", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const minutes = Number(req.query?.minutes ?? 24 * 60);
    const limit = Number(req.query?.limit ?? 50);

    const cutoff = new Date(Date.now() - minutes * 60 * 1000);

    const txs = await Transaction.find({
      provider: "paypal",
      type: "topup",
      status: "pending",
      createdAt: { $gte: cutoff },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("userId", "email");

    res.json({
      ok: true,
      cutoff,
      count: txs.length,
      items: txs.map((t) => ({
        id: String(t._id),
        userEmail: t.userId?.email || "",
        amount: t.amount,
        currency: t.currency,
        providerOrderId: t.providerOrderId || "",
        createdAt: t.createdAt,
        status: t.status,
      })),
    });
  } catch (e) {
    next(e);
  }
});

export default router;

