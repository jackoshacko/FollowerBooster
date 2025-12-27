// server/src/routes/webhooks.paypal.routes.js
import { Router } from "express";
import express from "express";
import { paymentsProviders } from "../services/payments/providers.js";

const router = Router();

/**
 * PAYPAL WEBHOOK (Full Ausstattung)
 *
 * MUST be mounted BEFORE express.json() in app.js:
 *   app.use("/webhooks", webhooksRoutes);
 *   app.use(express.json());
 *
 * Why raw?
 * - PayPal signature verification (LIVE) requires raw body.
 *
 * Production behavior:
 * - Always respond 200 to PayPal (unless body is totally invalid),
 *   because PayPal retries aggressively on non-2xx.
 * - We still log/store errors internally via WebhookEvent + your handler.
 */

// Helpers
function safeStr(x) {
  return String(x || "").trim();
}
function safeJsonParse(raw) {
  try {
    return { ok: true, json: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e };
  }
}
function pickReqId(req) {
  return (
    safeStr(req.headers["x-request-id"]) ||
    safeStr(req.headers["cf-ray"]) ||
    safeStr(req.headers["x-vercel-id"]) ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/**
 * POST /webhooks/paypal
 *
 * We accept any content-type but expect JSON payload.
 * Use raw parser so signature verify can be done in LIVE.
 */
router.post(
  "/paypal",
  express.raw({
    type: "*/*",
    limit: "2mb", // PayPal events are small; keep sane limit
  }),
  async (req, res) => {
    const reqId = pickReqId(req);

    const raw = req.body ? req.body.toString("utf8") : "";
    if (!raw) {
      // Respond 200 to avoid retries; nothing to do.
      return res.status(200).json({ ok: true, reqId, ignored: true, reason: "empty_body" });
    }

    const parsed = safeJsonParse(raw);
    if (!parsed.ok) {
      // Invalid JSON -> respond 200 (avoid retry storm), but mark as invalid
      console.log("PAYPAL WEBHOOK invalid JSON:", reqId, parsed.error?.message || parsed.error);
      return res.status(200).json({ ok: true, reqId, ignored: true, reason: "invalid_json" });
    }

    const event = parsed.json || {};
    const eventId = safeStr(event?.id);
    const eventType = safeStr(event?.event_type);

    try {
      const result = await paymentsProviders.paypal.handleWebhook({
        event,
        rawBody: raw,
        headers: req.headers,
      });

      // Always 200 to PayPal
      return res.status(200).json({
        ok: true,
        reqId,
        eventId,
        eventType,
        result,
      });
    } catch (e) {
      // IMPORTANT: still 200 to stop PayPal retries if our logic threw.
      // Your handleWebhook should already store failed status in WebhookEvent if you implement it.
      console.log("PAYPAL WEBHOOK handler error:", reqId, e?.message || e);

      return res.status(200).json({
        ok: true,
        reqId,
        eventId,
        eventType,
        error: "handler_failed",
      });
    }
  }
);

export default router;
