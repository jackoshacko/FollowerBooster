import Stripe from "stripe";
import mongoose from "mongoose";
import { User } from "../../models/User.js";
import { Transaction } from "../../models/Transaction.js";
import { WebhookEvent } from "../../models/WebhookEvent.js";

/* ================= HELPERS ================= */

function mustEnv(name) {
  const v = String(process.env[name] || "").trim();
  if (!v) throw new Error(`${name} missing`);
  return v;
}

function safeStr(x) {
  return String(x ?? "").trim();
}

function safeLower(x) {
  return safeStr(x).toLowerCase();
}

function isObjectId(x) {
  return mongoose.Types.ObjectId.isValid(String(x || ""));
}

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

function asInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return NaN;
  return Math.trunc(x);
}

// Stripe uses minor units (cents)
function centsToMajor(amountCents) {
  const n = Number(amountCents || 0);
  return round2(n / 100);
}

function nowPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function getMode() {
  const nodeEnv = safeLower(process.env.NODE_ENV);
  return nodeEnv === "production" ? "live" : "sandbox";
}

function getClientUrlFallback() {
  // checkout needs redirect url
  const a = safeStr(process.env.CLIENT_URL);
  const b = safeStr(process.env.FRONTEND_URL);
  return (a || b || "").replace(/\/$/, "");
}

/* ================= STRIPE CLIENT ================= */

function getStripe() {
  return new Stripe(mustEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2024-06-20",
  });
}

