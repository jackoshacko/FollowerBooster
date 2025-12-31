// server/src/routes/auth.routes.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import crypto from "crypto";

import { User } from "../models/User.js";
import { RefreshSession } from "../models/RefreshSession.js";
import { signAccessToken, signRefreshToken, hashToken } from "../utils/tokens.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

/* =========================================================
   Passport init (router-scoped)
========================================================= */
router.use(passport.initialize());

/* =========================================================
   Helpers (safe)
========================================================= */
function safeStr(x) {
  return String(x ?? "").trim();
}

function getEnv(name, fallback = "") {
  return safeStr(process.env[name] ?? fallback);
}

function isEmailLike(email) {
  const e = safeStr(email).toLowerCase();
  // simple + safe email check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function normalizeEmail(email) {
  return safeStr(email).toLowerCase();
}

function clientIp(req) {
  // if behind proxy, set app.set("trust proxy", 1) in app.js
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.ip ||
    ""
  );
}

function currentBaseUrl(req) {
  // Prefer explicit env for prod/ngrok
  const pub = getEnv("BACKEND_PUBLIC_URL");
  if (pub) return pub.replace(/\/$/, "");

  // fallback (local)
  const proto =
    req.headers["x-forwarded-proto"]?.toString().split(",")[0]?.trim() ||
    (req.secure ? "https" : "http");
  const host = req.headers["x-forwarded-host"]?.toString() || req.headers.host;
  return `${proto}://${host}`.replace(/\/$/, "");
}

function frontendBaseUrl() {
  // main FE base (not callback)
  return getEnv("FRONTEND_URL", "http://localhost:5173").replace(/\/$/, "");
}

function frontendCallbackBase() {
  // FE callback route
  return getEnv(
    "FRONTEND_CALLBACK_URL",
    `${frontendBaseUrl()}/auth/callback`
  );
}

function buildFrontendCallbackUrl(params = {}) {
  const base = frontendCallbackBase();
  const u = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).length > 0) {
      u.searchParams.set(k, String(v));
    }
  });
  return u.toString();
}

/* =========================================================
   Cookie options (refresh token cookie)
   - Dev on http: secure=false, sameSite=lax
   - Prod/ngrok: secure=true, sameSite=none (if cross-site)
========================================================= */
function cookieOpts(req) {
  const nodeEnv = getEnv("NODE_ENV", "development");
  const isProd = nodeEnv === "production";

  // If your FE is on different domain (Vercel) and backend on ngrok,
  // cookie would need SameSite=None + Secure=true. BUT your FE uses
  // credentials:"omit" so cookie refresh is basically unused for FE.
  // Still: keep it correct + safe.
  const wantsCrossSite = isProd; // best guess

  return {
    httpOnly: true,
    secure: wantsCrossSite, // true in prod
    sameSite: wantsCrossSite ? "none" : "lax",
    path: "/",
    // optional: set maxAge to match refresh expiration
  };
}

/* =========================================================
   Rate limiters (anti-spam / anti-bruteforce)
========================================================= */
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10, // stricter
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
});

const googleLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

/* =========================================================
   GOOGLE OAUTH STRATEGY
========================================================= */
const GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = getEnv("GOOGLE_CLIENT_SECRET");

// We don't hardcode callback here — we build it from request (works on localhost/ngrok)
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback", // relative: uses currentBaseUrl(req) internally
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = safeStr(profile?.emails?.[0]?.value).toLowerCase();
          const googleId = safeStr(profile?.id);

          if (!email) {
            return done(null, false, { message: "Google profile missing email" });
          }

          // find user by email
          let user = await User.findOne({ email });

          if (!user) {
            // create user with random passwordHash (so they can still later set password)
            const randomPass = `google_${Date.now()}_${crypto
              .randomBytes(8)
              .toString("hex")}`;
            const passwordHash = await bcrypt.hash(randomPass, 12);

            user = await User.create({
              email,
              passwordHash,
              role: "user",
              balance: 0,
              // optional fields if your schema supports it:
              // googleId,
              // name: safeStr(profile?.displayName),
            });
          }

          return done(null, user);
        } catch (e) {
          return done(e);
        }
      }
    )
  );
}

