// server/src/routes/orders.routes.js
import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middlewares/auth.js";

import { Service } from "../models/Service.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";

import { providerCreateOrder } from "../services/provider/providerApi.js";

const router = Router();

// ✅ DEV option: if true, order is created + charged, provider call skipped when no externalServiceId
const DEV_BYPASS_PROVIDER = false;

// ✅ if true, return provider raw error payload to frontend (DEV ONLY)
const EXPOSE_PROVIDER_DEBUG = true;

// =====================
// utils
// =====================
function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

function pickServiceEnabled(service) {
  if (!service) return false;
  if (typeof service.enabled === "boolean") return service.enabled;
  if (typeof service.active === "boolean") return service.active;
  return true;
}

function getProviderServiceId(service) {
  // canonical: externalServiceId; allow old providerServiceId
  const v = service?.externalServiceId ?? service?.providerServiceId ?? null;
  return v ? String(v) : null;
}

function safeJson(x) {
  try {
    if (x == null) return null;
    if (typeof x === "string") return x;
    return JSON.parse(JSON.stringify(x));
  } catch {
    try {
      return String(x);
    } catch {
      return null;
    }
  }
}

function sanitizeProviderPayload(payload) {
  const p = safeJson(payload);
  if (!p || typeof p !== "object") return p;

  const clone = Array.isArray(p) ? [...p] : { ...p };

  const STRIP_KEYS = new Set([
    "key",
    "apiKey",
    "apikey",
    "access_token",
    "accessToken",
    "token",
    "authorization",
    "Authorization",
    "secret",
    "password",
    "client_secret",
    "clientSecret",
  ]);

  const walk = (obj) => {
    if (!obj || typeof obj !== "object") return;
    for (const k of Object.keys(obj)) {
      if (STRIP_KEYS.has(k)) {
        obj[k] = "[REDACTED]";
        continue;
      }
      const v = obj[k];
      if (v && typeof v === "object") walk(v);
    }
  };

  walk(clone);
  return clone;
}

function extractProviderDetails(err) {
  const message = String(err?.message || "provider_failed");
  const code = err?.code || null;

  const raw =
    err?.providerPayload ??
    err?.response?.data ??
    err?.raw ??
    null;

  const payload = sanitizeProviderPayload(raw);
  return { message, code, payload };
}

// =====================
// routes
// =====================

/**
 * GET /orders
 * returns user's orders
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
 * body: { serviceId, link, quantity, clientRequestId? }
 *
 * Flow (NO Mongo transactions):
 * 0) (Optional) idempotency by clientRequestId -> if already exists, return existing order
 * 1) Validate + calc price
 * 2) Atomic deduct balance (findOneAndUpdate with $gte)
 * 3) Create order + debit transaction
 * 4) Provider call
 * 5) If provider fails: mark failed + refund + refund transaction
 */
