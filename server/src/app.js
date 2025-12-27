// server/src/app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// ================= PUBLIC ROUTES =================
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import servicesRoutes from "./routes/services.routes.js";

// ================= USER ROUTES =================
import meRoutes from "./routes/me.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import ordersSyncRoutes from "./routes/orders.sync.routes.js";
import walletRoutes from "./routes/wallet.routes.js";

// ================= PAYMENTS (USER) =================
import paypalPaymentsRoutes from "./routes/payments.paypal.routes.js";
import paypalWebhooksRoutes from "./routes/webhooks.paypal.routes.js";

// ================= ADMIN ROUTES =================
import adminRoutes from "./routes/admin.routes.js";
import adminServicesRoutes from "./routes/admin.services.routes.js";
import adminBalanceRoutes from "./routes/admin.balance.routes.js";
import adminPaypalPaymentsRoutes from "./routes/admin.payments.paypal.routes.js";

// ✅ ADMIN PROVIDER (sync / balance)
import adminProviderRoutes from "./routes/admin.provider.routes.js";

// ================= MIDDLEWARES =================
import { notFound } from "./middlewares/notFound.js";

// ================= SMALL HELPERS =================
function safeStr(x) {
  return String(x || "").trim();
}

function makeRequestId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createApp({ corsOrigins = [] } = {}) {
  const app = express();

  // =====================================================
  // TRUST PROXY (ngrok / reverse proxies)
  // =====================================================
  // If you run behind ngrok / cloudflare / reverse proxy, this is needed
  app.set("trust proxy", 1);

  // =====================================================
  // REQUEST ID + BASIC SECURITY HEADERS (no extra deps)
  // =====================================================
  app.use((req, res, next) => {
    const reqId =
      safeStr(req.headers["x-request-id"]) ||
      safeStr(req.headers["cf-ray"]) ||
      makeRequestId();

    req.reqId = reqId;
    res.setHeader("x-request-id", reqId);

    // minimal hardening headers (keep it light)
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("referrer-policy", "no-referrer");
    // keep CSP off unless you serve frontend from backend
    next();
  });

  // =====================================================
  // CORS (whitelist if provided)
  // =====================================================
  const useWhitelist = Array.isArray(corsOrigins) && corsOrigins.length > 0;

  app.use(
    cors({
      origin: useWhitelist
        ? (origin, cb) => {
            // allow non-browser clients (no origin)
            if (!origin) return cb(null, true);
            if (corsOrigins.includes(origin)) return cb(null, true);
            return cb(new Error("Not allowed by CORS: " + origin));
          }
        : true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-request-id"],
    })
  );

  // handle preflight quickly
  app.options("*", cors());

  // =====================================================
  // COOKIES
  // =====================================================
  app.use(cookieParser());

  // =====================================================
  // PAYPAL WEBHOOKS (MUST BE BEFORE JSON PARSER)
  // =====================================================
  // IMPORTANT: this route uses express.raw() inside
  app.use("/webhooks", paypalWebhooksRoutes);

  // =====================================================
  // BODY PARSERS (for everything else)
  // =====================================================
  app.use(express.json({ limit: "200kb" }));
  app.use(express.urlencoded({ extended: true, limit: "200kb" }));

  // =====================================================
  // ROOT (DEBUG)
  // =====================================================
  app.get("/", (req, res) => {
    res.json({
      ok: true,
      service: "FollowerBooster API",
      env: process.env.NODE_ENV || "development",
      time: new Date().toISOString(),
      reqId: req.reqId,
    });
  });

  // =====================================================
  // HEALTH (fast)
  // =====================================================
  app.use("/health", healthRoutes);

  // =====================================================
  // PUBLIC ROUTES
  // =====================================================
  app.use("/auth", authRoutes);
  app.use("/services", servicesRoutes);

  // =====================================================
  // USER ROUTES
  // =====================================================
  // keep as you have: /api/me and /api/dashboard
  app.use("/api", meRoutes);
  app.use("/api", dashboardRoutes);

  app.use("/orders", ordersRoutes);
  app.use("/orders", ordersSyncRoutes);
  app.use("/wallet", walletRoutes);

  // =====================================================
  // PAYMENTS (USER)
  // =====================================================
  app.use("/payments/paypal", paypalPaymentsRoutes);

  // =====================================================
  // ADMIN ROUTES
  // =====================================================
  app.use("/admin", adminRoutes);
  app.use("/admin/services", adminServicesRoutes);
  app.use("/admin/balance", adminBalanceRoutes);

  // ✅ provider routes
  app.use("/admin/provider", adminProviderRoutes);

  // ✅ admin paypal
  app.use("/admin/payments/paypal", adminPaypalPaymentsRoutes);

  // =====================================================
  // 404
  // =====================================================
  app.use(notFound);

  // =====================================================
  // GLOBAL ERROR HANDLER (safe + consistent)
  // =====================================================
  app.use((err, req, res, next) => {
    // PayPal webhooks are already handled inside their route and always return 200,
    // but just in case, don't crash:
    const status = err?.status || err?.statusCode || 500;

    console.error("🔥 BACKEND ERROR");
    console.error("REQ_ID:", req.reqId);
    console.error("METHOD:", req.method);
    console.error("URL:", req.originalUrl);
    console.error(err?.stack || err);

    // Avoid leaking internals in production
    const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";

    return res.status(status).json({
      ok: false,
      status,
      message: err?.message || "Internal Server Error",
      ...(isProd ? {} : { stack: err?.stack }),
      reqId: req.reqId,
    });
  });

  return app;
}


