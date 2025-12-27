// server/src/routes/payments.paypal.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { paymentsProviders } from "../services/payments/providers.js";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const BACKEND_PUBLIC_URL =
  process.env.BACKEND_PUBLIC_URL ||
  process.env.NGROK_URL ||
  "http://localhost:5000";

// allow only these currencies for now
const ALLOWED_CURRENCIES = new Set(["EUR", "USD", "CHF"]);

// minimum/maximum topup (anti-abuse)
const MIN_TOPUP = Number(process.env.MIN_TOPUP || 1);     // 1
const MAX_TOPUP = Number(process.env.MAX_TOPUP || 500);   // 500

function isValidMoney(n) {
  return Number.isFinite(n) && n > 0;
}
function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}
function safeStr(x) {
  return String(x || "").trim();
}

function redirect(url) {
  // keep it simple & safe
  return url;
}

/**
 * =========================
 * POST /payments/paypal/create
 * body: { amount, currency }
 * auth: Bearer token
 *
 * Returns: { txId, orderId, approveUrl }
 * =========================
 */
router.post("/create", requireAuth, async (req, res, next) => {
  try {
    const amountRaw = Number(req.body?.amount);
    const currencyRaw = safeStr(req.body?.currency || "EUR").toUpperCase();

    if (!isValidMoney(amountRaw)) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const amount = round2(amountRaw);

    if (amount < MIN_TOPUP) {
      return res.status(400).json({ message: `Minimum topup is ${MIN_TOPUP}` });
    }
    if (amount > MAX_TOPUP) {
      return res.status(400).json({ message: `Maximum topup is ${MAX_TOPUP}` });
    }

    const currency = ALLOWED_CURRENCIES.has(currencyRaw) ? currencyRaw : "EUR";

    // IMPORTANT: PayPal must hit PUBLIC URL for success/cancel (ngrok in dev)
    const out = await paymentsProviders.paypal.createCheckout({
      userId: req.user.id,
      amount,
      currency,
      returnUrl: `${BACKEND_PUBLIC_URL}/payments/paypal/success`,
      cancelUrl: `${BACKEND_PUBLIC_URL}/payments/paypal/cancel`,
    });

    const orderId = out.orderId || out.providerOrderId;
    const approveUrl = out.approveUrl;

    if (!orderId || !approveUrl) {
      return res.status(500).json({ message: "PayPal create failed (missing orderId/approveUrl)" });
    }

    return res.json({
      txId: out.txId,
      orderId,
      approveUrl,
    });
  } catch (e) {
    console.log("PAYPAL CREATE ERROR:", e?.message || e);
    next(e);
  }
});

/**
 * =========================
 * POST /payments/paypal/capture
 * body: { orderId }
 * auth: Bearer token
 *
 * Frontend can call this after redirect (wallet page reads orderId)
 * =========================
 */
router.post("/capture", requireAuth, async (req, res, next) => {
  try {
    const orderId = safeStr(req.body?.orderId);
    if (!orderId) return res.status(400).json({ message: "Missing orderId" });

    // captureAndCredit MUST be idempotent and MUST map orderId -> tx -> userId internally
    // (do NOT require userId here; the tx already belongs to one user)
    const result = await paymentsProviders.paypal.captureAndCredit({ orderId });

    return res.json({ ok: true, result });
  } catch (e) {
    console.log("PAYPAL CAPTURE ERROR:", e?.message || e);
    next(e);
  }
});

/**
 * =========================
 * GET /payments/paypal/success?token=ORDER_ID&PayerID=...
 *
 * We try server-side capture+credit first (best UX).
 * If it fails (rare) we still redirect with orderId so frontend can POST /capture.
 *
 * NOTE:
 * - PayPal sends order id in `token` (most common)
 * - sometimes apps use `orderId` param too -> we support both
 * =========================
 */
router.get("/success", async (req, res) => {
  const orderId = safeStr(req.query?.token || req.query?.orderId);
  if (!orderId) {
    return res.redirect(redirect(`${FRONTEND_URL}/wallet?paypal=missing_order`));
  }

  let captured = false;
  let reason = "";

  // 1) attempt server-side capture (no auth needed if service maps orderId -> tx -> user)
  try {
    const out = await paymentsProviders.paypal.captureAndCredit({ orderId });
    captured = !!out?.credited || !!out?.already;
  } catch (e) {
    reason = String(e?.message || e);
    // don't block UX: fallback to frontend capture
    console.log("PAYPAL SUCCESS: server capture failed, fallback to frontend capture:", reason);
  }

  // Always redirect to wallet, include orderId.
  // Wallet page can do:
  // - if paypal=success and orderId exists -> call POST /payments/paypal/capture (auth)
  // This makes it bulletproof even if server-side capture failed.
  const qs = new URLSearchParams({
    paypal: captured ? "success" : "success",
    orderId,
    ...(captured ? {} : { fallback: "1" }),
  });

  return res.redirect(redirect(`${FRONTEND_URL}/wallet?${qs.toString()}`));
});

/**
 * =========================
 * GET /payments/paypal/cancel
 * =========================
 */
router.get("/cancel", (_req, res) => {
  return res.redirect(redirect(`${FRONTEND_URL}/wallet?paypal=cancel`));
});

export default router;
