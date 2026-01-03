// server/src/routes/payments.stripe.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

/* ================= HELPERS ================= */

function safeStr(x) {
  return String(x ?? "").trim();
}

function asInt(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return NaN;
  return Math.trunc(n);
}

function safeLower(x) {
  return safeStr(x).toLowerCase();
}

function makeReqId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Money policy (minor units / cents)
 * Adjust as you want.
 */
const MIN_CENTS = 50;       // 0.50 EUR (ti si stavio 50)
const MAX_CENTS = 500000;   // 5000.00 EUR

// Only allow currencies you actually support in UI
const ALLOWED_CURRENCIES = new Set(["eur"]); // add later: "usd", "chf" if you want

/* =================================================
   POST /payments/stripe/create-intent
   body: { amountCents, currency?, reqId? }
================================================= */
router.post("/create-intent", requireAuth, async (req, res, next) => {
  try {
    const amountCents = asInt(req.body?.amountCents);
    const currency = safeLower(req.body?.currency || "eur");

    // idempotency token:
    // - prefer body.reqId (uuid from client) if present
    // - else use req.reqId from middleware
    // - else fallback
    const reqId =
      safeStr(req.body?.reqId) ||
      safeStr(req.reqId) ||
      makeReqId();

    // ===== VALIDATIONS =====
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Invalid amountCents (must be positive integer)",
      });
    }

    if (amountCents < MIN_CENTS) {
      return res.status(400).json({
        ok: false,
        message: `Invalid amountCents (min ${MIN_CENTS})`,
      });
    }

    if (amountCents > MAX_CENTS) {
      return res.status(400).json({
        ok: false,
        message: `Invalid amountCents (max ${MAX_CENTS})`,
      });
    }

    if (!ALLOWED_CURRENCIES.has(currency)) {
      return res.status(400).json({
        ok: false,
        message: `Unsupported currency: ${currency}`,
      });
    }

    // ===== CALL SERVICE =====
    const { createStripePaymentIntent } = await import(
      "../services/payments/stripe.js"
    );

    const result = await createStripePaymentIntent({
      userId: req.user.id,
      amountCents,
      currency, // "eur"
      reqId,
    });

    return res.json({
      ok: true,
      ...result,
      // handy echoes
      amountCents,
      currency,
      reqId,
    });
  } catch (err) {
    // If Stripe or DB throws, let global error handler format it
    next(err);
  }
});

/* =================================================
   OPTIONAL: GET /payments/stripe/config
   (useful for frontend: publishable key, min/max)
   ONLY if you want it — safe to keep.
================================================= */
router.get("/config", requireAuth, (req, res) => {
  // NOTE: publishable key is safe to expose to frontend if you use it.
  // If you don't have STRIPE_PUBLISHABLE_KEY, you can remove it.
  const publishableKey = safeStr(process.env.STRIPE_PUBLISHABLE_KEY);

  return res.json({
    ok: true,
    publishableKey: publishableKey || null,
    currency: "eur",
    minCents: MIN_CENTS,
    maxCents: MAX_CENTS,
  });
});

export default router;
