// server/src/services/payments/stripe.js
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
  // if you later set STRIPE_MODE=live/test you can use it here
  const nodeEnv = safeLower(process.env.NODE_ENV);
  return nodeEnv === "production" ? "live" : "sandbox";
}

/* ================= STRIPE CLIENT ================= */

function getStripe() {
  // IMPORTANT: Use official Stripe apiVersion supported by your stripe package
  // Your earlier "2024-06-20" might be ok, but if Stripe rejects it, update.
  return new Stripe(mustEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2024-06-20",
  });
}

/* =================================================
   CREATE PAYMENT INTENT (TOPUP)
   POST /payments/stripe/create-intent
================================================= */
/**
 * Creates:
 * 1) Pending Transaction (type="topup", status="pending")  -> ledger reservation / tracking
 * 2) Stripe PaymentIntent                                 -> actual payment
 * Webhook confirms + credits wallet (type="topup_credit")
 */
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
    },
  });

  // Stripe idempotency key: safe retry (same intent)
  const idempotencyKey = `stripe-topup-${u}-${cents}-${rid}`;

  const intent = await stripe.paymentIntents.create(
    {
      amount: cents,
      currency: cur,
      automatic_payment_methods: { enabled: true },

      // Important: metadata = how webhook knows user + topup tx
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
   MUST BE mounted with express.raw({type:"application/json"})
================================================= */

export async function handleStripeWebhook(req, res) {
  const stripe = getStripe();

  const signature = req.headers["stripe-signature"];
  const webhookSecret = mustEnv("STRIPE_WEBHOOK_SECRET");

  if (!signature) return res.status(400).send("Missing stripe-signature");

  let event;
  try {
    // req.body MUST be raw Buffer here
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
      payload: event, // you can store subset if you want smaller db
      headers: {
        "stripe-signature": safeStr(signature),
        "user-agent": safeStr(req.headers["user-agent"]),
        "content-type": safeStr(req.headers["content-type"]),
        "x-forwarded-for": safeStr(req.headers["x-forwarded-for"]),
        "x-real-ip": safeStr(req.headers["x-real-ip"]),
        host: safeStr(req.headers["host"]),
      },
      // optional: keep 30 days then ttl (if you enabled TTL index)
      // expiresAt: nowPlusDays(30),
    });
  } catch (e) {
    // duplicate event => already received/processed => ACK 200
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

      // amount_received is best
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

      // Atomic credit
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const user = await User.findById(userId).session(session);
          if (!user) throw new Error("User not found");

          const balanceBefore = round2(user.balance);

          // 🔒 Transaction idempotency:
          // - providerEventId unique (partial)
          // - providerOrderId unique (optional)
          // If webhook retries, this create throws E11000 -> OK.
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

          // update user balance
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
                  providerOrderId: paymentIntentId,
                  providerEventId: eventId,
                  "meta.paymentIntentId": paymentIntentId,
                },
              },
              { session }
            );
          } else {
            // fallback: match pending by providerOrderId if topupId missing
            await Transaction.updateOne(
              { userId, provider: "stripe", providerOrderId: paymentIntentId, status: "pending" },
              { $set: { status: "confirmed", confirmedAt: new Date(), providerEventId: eventId } },
              { session }
            );
          }
        });
      } catch (err) {
        // duplicate processing is OK
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
        { provider: "stripe", providerOrderId: paymentIntentId, status: "pending" },
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

    // IMPORTANT:
    // - If you return 500, Stripe will retry (can be useful).
    // - If you return 200, Stripe stops retry but you have failure logged.
    // I recommend 500 in early dev to force retries until bug fixed.
    return res.status(500).json({ received: false });
  }
}
