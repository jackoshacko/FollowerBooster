import fetch from "node-fetch";
import { Transaction } from "../../models/Transaction.js";
import { User } from "../../models/User.js";
import { WebhookEvent } from "../../models/WebhookEvent.js";

const MODE = process.env.PAYPAL_MODE || "sandbox";
const BASE =
  MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

/* =========================
   ENV + URL helpers
========================= */
function mustEnv() {
  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET");
  }
}

function stripSlash(u) {
  return String(u || "").replace(/\/+$/, "");
}

function getBackendBaseUrl() {
  const url =
    process.env.BACKEND_BASE_URL ||
    `http://localhost:${process.env.PORT || 5000}`;
  return stripSlash(url);
}

function getBackendPublicUrl() {
  const url =
    process.env.BACKEND_PUBLIC_URL ||
    process.env.NGROK_URL ||
    getBackendBaseUrl();
  return stripSlash(url);
}

async function getAccessToken() {
  mustEnv();
  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;

  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`PayPal token error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

/* =========================
   Helpers
========================= */
function toMoney(amount) {
  return Number(amount).toFixed(2);
}

function pickApproveUrl(links = []) {
  const approve = links.find((l) => l.rel === "approve");
  return approve?.href || "";
}

/**
 * Extractors:
 * - PAYMENT.CAPTURE.COMPLETED: resource.supplementary_data.related_ids.order_id (orderId)
 *                              resource.id (captureId)
 * - CHECKOUT.ORDER.*: resource.id (orderId)
 */
function extractIdsFromEvent(event) {
  const eventType = String(event?.event_type || "");
  const resource = event?.resource || {};

  const orderIdFromRelated =
    resource?.supplementary_data?.related_ids?.order_id || "";

  const captureId = String(resource?.id || "");

  const orderIdFromCheckout =
    eventType.startsWith("CHECKOUT.ORDER") ? String(resource?.id || "") : "";

  const orderId = orderIdFromRelated || orderIdFromCheckout || "";

  return { orderId, captureId };
}

/* =========================
   (OPTIONAL) Webhook signature verify (LIVE)
========================= */
async function verifyWebhookSignature({ headers, event }) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID || "";
  if (!webhookId) throw new Error("Missing PAYPAL_WEBHOOK_ID for webhook verify");

  const access = await getAccessToken();

  const transmissionId = headers["paypal-transmission-id"];
  const transmissionTime = headers["paypal-transmission-time"];
  const certUrl = headers["paypal-cert-url"];
  const authAlgo = headers["paypal-auth-algo"];
  const transmissionSig = headers["paypal-transmission-sig"];

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    throw new Error("Missing PayPal signature headers");
  }

  const body = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId,
    webhook_event: event,
  };

  const res = await fetch(`${BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`PayPal verify error: ${res.status} ${JSON.stringify(data)}`);
  }

  return data?.verification_status === "SUCCESS";
}

/* =========================
   CORE: creditTxOnce (idempotent)
   - ONLY place where balance is credited
========================= */
async function creditTxOnce({
  tx,
  eventId = "",
  eventType = "",
  captureId = "",
  paypalPayload = null,
}) {
  if (!tx) throw new Error("creditTxOnce: tx missing");

  // if already confirmed => no double credit
  if (tx.status === "confirmed") {
    return { ok: true, already: true };
  }

  // atomic confirm (samo jednom)
  const updated = await Transaction.updateOne(
    { _id: tx._id, status: { $ne: "confirmed" } },
    {
      $set: {
        status: "confirmed",
        confirmedAt: new Date(),
        ...(eventId ? { providerEventId: eventId } : {}),
        ...(captureId ? { providerCaptureId: captureId } : {}),
        meta: {
          ...(tx.meta || {}),
          ...(eventType ? { webhookEventType: eventType } : {}),
          ...(paypalPayload ? { paypal: paypalPayload } : {}),
        },
      },
    }
  );

  if (updated.modifiedCount === 0) {
    return { ok: true, already: true };
  }

  // credit wallet exactly once
  await User.updateOne({ _id: tx.userId }, { $inc: { balance: Number(tx.amount) } });

  return { ok: true, credited: true };
}

/* =========================
   PayPal API helpers (admin reconcile)
========================= */
async function getOrderDetails({ access, orderId }) {
  const res = await fetch(`${BASE}/v2/checkout/orders/${orderId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${access}` },
  });

  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}

  if (!res.ok) {
    return { ok: false, status: res.status, data };
  }

  return { ok: true, data };
}

function isOrderPaid(orderJson) {
  const status = String(orderJson?.status || "").toUpperCase();
  const cap = orderJson?.purchase_units?.[0]?.payments?.captures?.[0];
  const capStatus = String(cap?.status || "").toUpperCase();

  if (capStatus === "COMPLETED") return { paid: true, captureId: String(cap?.id || "") };
  if (status === "COMPLETED") return { paid: true, captureId: String(cap?.id || "") };
  return { paid: false, captureId: String(cap?.id || "") };
}

