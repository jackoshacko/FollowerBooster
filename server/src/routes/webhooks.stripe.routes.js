// server/src/routes/webhooks.stripe.routes.js
import { Router } from "express";
import express from "express";

const router = Router();

/**
 * STRIPE WEBHOOK ROUTER (Full ausgestattet + safe)
 *
 * ✅ MUST use RAW body for signature verification
 * ✅ MUST be mounted BEFORE express.json() in app.js
 *
 * app.js:
 *   app.use("/webhooks/stripe", stripeWebhooksRoutes);
 *
 * Final URL:
 *   POST /webhooks/stripe
 */

// -------------------------
// Helpers
// -------------------------
function safeStr(x) {
  return String(x || "").trim();
}

function isStripeJson(req) {
  const ct = safeStr(req.headers["content-type"]).toLowerCase();
  // Stripe sends: application/json (sometimes includes charset)
  return ct.startsWith("application/json");
}

function getSig(req) {
  return req.headers["stripe-signature"];
}

// -------------------------
// Debug ping
// -------------------------
router.get("/ping", (req, res) => {
  res.json({
    ok: true,
    provider: "stripe",
    time: new Date().toISOString(),
  });
});

// -------------------------
// Stripe webhook endpoint
// -------------------------
router.post(
  "/",
  // Raw body is REQUIRED. Put a sane limit to avoid abuse.
  express.raw({ type: "application/json", limit: "2mb" }),
  async (req, res) => {
    try {
      // 1) Basic guards (cheap checks before heavy logic)
      if (!isStripeJson(req)) {
        // Stripe expects 2xx? In practice Stripe sends JSON, but for safety:
        return res.status(415).send("Unsupported content-type");
      }

      const sig = getSig(req);
      if (!sig) {
        // Stripe will retry if non-2xx; this is correct for missing signature
        return res.status(400).send("Missing Stripe signature");
      }

      // 2) Import handler (keeps boot fast + avoids circular deps)
      // Your project file:
      // server/src/services/payments/stripe.js
      const { handleStripeWebhook } = await import("../services/payments/stripe.js");

      // 3) Delegate
      // IMPORTANT: handleStripeWebhook should send the final response itself
      // (or return an object and we send it here).
      await handleStripeWebhook(req, res);

      // If handler already responded, do nothing.
      if (res.headersSent) return;

      // Fallback safe response
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("❌ Stripe webhook route error:", err?.stack || err);

      // Stripe retries on non-2xx (good).
      // Keep body short.
      if (!res.headersSent) return res.status(400).send("Stripe webhook error");
    }
  }
);

export default router;
