import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function safeInt(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

/**
 * POST /payments/stripe/create-intent
 * body: { amountCents }
 */
router.post("/create-intent", requireAuth, async (req, res, next) => {
  try {
    const amountCents = safeInt(req.body?.amountCents);

    if (!amountCents || amountCents < 50) {
      return res.status(400).json({
        ok: false,
        message: "Invalid amountCents (min 50)",
      });
    }

    const { createStripePaymentIntent } = await import(
      "../services/payments/stripe.js"
    );

    const result = await createStripePaymentIntent({
      userId: req.user.id,
      amountCents,
      currency: "eur",
      reqId: req.reqId,
    });

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