/* =========================
   1) Create checkout + pending tx
========================= */
export async function createCheckout({ userId, amount, currency, returnUrl, cancelUrl }) {
  const access = await getAccessToken();

  const BACKEND_PUBLIC = getBackendPublicUrl();
  const BACKEND_LOCAL = getBackendBaseUrl();

  // PayPal success usually calls return_url with ?token=ORDER_ID
  const finalReturnUrl =
    stripSlash(returnUrl) || `${BACKEND_PUBLIC}/payments/paypal/success`;
  const finalCancelUrl =
    stripSlash(cancelUrl) || `${BACKEND_PUBLIC}/payments/paypal/cancel`;

  const tx = await Transaction.create({
    userId,
    type: "topup",
    status: "pending",
    amount,
    currency,
    provider: "paypal",
  });

  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: String(tx._id),
          amount: { currency_code: currency, value: toMoney(amount) },
        },
      ],
      application_context: {
        user_action: "PAY_NOW",
        return_url: finalReturnUrl,
        cancel_url: finalCancelUrl,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`PayPal create order error: ${res.status} ${await res.text()}`);
  }

  const order = await res.json();
  tx.providerOrderId = order.id;
  await tx.save();

  const approveUrl = pickApproveUrl(order.links);
  if (!approveUrl) throw new Error("PayPal approve link missing");

  return {
    txId: String(tx._id),
    providerOrderId: order.id,
    approveUrl,
    debug: { BACKEND_LOCAL, BACKEND_PUBLIC, returnUrl: finalReturnUrl, cancelUrl: finalCancelUrl },
  };
}

/* =========================
   2) CAPTURE + CREDIT (success)
========================= */
export async function captureAndCredit({ orderId, eventId = "" }) {
  const access = await getAccessToken();

  const tx = await Transaction.findOne({
    provider: "paypal",
    providerOrderId: String(orderId),
    type: "topup",
  });

  if (!tx) throw new Error(`Transaction not found for orderId ${orderId}`);

  if (tx.status === "confirmed") return { ok: true, already: true };

  // IMPORTANT: if tx is expired but PayPal is paid, we still can reconcile safely
  // but we do NOT auto-credit if you previously credited somewhere else.
  // Here we only credit through creditTxOnce, so it's safe.
  const cap = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (!cap.ok) {
    throw new Error(`PayPal capture error: ${cap.status} ${await cap.text()}`);
  }

  const capData = await cap.json();

  const capture = capData?.purchase_units?.[0]?.payments?.captures?.[0];
  const captureStatus = String(capture?.status || "");
  const captureId = String(capture?.id || "");

  if (captureStatus !== "COMPLETED") {
    throw new Error(`PayPal capture not completed. captureStatus=${captureStatus}`);
  }

  const out = await creditTxOnce({
    tx,
    eventId,
    eventType: "CAPTURE",
    captureId,
    paypalPayload: { capture: capData },
  });

  return { ...out, captureId };
}

/* =========================
   3) WEBHOOK handler (production-grade)
   - idempotent via WebhookEvent unique eventId
   - auto-capture when order approved (so you don't rely only on return_url)
========================= */
export async function handleWebhook({ event, headers }) {
  const eventType = String(event?.event_type || "").trim();
  const eventId = String(event?.id || "").trim();
  if (!eventId) return { ok: false, reason: "missing_event_id", eventType };

  // optional signature verify for LIVE:
  /*
  if (MODE === "live") {
    const ok = await verifyWebhookSignature({ headers, event });
    if (!ok) return { ok: false, reason: "invalid_signature", eventType, eventId };
  }
  */

  const { orderId, captureId } = extractIdsFromEvent(event);
  const resourceId = orderId || captureId || "";

  // store event once
  try {
    await WebhookEvent.create({
      provider: "paypal",
      eventId,
      eventType,
      resourceId,
      payload: event,
    });
  } catch (e) {
    if (e && (e.code === 11000 || String(e?.message || "").includes("E11000"))) {
      return { ok: true, ignored: true, reason: "duplicate_event", eventType, eventId };
    }
    throw e;
  }

  // 1) If order is approved -> try capture server-side (LIVE)
  if (eventType === "CHECKOUT.ORDER.APPROVED" && orderId) {
    try {
      const out = await captureAndCredit({ orderId, eventId });
      return { ok: true, via: "webhook_auto_capture", eventType, eventId, orderId, ...out };
    } catch (e) {
      return { ok: false, via: "webhook_auto_capture_failed", eventType, eventId, orderId, error: String(e?.message || e) };
    }
  }

  // 2) If capture completed -> confirm/credit by finding tx and idempotent credit
  if (eventType !== "PAYMENT.CAPTURE.COMPLETED") {
    return { ok: true, skipped: true, eventType, eventId };
  }

  let tx = null;
  if (orderId) {
    tx = await Transaction.findOne({ provider: "paypal", providerOrderId: orderId, type: "topup" });
  }
  if (!tx && captureId) {
    tx = await Transaction.findOne({ provider: "paypal", providerCaptureId: captureId, type: "topup" });
  }

  if (!tx) return { ok: true, ignored: true, reason: "tx_not_found", orderId, captureId, eventType, eventId };

  const out = await creditTxOnce({
    tx,
    eventId,
    eventType,
    captureId,
    paypalPayload: { webhook: { eventType, eventId, orderId, captureId } },
  });

  return { ok: true, via: "webhook_confirm", ...out, orderId, captureId, eventId };
}

