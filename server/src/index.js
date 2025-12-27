// server/src/index.js
import "dotenv/config";
import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { startOrdersJob } from "./jobs/orders.job.js";
import { startTransactionsJob } from "./jobs/transactions.job.js";

const PORT = Number(process.env.PORT || 5000);

/**
 * Parsira CORS_ORIGIN iz .env
 * Format:
 * CORS_ORIGIN=http://localhost:5173,http://localhost:3000,https://xxx.vercel.app
 */
function parseCorsOrigins() {
  const raw = (process.env.CORS_ORIGIN || "").trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function bootstrap() {
  // =========================
  // CONNECT DB
  // =========================
  await connectDb(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  // =========================
  // CORS ORIGINS
  // =========================
  const corsOrigins = parseCorsOrigins();

  console.log("🌍 Allowed CORS origins:");
  if (corsOrigins.length === 0) {
    console.log("  - (none from env, using pattern-based allow in app.js)");
  } else {
    corsOrigins.forEach((o) => console.log("  -", o));
  }

  // =========================
  // CREATE APP
  // =========================
  const app = createApp({ corsOrigins });

  // =========================
  // START SERVER
  // =========================
  app.listen(PORT, () => {
    console.log(`🚀 API running on http://localhost:${PORT}`);
    console.log(`🌐 Public URL: ${process.env.BACKEND_PUBLIC_URL || "not set"}`);

    // =========================
    // BACKGROUND JOBS
    // =========================

    // Provider / order status sync
    startOrdersJob({ intervalMs: 4000 });
    console.log("🔁 Orders sync job started (4s)");

    // Expire pending PayPal topups (npr. stariji od 60min)
    startTransactionsJob({ intervalMs: 10 * 60 * 1000 });
    console.log("⏳ Transactions cleanup job started (10min)");
  });
}

// =========================
// BOOT
// =========================
bootstrap().catch((err) => {
  console.error("❌ Boot error:");
  console.error(err);
  process.exit(1);
});
