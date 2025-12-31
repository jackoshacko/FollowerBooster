// server/src/routes/auth.routes.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import { User } from "../models/User.js";
import { RefreshSession } from "../models/RefreshSession.js";
import { signAccessToken, signRefreshToken, hashToken } from "../utils/tokens.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(passport.initialize());

/* =========================================================
   Rate limit (auth endpoints)
========================================================= */
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

/* =========================================================
   Helpers
========================================================= */
function safeStr(x) {
  return String(x || "").trim();
}
function getEnv(name, fallback = "") {
  return safeStr(process.env[name] || fallback);
}

// ✅ build FE redirect (token or error)
function buildFrontendCallbackUrl({ token = "", error = "" } = {}) {
  const base = getEnv("FRONTEND_CALLBACK_URL", "http://localhost:5173/auth/callback");
  const u = new URL(base);
  if (token) u.searchParams.set("token", token);
  if (error) u.searchParams.set("error", error);
  return u.toString();
}

// ✅ cookie opts (refresh cookie optional; FE ti je token-only)
function cookieOpts(req) {
  const isProd = getEnv("NODE_ENV") === "production";
  const isHttps = (req?.headers?.["x-forwarded-proto"] || "").includes("https");
  const secure = isProd || isHttps;

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
  };
}

function normalizeEmail(email) {
  return safeStr(email).toLowerCase();
}

function isStrongPassword(pw) {
  const s = String(pw || "");
  if (s.length < 8) return false;
  return true;
}

/* =========================================================
   GOOGLE OAUTH
========================================================= */
const GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = getEnv("GOOGLE_CLIENT_SECRET");
const GOOGLE_CALLBACK_URL = getEnv(
  "GOOGLE_CALLBACK_URL",
  "http://localhost:5000/auth/google/callback"
);

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        passReqToCallback: true,
      },
      async (_req, _accessToken, _refreshToken, profile, done) => {
        try {
          const email = normalizeEmail(profile?.emails?.[0]?.value);
          if (!email) return done(null, false, { message: "google_missing_email" });

          // find
          let user = await User.findOne({ email }).select("+passwordHash");
          if (!user) {
            // create "random" passwordHash (user won't use it; google-only)
            const randomPass = `google_${Date.now()}_${Math.random().toString(16).slice(2)}`;
            const passwordHash = await bcrypt.hash(randomPass, 12);

            user = await User.create({
              email,
              passwordHash,
              role: "user",
              balance: 0,
            });
          }

          // ✅ MUST have _id
          if (!user?._id) {
            return done(null, false, { message: "google_user_id_missing" });
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
router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "email and password required" });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: "password must be at least 8 chars" });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ message: "email already exists" });

    const passwordHash = await bcrypt.hash(String(password), 12);

    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      role: "user",
      balance: 0,
      // name is optional (ako ti schema nema name, samo ignore)
      ...(name ? { name: safeStr(name).slice(0, 80) } : {}),
    });

    // optional: auto-login posle registracije (ako hoćeš)
    const accessToken = signAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return res.json({
      accessToken,
      user: { id: user._id, email: user.email, role: user.role, balance: user.balance },
    });
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   LOGIN
========================================================= */
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password || ""), user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = signAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = signRefreshToken({ id: user._id.toString() });

    await RefreshSession.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers["user-agent"] || "",
      ip: req.headers["x-forwarded-for"] || req.ip || "",
    });

    // cookie optional
    res.cookie("refreshToken", refreshToken, cookieOpts(req));

    return res.json({
      accessToken,
      user: { id: user._id, email: user.email, role: user.role, balance: user.balance },
    });
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   REFRESH (cookie-based)
========================================================= */
router.post("/refresh", async (req, res) => {
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

    session.revokedAt = new Date();
    await session.save();

    const newRefresh = signRefreshToken({ id: payload.id });

    await RefreshSession.create({
      userId: payload.id,
      tokenHash: hashToken(newRefresh),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers["user-agent"] || "",
      ip: req.headers["x-forwarded-for"] || req.ip || "",
    });

    res.cookie("refreshToken", newRefresh, cookieOpts(req));

    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    const accessToken = signAccessToken({
      id: user._id.toString(),
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
router.get("/google", (req, res, next) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res
      .status(500)
      .send("Google OAuth not configured (missing GOOGLE_CLIENT_ID/SECRET).");
  }

  return passport.authenticate("google", {
    session: false,
    scope: ["email", "profile"],
    prompt: "select_account",
  })(req, res, next);
});

router.get(
  "/google/callback",
  (req, res, next) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res
        .status(500)
        .send("Google OAuth not configured (missing GOOGLE_CLIENT_ID/SECRET).");
    }
    return next();
  },
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/auth/google/failure",
  }),
  async (req, res) => {
    try {
      const user = req.user;

      // ✅ bulletproof id extraction
      const userId = user?._id?.toString?.() || user?.id?.toString?.();
      if (!userId) {
        const redirectTo = buildFrontendCallbackUrl({ error: "google_user_id_missing" });
        return res.redirect(302, redirectTo);
      }

      const accessToken = signAccessToken({
        id: userId,
        email: user.email,
        role: user.role,
      });

      const redirectTo = buildFrontendCallbackUrl({ token: accessToken });
      return res.redirect(302, redirectTo);
    } catch (e) {
      const redirectTo = buildFrontendCallbackUrl({ error: "google_callback_failed" });
      return res.redirect(302, redirectTo);
    }
  }
);

router.get("/google/failure", (req, res) => {
  res
    .status(401)
    .set("Content-Type", "text/html")
    .send(`<!doctype html><html><body style="font-family:system-ui;background:#0a0a0a;color:#fff;padding:24px">
      <h2>Google login failed</h2>
      <p>Please try again.</p>
    </body></html>`);
});

export default router;