/* =================================================
   ✅ NEW: CREATE CHECKOUT SESSION (TOPUP)
   POST /payments/stripe/checkout
   returns: { id, url }
================================================= */
export async function createStripeCheckoutSession({
  userId,
  amountCents,
  currency = "eur",
  reqId,
  clientUrl,
}) {
  const stripe = getStripe();

  const u = safeStr(userId);
  if (!isObjectId(u)) throw new Error("Invalid userId");

  const cents = asInt(amountCents);
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error("amountCents must be positive integer");
  }

  const cur = safeLower(currency) || "eur";
  const rid = safeStr(reqId) || String(Date.now());

  // policy
  const MIN = 50; // 0.50
  const MAX = 500000; // 5,000.00
  if (cents < MIN || cents > MAX) {
    throw new Error(`Topup out of range (${MIN}-${MAX} cents)`);
  }

  const baseUrl = (safeStr(clientUrl) || getClientUrlFallback()).replace(/\/$/, "");
  if (!baseUrl) throw new Error("CLIENT_URL/FRONTEND_URL missing (needed for checkout redirect)");

  // 1) pending tx (ledger)
  const pendingTx = await Transaction.create({
    userId: u,
    type: "topup",
    status: "pending",
    amount: centsToMajor(cents),
    currency: cur.toUpperCase(),
    provider: "stripe",
    meta: {
      purpose: "wallet_topup",
      amountCents: cents,
      reqId: rid,
      flow: "checkout",
    },
  });

  // 2) Stripe Checkout Session
  // IMPORTANT: put metadata on payment_intent_data so payment_intent.succeeded has it
  const idempotencyKey = `stripe-checkout-${u}-${cents}-${rid}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: cur,
            unit_amount: cents,
            product_data: {
              name: "Wallet Top-up",
              description: `Top-up ${centsToMajor(cents)} ${cur.toUpperCase()}`,
            },
          },
        },
      ],

      // redirect back to your frontend
      success_url: `${baseUrl}/wallet?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/wallet?stripe=cancel`,

      // attach metadata to the PaymentIntent created by Checkout
      payment_intent_data: {
        metadata: {
          userId: u,
          purpose: "wallet_topup",
          topupId: String(pendingTx._id),
          reqId: rid,
        },
      },

      // also store on session itself (handy for debugging)
      metadata: {
        userId: u,
        purpose: "wallet_topup",
        topupId: String(pendingTx._id),
        reqId: rid,
      },

      // get PI id immediately (useful)
      expand: ["payment_intent"],
    },
    { idempotencyKey }
  );

  // 3) save session / PI ids (if available)
  const piId = safeStr(session?.payment_intent?.id || session?.payment_intent || "");
  pendingTx.meta = {
    ...(pendingTx.meta || {}),
    checkoutSessionId: safeStr(session.id),
    checkoutUrl: safeStr(session.url),
    paymentIntentId: piId || "",
  };

  // keep providerOrderId consistent:
  // - for checkout we store session.id (and we also store paymentIntentId in meta)
  pendingTx.providerOrderId = safeStr(session.id);
  await pendingTx.save();

  return { id: session.id, url: session.url };
}

/* =================================================
   ✅ NEW: GET CHECKOUT SESSION
   GET /payments/stripe/session?session_id=...
================================================= */
export async function getStripeCheckoutSession(sessionId) {
  const stripe = getStripe();
  const sid = safeStr(sessionId);
  if (!sid) throw new Error("sessionId missing");

  const session = await stripe.checkout.sessions.retrieve(sid, {
    expand: ["payment_intent"],
  });

  // return a safe subset
  const pi = session?.payment_intent;
  return {
    id: safeStr(session?.id),
    status: safeStr(session?.status),
    payment_status: safeStr(session?.payment_status),
    amount_total: asInt(session?.amount_total ?? 0),
    currency: safeStr(session?.currency || ""),
    payment_intent: pi
      ? {
          id: safeStr(pi?.id || ""),
          status: safeStr(pi?.status || ""),
          amount_received: asInt(pi?.amount_received ?? 0),
          currency: safeStr(pi?.currency || ""),
          metadata: pi?.metadata || {},
        }
      : null,
    metadata: session?.metadata || {},
  };
}

/* =================================================
   CREATE PAYMENT INTENT (TOPUP)
   POST /payments/stripe/create-intent
================================================= */
export async function createStripePaymentIntent({
  userId,
  amountCents,
  currency = "eur",
  reqId,
}) {
  const stripe = getStripe();

  const u = safeStr(userId);
  if (!isObjectId(u)) throw new Error("Invalid userId");

  const cents = asInt(amountCents);
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error("amountCents must be positive integer");
  }

  const cur = safeLower(currency) || "eur";
  const rid = safeStr(reqId) || String(Date.now());

  // Optional policy limits
  const MIN = 100; // 1.00
  const MAX = 500000; // 5,000.00
  if (cents < MIN || cents > MAX) {
    throw new Error(`Topup out of range (${MIN}-${MAX} cents)`);
  }

  // Create pending tx (ledger)
  const pendingTx = await Transaction.create({
    userId: u,
    type: "topup",
    status: "pending",
    amount: centsToMajor(cents),
    currency: cur.toUpperCase(),
    provider: "stripe",
    meta: {
      purpose: "wallet_topup",
      amountCents: cents,
      reqId: rid,
      flow: "intent",
    },
  });

  // Stripe idempotency key: safe retry (same intent)
  const idempotencyKey = `stripe-topup-${u}-${cents}-${rid}`;

  const intent = await stripe.paymentIntents.create(
    {
      amount: cents,
      currency: cur,
      automatic_payment_methods: { enabled: true },

      metadata: {
        userId: u,
        purpose: "wallet_topup",
        topupId: String(pendingTx._id),
        reqId: rid,
      },
    },
    { idempotencyKey }
  );

  // Save PI id on pending tx
  pendingTx.providerOrderId = intent.id; // payment_intent id
  pendingTx.meta = {
    ...(pendingTx.meta || {}),
    paymentIntentId: intent.id,
  };
  await pendingTx.save();

  return {
    topupId: String(pendingTx._id),
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret,
  };
}

/* =================================================
   STRIPE WEBHOOK
   POST /webhooks/stripe
================================================= */

export async function handleStripeWebhook(req, res) {
  const stripe = getStripe();

  const signature = req.headers["stripe-signature"];
  const webhookSecret = mustEnv("STRIPE_WEBHOOK_SECRET");

  if (!signature) return res.status(400).send("Missing stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error("❌ Stripe signature verification failed:", err?.message || err);
    return res.status(400).send("Invalid Stripe signature");
  }

  const eventId = safeStr(event?.id);
  const eventType = safeStr(event?.type);
  const resourceId = safeStr(event?.data?.object?.id);

  // 1) store webhook event for audit + HARD idempotency
  try {
    await WebhookEvent.create({
      provider: "stripe",
      eventId,
      eventType,
      resourceId,
      mode: getMode(),
      status: "received",
      payload: event,
      headers: {
        "stripe-signature": safeStr(signature),
        "user-agent": safeStr(req.headers["user-agent"]),
        "content-type": safeStr(req.headers["content-type"]),
        "x-forwarded-for": safeStr(req.headers["x-forwarded-for"]),
        "x-real-ip": safeStr(req.headers["x-real-ip"]),
        host: safeStr(req.headers["host"]),
      },
      // expiresAt: nowPlusDays(30),
    });
  } catch (e) {
    if (String(e?.code) === "11000") {
      return res.status(200).json({ received: true, deduped: true });
    }
    console.error("❌ WebhookEvent store failed:", e?.message || e);
    return res.status(500).json({ received: false, message: "WebhookEvent store failed" });
  }

  // 2) process event
  try {
    // ---------------------------
    // payment_intent.succeeded
    // ---------------------------
    if (eventType === "payment_intent.succeeded") {
      const pi = event.data.object;

      const paymentIntentId = safeStr(pi?.id);
      const purpose = safeStr(pi?.metadata?.purpose);
      const userId = safeStr(pi?.metadata?.userId);
      const topupId = safeStr(pi?.metadata?.topupId);

      const amountCents = asInt(pi?.amount_received ?? pi?.amount ?? 0);
      const amountMajor = centsToMajor(amountCents);
      const currency = safeStr(pi?.currency || "eur").toUpperCase();

      if (purpose !== "wallet_topup") {
        await WebhookEvent.updateOne(
          { provider: "stripe", eventId },
          { $set: { status: "ignored", processedAt: new Date() } }
        );
        return res.status(200).json({ received: true, ignored: true });
      }

      if (!isObjectId(userId)) throw new Error("Missing/invalid metadata.userId");
      if (!paymentIntentId) throw new Error("Missing paymentIntentId");
      if (!Number.isFinite(amountMajor) || amountMajor <= 0) throw new Error("Invalid amount");

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const user = await User.findById(userId).session(session);
          if (!user) throw new Error("User not found");

          const balanceBefore = round2(user.balance);

          await Transaction.create(
            [
              {
                userId,
                type: "topup_credit",
                status: "confirmed",
                amount: amountMajor,
                currency,
                provider: "stripe",
                balanceBefore,
                balanceAfter: round2(balanceBefore + amountMajor),
                providerOrderId: paymentIntentId, // PI
                providerEventId: eventId, // Stripe event id
                confirmedAt: new Date(),
                meta: {
                  purpose,
                  topupId: topupId || "",
                  amountCents,
                },
              },
            ],
            { session }
          );

          user.balance = round2(balanceBefore + amountMajor);
          await user.save({ session });

          // mark pending tx confirmed (if exists)
          if (topupId && isObjectId(topupId)) {
            await Transaction.updateOne(
              { _id: topupId, userId, provider: "stripe" },
              {
                $set: {
                  status: "confirmed",
                  confirmedAt: new Date(),
                  // keep both
                  providerEventId: eventId,
                  "meta.paymentIntentId": paymentIntentId,
                },
              },
              { session }
            );
          } else {
            // fallback: match pending by paymentIntentId if it was stored
            await Transaction.updateOne(
              {
                userId,
                provider: "stripe",
                status: "pending",
                $or: [
                  { providerOrderId: paymentIntentId }, // intent flow
                  { "meta.paymentIntentId": paymentIntentId }, // checkout flow
                ],
              },
              { $set: { status: "confirmed", confirmedAt: new Date(), providerEventId: eventId } },
              { session }
            );
          }
        });
      } catch (err) {
        if (String(err?.code) === "11000") {
          await WebhookEvent.updateOne(
            { provider: "stripe", eventId },
            { $set: { status: "processed", processedAt: new Date() } }
          );
          return res.status(200).json({ received: true, deduped: true });
        }
        throw err;
      } finally {
        await session.endSession();
      }

      await WebhookEvent.updateOne(
        { provider: "stripe", eventId },
        { $set: { status: "processed", processedAt: new Date() } }
      );

      return res.status(200).json({ received: true });
    }

    // ---------------------------
    // payment_intent.payment_failed
    // ---------------------------
    if (eventType === "payment_intent.payment_failed") {
      const pi = event.data.object;
      const paymentIntentId = safeStr(pi?.id);

      await Transaction.updateOne(
        {
          provider: "stripe",
          status: "pending",
          $or: [
            { providerOrderId: paymentIntentId },
            { "meta.paymentIntentId": paymentIntentId },
          ],
        },
        { $set: { status: "failed" } }
      );

      await WebhookEvent.updateOne(
        { provider: "stripe", eventId },
        { $set: { status: "processed", processedAt: new Date() } }
      );

      return res.status(200).json({ received: true, failed: true });
    }

    // Other events: ignore but record processedAt
    await WebhookEvent.updateOne(
      { provider: "stripe", eventId },
      { $set: { status: "ignored", processedAt: new Date() } }
    );

    return res.status(200).json({ received: true, ignored: true });
  } catch (err) {
    console.error("🔥 Stripe webhook processing error:", err?.stack || err);

    await WebhookEvent.updateOne(
      { provider: "stripe", eventId },
      {
        $set: {
          status: "failed",
          processedAt: new Date(),
          error: { message: safeStr(err?.message), stack: safeStr(err?.stack) },
        },
      }
    );

    // In dev better 500 so Stripe retries
    return res.status(500).json({ received: false });
  }
}