/* =========================================================
   REGISTER
========================================================= */
router.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "email and password required" });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!isEmailLike(normalizedEmail)) {
      return res.status(400).json({ message: "invalid email" });
    }

    const pass = String(password || "");
    if (pass.length < 8) {
      return res.status(400).json({ message: "password must be at least 8 chars" });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ message: "email already exists" });

    const passwordHash = await bcrypt.hash(pass, 12);

    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      role: "user",
      balance: 0,
      // optional if schema supports:
      // name: safeStr(name).slice(0, 80) || undefined,
    });

    // If you want auto-login after register (optional):
    // const accessToken = signAccessToken({ id: String(user._id), email: user.email, role: user.role });
    // return res.json({ ok:true, accessToken, user:{...} });

    return res.json({
      ok: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        balance: user.balance,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   LOGIN
========================================================= */
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!isEmailLike(normalizedEmail)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password || ""), user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = signAccessToken({
      id: String(user._id),
      email: user.email,
      role: user.role,
    });

    // refresh token (optional)
    const refreshToken = signRefreshToken({ id: String(user._id) });

    await RefreshSession.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers["user-agent"] || "",
      ip: clientIp(req),
    });

    // cookie (optional)
    res.cookie("refreshToken", refreshToken, cookieOpts(req));

    return res.json({
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        balance: user.balance,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   REFRESH (cookie-based)
========================================================= */
router.post("/refresh", authLimiter, async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const tokenHash = hashToken(refreshToken);

    const session = await RefreshSession.findOne({
      userId: payload.id,
      tokenHash,
      revokedAt: null,
    });

    if (!session) return res.status(401).json({ message: "Refresh revoked" });

    // rotate refresh token
    session.revokedAt = new Date();
    await session.save();

    const newRefresh = signRefreshToken({ id: payload.id });

    await RefreshSession.create({
      userId: payload.id,
      tokenHash: hashToken(newRefresh),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers["user-agent"] || "",
      ip: clientIp(req),
    });

    res.cookie("refreshToken", newRefresh, cookieOpts(req));

    const user = await User.findById(payload.id).select("_id email role");
    if (!user) return res.status(401).json({ message: "User not found" });

    const accessToken = signAccessToken({
      id: String(user._id),
      email: user.email,
      role: user.role,
    });

    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

/* =========================================================
   LOGOUT
========================================================= */
router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await RefreshSession.updateMany(
        { userId: req.user.id, tokenHash: hashToken(refreshToken), revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    res.clearCookie("refreshToken", cookieOpts(req));
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   GOOGLE OAUTH ROUTES
========================================================= */

// Start Google login
router.get("/google", googleLimiter, (req, res, next) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res
      .status(500)
      .send("Google OAuth not configured (missing GOOGLE_CLIENT_ID/SECRET).");
  }

  // Make sure callback resolves to the correct base (localhost or ngrok)
  const base = currentBaseUrl(req);
  // passport google uses callbackURL from strategy as "/auth/google/callback"
  // but Google must have the absolute URL whitelisted in Google Console.
  // Your env should match base. If not, you must update Google console redirect.
  // (We'll still proceed.)
  req._oauthBase = base;

  return passport.authenticate("google", {
    session: false,
    scope: ["email", "profile"],
    prompt: "select_account",
  })(req, res, next);
});

// Callback
router.get(
  "/google/callback",
  googleLimiter,
  (req, res, next) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res
        .status(500)
        .send("Google OAuth not configured (missing GOOGLE_CLIENT_ID/SECRET).");
    }
    return next();
  },
  passport.authenticate("google", { session: false, failureRedirect: "/auth/google/failure" }),
  async (req, res) => {
    try {
      const user = req.user;

      // ✅ NEVER crash here
      if (!user) {
        const redirectTo = buildFrontendCallbackUrl({ error: "google_user_missing" });
        return res.redirect(302, redirectTo);
      }

      const userId = user?._id ? String(user._id) : "";
      if (!userId) {
        const redirectTo = buildFrontendCallbackUrl({ error: "google_user_id_missing" });
        return res.redirect(302, redirectTo);
      }

      const accessToken = signAccessToken({
        id: userId,
        email: user.email || "",
        role: user.role || "user",
      });

      const redirectTo = buildFrontendCallbackUrl({ token: accessToken });
      return res.redirect(302, redirectTo);
    } catch (e) {
      const redirectTo = buildFrontendCallbackUrl({ error: "google_callback_failed" });
      return res.redirect(302, redirectTo);
    }
  }
);

// Failure (redirect to FE for nicer UX)
router.get("/google/failure", (req, res) => {
  const redirectTo = buildFrontendCallbackUrl({ error: "google_login_failed" });
  return res.redirect(302, redirectTo);
});

export default router;
