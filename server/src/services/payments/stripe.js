import Stripe from "stripe";

/* ================= HELPERS ================= */

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

function safeStr(x) {
  return String(x || "").trim();
}

/* ================= STRIPE CLIENT ================= */

function getStripe() {
  return new Stripe(mustEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2024-06-20",
  });
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

  const intent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency,
      automatic_payment_methods: { enabled: true },

      metadata: {
        userId: safeStr(userId),
        purpose: "wallet_topup",
      },
    },
    {
      // 🔒 idempotency – retry safe
      idempotencyKey: `stripe-topup-${userId}-${amountCents}-${reqId}`,
    }
  );

  return {
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

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("❌ Stripe signature verification failed");
    console.error(err.message);
    return res.status(400).send("Invalid Stripe signature");
  }

  /* ================= EVENTS ================= */

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;

    console.log("✅ STRIPE PAYMENT SUCCESS", {
      eventId: event.id,
      paymentIntentId: pi.id,
      userId: pi.metadata?.userId,
      amountCents: pi.amount,
      currency: pi.currency,
    });

    /**
     * ⏭ SLEDEĆI KORAK (ubacujemo posle):
     * - WebhookEvent.create({ provider:"stripe", eventId })
     * - Transaction.create(...)
     * - User.balance += amount
     */
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object;
    console.warn("⚠️ Stripe payment failed:", pi.id);
  }

  // Stripe mora dobiti 2xx da ne retry-a
  return res.status(200).json({ received: true });
}
