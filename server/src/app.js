// server/src/app.js
import express from "express";
import cors from "cors";

// routes...
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import servicesRoutes from "./routes/services.routes.js";
import meRoutes from "./routes/me.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import ordersSyncRoutes from "./routes/orders.sync.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import paypalPaymentsRoutes from "./routes/payments.paypal.routes.js";
import paypalWebhooksRoutes from "./routes/webhooks.paypal.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import adminServicesRoutes from "./routes/admin.services.routes.js";
import adminBalanceRoutes from "./routes/admin.balance.routes.js";
import adminPaypalPaymentsRoutes from "./routes/admin.payments.paypal.routes.js";
import adminProviderRoutes from "./routes/admin.provider.routes.js";
import { notFound } from "./middlewares/notFound.js";

function isAllowedByPattern(origin) {
  try {
    const u = new URL(origin);
    const host = u.hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".vercel.app")) return true;
    if (host.endsWith(".ngrok-free.dev") || host.endsWith(".ngrok.io")) return true;
    return false;
  } catch {
    return false;
  }
}

export function createApp({ corsOrigins = [] } = {}) {
  const app = express();
  app.set("trust proxy", 1);

  const whitelist = Array.isArray(corsOrigins)
    ? corsOrigins.map((s) => String(s || "").trim()).filter(Boolean)
    : [];

  const envFrontend = String(process.env.FRONTEND_URL || "").trim();
  if (envFrontend && !whitelist.includes(envFrontend)) whitelist.push(envFrontend);

  const corsOptions = {
    origin(origin, cb) {
      if (!origin) return cb(null, true); // server-to-server
      const allowed = whitelist.includes(origin) || isAllowedByPattern(origin);
      return allowed ? cb(null, origin) : cb(new Error("Not allowed by CORS: " + origin));
    },
    credentials: false, // ✅ token-only
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-request-id", "Accept", "Origin"],
    exposedHeaders: ["x-request-id"],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  };

  // ✅ CORS + preflight (OVO je bitno)
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  // ✅ PayPal webhooks raw BEFORE json
  app.use("/webhooks", paypalWebhooksRoutes);

  // body parsers
  app.use(express.json({ limit: "200kb" }));
  app.use(express.urlencoded({ extended: true, limit: "200kb" }));

  // routes
  app.use("/health", healthRoutes);
  app.use("/auth", authRoutes);
  app.use("/services", servicesRoutes);

  app.use("/api", meRoutes);
  app.use("/api", dashboardRoutes);
  app.use("/orders", ordersRoutes);
  app.use("/orders/sync", ordersSyncRoutes);
  app.use("/wallet", walletRoutes);
  app.use("/payments/paypal", paypalPaymentsRoutes);

  app.use("/admin", adminRoutes);
  app.use("/admin/services", adminServicesRoutes);
  app.use("/admin/balance", adminBalanceRoutes);
  app.use("/admin/provider", adminProviderRoutes);
  app.use("/admin/payments/paypal", adminPaypalPaymentsRoutes);

  app.use(notFound);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ ok: false, message: err?.message || "Server error" });
  });

  return app;
}
