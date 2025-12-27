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

function isAllowedByPattern(origin) {
  try {
    const u = new URL(origin);
    const host = u.hostname;

    // allow localhost dev
    if (host === "localhost" || host === "127.0.0.1") return true;

    // allow vercel (prod + preview)
    if (host.endsWith(".vercel.app")) return true;

    // allow ngrok
    if (host.endsWith(".ngrok-free.dev") || host.endsWith(".ngrok.io")) return true;

    return false;
  } catch {
    return false;
  }
}

export function createApp({ corsOrigins = [] } = {}) {
  const app = express();

  // =====================================================
  // TRUST PROXY (ngrok / reverse proxies)
  // =====================================================
  app.set("trust proxy", 1);

  // =====================================================
  // REQUEST ID + BASIC SECURITY HEADERS
  // =====================================================
  app.use((req, res, next) => {
    const reqId =
      safeStr(req.headers["x-request-id"]) ||
      safeStr(req.headers["cf-ray"]) ||
      makeRequestId();

    req.reqId = reqId;
    res.setHeader("x-request-id", reqId);

    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("referrer-policy", "no-referrer");
    next();
  });

  // =====================================================
  // CORS (HARD FIX)
  // =====================================================
  const whitelist = Array.isArray(corsOrigins)
    ? corsOrigins.map((s) => String(s || "").trim()).filter(Boolean)
    : [];

  const corsOptions = {
    origin(origin, cb) {
      // ✅ IMPORTANT:
      // Ako nema Origin header (server-to-server), NE dodaj CORS headere
      // (da ne završi kao "*", pa credentials pukne).
      if (!origin) return cb(null, false);

      // nekad dođe "null" origin (sandbox / file://)
      if (origin === "null") return cb(null, true);

      if (whitelist.includes(origin)) return cb(null, true);
      if (isAllowedByPattern(origin)) return cb(null, true);

      console.error("❌ CORS blocked:", origin);
      return cb(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "x-request-id",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["x-request-id"],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  // ✅ preflight mora koristiti ISTE opcije (ne cors() bez args)
  app.options("*", cors(corsOptions));

  // =====================================================
  // COOKIES
  // =====================================================
  app.use(cookieParser());

  // =====================================================
  // PAYPAL WEBHOOKS (MUST BE BEFORE JSON PARSER)
  // =====================================================
  app.use("/webhooks", paypalWebhooksRoutes);

  // =====================================================
  // BODY PARSERS
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
  // HEALTH
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
  app.use("/admin/provider", adminProviderRoutes);
  app.use("/admin/payments/paypal", adminPaypalPaymentsRoutes);

  // =====================================================
  // 404
  // =====================================================
  app.use(notFound);

  // =====================================================
  // GLOBAL ERROR HANDLER
  // =====================================================
  app.use((err, req, res, next) => {
    const status = err?.status || err?.statusCode || 500;

    console.error("🔥 BACKEND ERROR");
    console.error("REQ_ID:", req.reqId);
    console.error("METHOD:", req.method);
    console.error("URL:", req.originalUrl);
    console.error(err?.stack || err);

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