/* =========================
   4) ADMIN RECONCILE
========================= */
export async function reconcileOne({ providerOrderId, dryRun = false }) {
  if (!providerOrderId) throw new Error("providerOrderId required");

  const tx = await Transaction.findOne({
    provider: "paypal",
    providerOrderId: String(providerOrderId),
    type: "topup",
  });

  if (!tx) return { ok: true, skipped: true, reason: "tx_not_found", providerOrderId };
  if (tx.status === "confirmed") return { ok: true, skipped: true, reason: "already_confirmed", providerOrderId };

  const access = await getAccessToken();
  const details = await getOrderDetails({ access, orderId: providerOrderId });

  if (!details.ok) {
    return { ok: true, skipped: true, reason: "paypal_lookup_failed", providerOrderId, paypalStatus: details.status };
  }

  const paidInfo = isOrderPaid(details.data);
  if (!paidInfo.paid) {
    return { ok: true, skipped: true, reason: "not_paid", providerOrderId, paypalOrderStatus: String(details.data?.status || "UNKNOWN") };
  }

  if (dryRun) {
    return { ok: true, wouldConfirm: true, providerOrderId, captureId: paidInfo.captureId || "" };
  }

  const out = await creditTxOnce({
    tx,
    captureId: paidInfo.captureId || "",
    paypalPayload: { reconcile: details.data },
  });

  return { ...out, providerOrderId, captureId: paidInfo.captureId || "" };
}

export async function reconcilePendingTopups({ limit = 50, olderThanMin = 5, dryRun = false } = {}) {
  const olderThanMs = Number(olderThanMin) * 60 * 1000;
  const cutoff = new Date(Date.now() - olderThanMs);

  const txs = await Transaction.find({
    provider: "paypal",
    type: "topup",
    status: "pending",
    providerOrderId: { $ne: null },
    createdAt: { $lte: cutoff },
  })
    .sort({ createdAt: -1 })
    .limit(Number(limit));

  const results = [];
  let checked = 0, confirmed = 0, wouldConfirm = 0, skipped = 0;

  for (const tx of txs) {
    checked++;
    const r = await reconcileOne({ providerOrderId: tx.providerOrderId, dryRun });
    results.push({ txId: String(tx._id), orderId: tx.providerOrderId, ...r });
    if (r.credited) confirmed++;
    else if (r.wouldConfirm) wouldConfirm++;
    else skipped++;
  }

  return { ok: true, mode: MODE, dryRun: !!dryRun, cutoff, summary: { checked, confirmed, wouldConfirm, skipped }, results };
}

/* =========================
   5) ADMIN WRAPPERS
========================= */
export async function adminGetPayPalOrderDetails({ orderId }) {
  if (!orderId) throw new Error("orderId required");
  const access = await getAccessToken();
  const details = await getOrderDetails({ access, orderId });

  if (!details.ok) {
    return { ok: false, orderId, paypalStatus: details.status, data: details.data };
  }

  const paidInfo = isOrderPaid(details.data);
  return {
    ok: true,
    orderId,
    paypalOrderStatus: String(details.data?.status || ""),
    paid: !!paidInfo.paid,
    captureId: paidInfo.captureId || "",
    data: details.data,
  };
}

export async function adminCaptureOrderSafe({ orderId }) {
  if (!orderId) throw new Error("orderId required");

  try {
    const out = await captureAndCredit({ orderId });
    return { ok: true, via: "capture", orderId, ...out };
  } catch (e) {
    const msg = String(e?.message || e);
    if (
      msg.includes("ORDER_ALREADY_CAPTURED") ||
      msg.includes("ORDER_COMPLETED") ||
      msg.toLowerCase().includes("already") ||
      msg.toLowerCase().includes("completed")
    ) {
      const r = await reconcileOne({ providerOrderId: orderId, dryRun: false });
      return { ok: true, via: "reconcile_fallback", orderId, ...r, note: msg };
    }
    throw e;
  }
}

export async function adminReconcilePayPalPending({ minutes = 24 * 60, limit = 50, dryRun = false } = {}) {
  const olderThanMin = 5;
  return await reconcilePendingTopups({ limit, olderThanMin, dryRun });
}
