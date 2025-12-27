// server/src/index.js
import "dotenv/config";
import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { startOrdersJob } from "./jobs/orders.job.js";
import { startTransactionsJob } from "./jobs/transactions.job.js"; // ✅ NOVO

const PORT = Number(process.env.PORT || 5000);

// Dozvoljeni origin-i (dev)
const corsOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:5173",
];

async function bootstrap() {
  await connectDb(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const app = createApp({ corsOrigins });

  app.listen(PORT, () => {
    console.log(`✅ API running on http://localhost:${PORT}`);

    // postojeći job (status sync)
    startOrdersJob({ intervalMs: 4000 });

    // ✅ NOVO: expire pending paypal topups (npr. stariji od 60min)
    startTransactionsJob({ intervalMs: 10 * 60 * 1000 }); // na 10 min
  });
}

bootstrap().catch((err) => {
  console.error("❌ Boot error:", err);
  process.exit(1);
});
