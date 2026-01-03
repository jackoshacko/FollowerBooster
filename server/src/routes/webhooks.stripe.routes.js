// server/src/routes/webhooks.stripe.routes.js
import { Router } from "express";
import express from "express";

const router = Router();

/**
 * Stripe webhook – MUST use RAW body
 * This router MUST be mounted BEFORE express.json() in app.js
 *
 * Endpoint (app.js):
 * app.use("/webhooks/stripe", stripeWebhooksRoutes);
 *
 * So final URL is:
 * POST /webhooks/stripe
 */

// Optional quick ping (debug)
router.get("/ping", (req, res) => {
  res.json({ ok: true, provider: "stripe", time: new Date().toISOString() });
});

router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      // ✅ IMPORTANT: in your project stripe is here:
      // server/src/services/payments/stripe.js
      const { handleStripeWebhook } = await import(
        "../services/payments/stripe.js"
      );

      await handleStripeWebhook(req, res);
    } catch (err) {
      console.error("❌ Stripe webhook error:", err?.stack || err);

      // Stripe will retry on non-2xx → ok for failures
      return res.status(400).send("Stripe webhook error");
    }
  }
);

export default router;