router.post("/", requireAuth, async (req, res, next) => {
  const serviceId = req.body.serviceId || req.body.service || req.body.service_id || "";
  const linkRaw = req.body.link ?? req.body.url ?? "";
  const quantityRaw = req.body.quantity ?? req.body.qty ?? req.body.amount ?? 0;
  const clientRequestId = String(req.body.clientRequestId || "").trim();

  // --- validations ---
  if (!serviceId || !mongoose.isValidObjectId(serviceId)) {
    return res.status(400).json({ message: "Invalid serviceId" });
  }

  if (!linkRaw || typeof linkRaw !== "string" || linkRaw.trim().length < 6) {
    return res.status(400).json({ message: "Invalid link" });
  }

  const cleanLink = linkRaw.trim();
  if (!isValidUrl(cleanLink)) {
    return res.status(400).json({ message: "Link must be a valid URL (http/https)" });
  }

  const qty = Number(quantityRaw);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ message: "Invalid quantity" });
  }

  // ✅ Idempotency (prevents double charge if user clicks twice / retries)
  // If clientRequestId exists, we return existing order for same user+clientRequestId
  if (clientRequestId) {
    const existing = await Order.findOne({ userId: req.user.id, clientRequestId })
      .populate("serviceId")
      .sort({ createdAt: -1 });

    if (existing) {
      return res.status(200).json({
        order: existing,
        idempotent: true,
      });
    }
  }

  let createdOrderId = null;
  let price = 0;
  let serviceSnapshot = null;

  // --- 1) service + price + deduct balance ---
  try {
    const service = await Service.findById(serviceId);
    if (!service || !pickServiceEnabled(service)) {
      return res.status(404).json({ message: "Service not found" });
    }

    const min = Number(service.min ?? 0);
    const max = Number(service.max ?? 0);

    if (Number.isFinite(min) && min > 0 && qty < min) {
      return res.status(400).json({ message: `Quantity must be between ${min} and ${max || "-"}` });
    }
    if (Number.isFinite(max) && max > 0 && qty > max) {
      return res.status(400).json({ message: `Quantity must be between ${min || "-"} and ${max}` });
    }

    const rate = Number(service.pricePer1000 ?? 0);
    if (!Number.isFinite(rate) || rate <= 0) {
      return res.status(500).json({ message: "Service pricing misconfigured (pricePer1000 missing)" });
    }

    price = round2((qty / 1000) * rate);

    // minimal anti-abuse (optional)
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(500).json({ message: "Price calculation failed" });
    }

    // store snapshot for debugging
    serviceSnapshot = {
      _id: String(service._id),
      name: service.name,
      pricePer1000: Number(service.pricePer1000 || 0),
      min: service.min ?? null,
      max: service.max ?? null,
      externalServiceId: service.externalServiceId ?? null,
      providerServiceId: service.providerServiceId ?? null,
      provider: service.provider ?? null,
    };

    // ✅ atomic balance deduct
    const userAfter = await User.findOneAndUpdate(
      { _id: req.user.id, balance: { $gte: price } },
      { $inc: { balance: -price } },
      { new: true }
    );

    if (!userAfter) {
      const u = await User.findById(req.user.id).select("balance");
      return res.status(402).json({
        message: "Insufficient balance",
        balance: Number(u?.balance || 0),
        required: price,
      });
    }

    const order = await Order.create({
      userId: userAfter._id,
      serviceId: service._id,
      link: cleanLink,
      quantity: Math.round(qty), // providers usually expect int
      price,
      status: "pending",
      providerOrderId: null,
      ...(clientRequestId ? { clientRequestId } : {}),
    });

    createdOrderId = order._id.toString();

    await Transaction.create({
      userId: userAfter._id,
      type: "order_debit",
      amount: -price,
      status: "confirmed",
      balanceBefore: null,
      balanceAfter: Number(userAfter.balance || 0),
      provider: "wallet",
      meta: {
        orderId: createdOrderId,
        serviceId: String(service._id),
        ...(clientRequestId ? { clientRequestId } : {}),
      },
    });
  } catch (e) {
    return next(e);
  }

  // --- 2) provider call ---
  try {
    const order = await Order.findById(createdOrderId).populate("serviceId");
    if (!order) return res.status(404).json({ message: "Order not found after create" });

    const service = order.serviceId;
    if (!service) return res.status(404).json({ message: "Service not found after create" });

    const providerServiceId = getProviderServiceId(service);

    // ✅ IMPORTANT: do not keep charged order pending if provider not connected
    if (!providerServiceId) {
      if (DEV_BYPASS_PROVIDER) {
        order.status = "processing";
        order.providerOrderId = "DEV_NO_PROVIDER";
        await order.save();
        return res.status(201).json({ order, dev: true });
      }

      // trigger refund path like provider failure (consistent)
      const err = new Error("Service not connected to provider (missing externalServiceId/providerServiceId)");
      err.code = "MISSING_PROVIDER_SERVICE_ID";
      err.providerPayload = { serviceSnapshot };
      throw err;
    }

    // Debug server log so we SEE what id is being used
    console.log("[ORDER] providerServiceId =", providerServiceId, "service._id =", String(service._id));

    const out = await providerCreateOrder({
      // providerApi.js now accepts externalServiceId/providerServiceId,
      // but we pass canonical here:
      externalServiceId: providerServiceId,
      link: order.link,
      quantity: order.quantity,
      meta: {
        reference: order._id.toString(),
        ...(clientRequestId ? { clientRequestId } : {}),
      },
    });

    const providerOrderId = out?.providerOrderId ?? out?.order ?? out?.order_id ?? out?.id ?? null;

    if (!providerOrderId) {
      const err = new Error("Provider did not return order id");
      err.code = "PROVIDER_NO_ORDER_ID";
      err.providerPayload = out;
      throw err;
    }

    order.providerOrderId = String(providerOrderId);
    order.status = "processing";
    await order.save();

    return res.status(201).json({ order });
  } catch (providerErr) {
    const details = extractProviderDetails(providerErr);

    // 👇 full debug in server logs
    console.error("PROVIDER_FAIL:", {
      orderId: createdOrderId,
      message: details.message,
      code: details.code,
      payload: details.payload,
      serviceSnapshot,
    });

    // --- 3) mark failed + refund ---
    try {
      const order = await Order.findById(createdOrderId);
      if (order && order.status !== "failed") {
        order.status = "failed";
        await order.save();
      }

      // ✅ refund balance
      const user = await User.findById(req.user.id);
      if (user) {
        user.balance = round2(Number(user.balance || 0) + price);
        await user.save();

        await Transaction.create({
          userId: user._id,
          type: "refund",
          amount: price,
          status: "confirmed",
          balanceBefore: null,
          balanceAfter: Number(user.balance || 0),
          provider: "wallet",
          meta: {
            orderId: createdOrderId,
            reason: details.message,
            providerCode: details.code,
            providerPayload: EXPOSE_PROVIDER_DEBUG ? details.payload : null,
            serviceSnapshot,
          },
        });
      }
    } catch (refundErr) {
      console.error("REFUND_FAILED:", refundErr);
    }

    return res.status(502).json({
      message: "Provider failed, order canceled & refunded",
      error: details.message,
      code: details.code,
      providerPayload: EXPOSE_PROVIDER_DEBUG ? details.payload : undefined,
    });
  }
});

export default router;
