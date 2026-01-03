// server/src/app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import passport from "passport";
import { initPassport } from "./auth/passport.js";

// ================= PUBLIC ROUTES =================
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js"; // local login/register etc
import authGoogleRoutes from "./routes/auth.google.routes.js"; // google only
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

// ✅ STRIPE (USER)
import stripePaymentsRoutes from "./routes/payments.stripe.routes.js";
import stripeWebhooksRoutes from "./routes/webhooks.stripe.routes.js";

// ================= ADMIN ROUTES =================
import adminRoutes from "./routes/admin.routes.js";
import adminServicesRoutes from "./routes/admin.services.routes.js";
import adminBalanceRoutes from "./routes/admin.balance.routes.js";
import adminPaypalPaymentsRoutes from "./routes/admin.payments.paypal.routes.js";
import adminProviderRoutes from "./routes/admin.provider.routes.js";

// ================= MIDDLEWARES =================
import { notFound } from "./middlewares/notFound.js";

function safeStr(x) {
  return String(x || "").trim();
}
function makeRequestId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ✅ whitelist + patterns (Vercel previews + localhost + ngrok)
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

  app.disable("x-powered-by");

  // =====================================================
  // TRUST PROXY (Render/Cloudflare/ngrok)
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
  // CORS (✅ allow credentials for browser fetch with cookies)
  // =====================================================
  const whitelist = Array.isArray(corsOrigins)
    ? corsOrigins.map((s) => String(s || "").trim()).filter(Boolean)
    : [];

  const envFrontend = String(process.env.FRONTEND_URL || "").trim();
  if (envFrontend && !whitelist.includes(envFrontend)) whitelist.push(envFrontend);

  const envClient = String(process.env.CLIENT_URL || "").trim();
  if (envClient && !whitelist.includes(envClient)) whitelist.push(envClient);

  app.use((req, res, next) => {
    res.setHeader("Vary", "Origin");
    next();
  });

  const corsOptions = {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (origin === "null") return cb(new Error("CORS: null origin"));

      const allowed = whitelist.includes(origin) || isAllowedByPattern(origin);
      if (!allowed) {
        console.error("❌ CORS blocked:", origin);
        console.error("   whitelist:", whitelist);
        return cb(new Error("Not allowed by CORS: " + origin));
      }

      // ✅ echo exact origin (required for credentials)
      return cb(null, origin);
    },

    // ✅ IMPORTANT: this fixes your “CORS Missing Allow Credentials”
    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "x-request-id",
      "Accept",
      "Origin",
      "ngrok-skip-browser-warning",
    ],

    exposedHeaders: ["x-request-id"],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  // =====================================================
  // COOKIES (oauth_state + refreshToken)
  // =====================================================
  app.use(cookieParser());

  // =====================================================
  // PASSPORT INIT
  // =====================================================
  initPassport();
  app.use(passport.initialize());

  // =====================================================
  // WEBHOOKS (BEFORE JSON)
  // =====================================================
  app.use("/webhooks/stripe", stripeWebhooksRoutes);
  app.use("/webhooks", paypalWebhooksRoutes);

  // =====================================================
  // BODY PARSERS
  // =====================================================
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // =====================================================
  // ROOT
  // =====================================================
  app.get("/", (req, res) => {
    res.json({
      ok: true,
      service: "FollowerBooster API",
      env: process.env.NODE_ENV || "development",
      time: new Date().toISOString(),
      reqId: req.reqId,
      corsWhitelist: whitelist,
      routes: {
        google: "/auth/google  -> /auth/google/callback",
        stripe: {
          payments: "/payments/stripe/*",
          webhook: "/webhooks/stripe",
          ping: "/webhooks/stripe/ping",
        },
      },
    });
  });

  // =====================================================
  // ROUTES
  // =====================================================
  app.use("/health", healthRoutes);

  // 1) google first
  app.use("/auth", authGoogleRoutes);

  // 2) then local auth
  app.use("/auth", authRoutes);

  // public
  app.use("/services", servicesRoutes);

  // user
  app.use("/api", meRoutes);
  app.use("/api", dashboardRoutes);
  app.use("/orders", ordersRoutes);
  app.use("/orders/sync", ordersSyncRoutes);
  app.use("/wallet", walletRoutes);

  // payments
  app.use("/payments/paypal", paypalPaymentsRoutes);
  app.use("/payments/stripe", stripePaymentsRoutes);

  // admin
  app.use("/admin", adminRoutes);
  app.use("/admin/services", adminServicesRoutes);
  app.use("/admin/balance", adminBalanceRoutes);
  app.use("/admin/provider", adminProviderRoutes);
  app.use("/admin/payments/paypal", adminPaypalPaymentsRoutes);

  // 404
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
