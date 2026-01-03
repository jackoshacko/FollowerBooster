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

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return NaN;
  return Math.round(x * 100) / 100;
}

function makeReqId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Money policy (minor units / cents)
 */
const MIN_CENTS = 50;       // 0.50 EUR
const MAX_CENTS = 500000;   // 5000.00 EUR

// Only allow currencies you actually support in UI
const ALLOWED_CURRENCIES = new Set(["eur"]); // add later: "usd", "chf" if you want

function getClientUrl() {
  // ti u app.js koristiš FRONTEND_URL, ali možeš i CLIENT_URL
  const a = safeStr(process.env.CLIENT_URL);
  const b = safeStr(process.env.FRONTEND_URL);
  return (a || b || "").replace(/\/$/, "");
}

/* =================================================
   POST /payments/stripe/checkout
   body: { amount (10.5) OR amountCents (1050), currency? }
   returns: { ok:true, url, sessionId }
================================================= */
router.post("/checkout", requireAuth, async (req, res, next) => {
  try {
    const currency = safeLower(req.body?.currency || "eur");
    if (!ALLOWED_CURRENCIES.has(currency)) {
      return res.status(400).json({ ok: false, message: `Unsupported currency: ${currency}` });
    }

    // accept either amountCents (int) or amount (float)
    let amountCents = asInt(req.body?.amountCents);

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      const amount = round2(req.body?.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          ok: false,
          message: "Invalid amount. Provide amount (e.g. 10.5) or amountCents (e.g. 1050).",
        });
      }
      amountCents = Math.round(amount * 100);
    }

    if (amountCents < MIN_CENTS) {
      return res.status(400).json({ ok: false, message: `Invalid amount (min ${MIN_CENTS} cents)` });
    }
    if (amountCents > MAX_CENTS) {
      return res.status(400).json({ ok: false, message: `Invalid amount (max ${MAX_CENTS} cents)` });
    }

    const clientUrl = getClientUrl();
    if (!clientUrl) {
      return res.status(500).json({
        ok: false,
        message: "Missing CLIENT_URL or FRONTEND_URL in env (needed for success/cancel redirect).",
      });
    }

    const reqId =
      safeStr(req.body?.reqId) ||
      safeStr(req.reqId) ||
      makeReqId();

    // ===== CALL SERVICE =====
    const { createStripeCheckoutSession } = await import("../services/payments/stripe.js");

    const session = await createStripeCheckoutSession({
      userId: req.user.id,
      amountCents,
      currency, // "eur"
      reqId,
      clientUrl,
    });

    // session should contain at least: { id, url }
    return res.json({
      ok: true,
      url: session?.url,
      sessionId: session?.id,
      amountCents,
      currency,
      reqId,
    });
  } catch (err) {
    next(err);
  }
});

/* =================================================
   OPTIONAL: GET /payments/stripe/session?session_id=...
   (useful if you want to verify status from frontend)
================================================= */
router.get("/session", requireAuth, async (req, res, next) => {
  try {
    const sessionId = safeStr(req.query?.session_id);
    if (!sessionId) return res.status(400).json({ ok: false, message: "Missing session_id" });

    const { getStripeCheckoutSession } = await import("../services/payments/stripe.js");
    const session = await getStripeCheckoutSession(sessionId);

    return res.json({ ok: true, session });
  } catch (err) {
    next(err);
  }
});

/* =================================================
   POST /payments/stripe/create-intent
   (KEEPING your existing endpoint so nothing breaks)
   body: { amountCents, currency?, reqId? }
================================================= */
router.post("/create-intent", requireAuth, async (req, res, next) => {
  try {
    const amountCents = asInt(req.body?.amountCents);
    const currency = safeLower(req.body?.currency || "eur");

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

    const { createStripePaymentIntent } = await import("../services/payments/stripe.js");

    const result = await createStripePaymentIntent({
      userId: req.user.id,
      amountCents,
      currency,
      reqId,
    });

    return res.json({
      ok: true,
      ...result,
      amountCents,
      currency,
      reqId,
    });
  } catch (err) {
    next(err);
  }
});

/* =================================================
   OPTIONAL: GET /payments/stripe/config
================================================= */
router.get("/config", requireAuth, (req, res) => {
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
