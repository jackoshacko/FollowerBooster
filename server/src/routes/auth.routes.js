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

/* =========================================================
   Passport init (router-scoped)
========================================================= */
router.use(passport.initialize());

/* =========================================================
   Rate limit
========================================================= */
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

/* =========================================================
   Cookie options (refresh token cookie - optional)
   NOTE: Tvoj FE je token-only (credentials: "omit"), tako da
   refresh cookie cross-site neće raditi na Vercel/ngrok bez proxy.
========================================================= */
function cookieOpts() {
  return {
    httpOnly: true,
    secure: true, // mora true za SameSite=None
    sameSite: "none",
    path: "/",
  };
}

/* =========================================================
   Helpers
========================================================= */
function safeStr(x) {
  return String(x || "").trim();
}

function getEnv(name, fallback = "") {
  return safeStr(process.env[name] || fallback);
}

function buildFrontendCallbackUrl(accessToken) {
  const base = getEnv("FRONTEND_CALLBACK_URL", "http://localhost:5173/auth/callback");
  const u = new URL(base);
  u.searchParams.set("token", accessToken);
  return u.toString();
}

/* =========================================================
   GOOGLE OAUTH STRATEGY
========================================================= */
const GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = getEnv("GOOGLE_CLIENT_SECRET");
const GOOGLE_CALLBACK_URL = getEnv("GOOGLE_CALLBACK_URL", "http://localhost:5000/auth/google/callback");

// Ako env nije setovan, nemoj crash app — samo neće raditi /auth/google
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = safeStr(profile?.emails?.[0]?.value).toLowerCase();
          if (!email) return done(new Error("Google profile missing email"));

          // 1) find user by email (minimal changes; ne pretpostavljamo googleId field)
          let user = await User.findOne({ email });

          // 2) create user if not exists
          if (!user) {
            const randomPass = `google_${Date.now()}_${Math.random().toString(16).slice(2)}`;
            const passwordHash = await bcrypt.hash(randomPass, 12);

            user = await User.create({
              email,
              passwordHash,
              role: "user",
              balance: 0,
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
router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "email and password required" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: "password must be at least 8 chars" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ message: "email already exists" });

    const passwordHash = await bcrypt.hash(String(password), 12);

    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      role: "user",
      balance: 0,
    });

    return res.json({
      ok: true,
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
    const normalizedEmail = String(email || "").toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password || ""), user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = signAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // refresh token (optional)
    const refreshToken = signRefreshToken({ id: user._id.toString() });

    await RefreshSession.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers["user-agent"] || "",
      ip: req.ip || "",
    });

    // cookie (optional)
    res.cookie("refreshToken", refreshToken, cookieOpts());

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

    // rotate refresh token
    session.revokedAt = new Date();
    await session.save();

    const newRefresh = signRefreshToken({ id: payload.id });

    await RefreshSession.create({
      userId: payload.id,
      tokenHash: hashToken(newRefresh),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers["user-agent"] || "",
      ip: req.ip || "",
    });

    res.cookie("refreshToken", newRefresh, cookieOpts());

    const user = await User.findById(payload.id).select("_id email role");
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

    res.clearCookie("refreshToken", cookieOpts());
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   GOOGLE OAUTH ROUTES
   - /auth/google -> Google consent
   - /auth/google/callback -> creates/finds user, issues access token, redirects to FRONTEND_CALLBACK_URL?token=...
========================================================= */

// Start Google login
router.get("/google", (req, res, next) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).send("Google OAuth not configured (missing GOOGLE_CLIENT_ID/SECRET).");
  }
  return passport.authenticate("google", {
    session: false,
    scope: ["email", "profile"],
    prompt: "select_account",
  })(req, res, next);
});

// Callback
router.get(
  "/google/callback",
  (req, res, next) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).send("Google OAuth not configured (missing GOOGLE_CLIENT_ID/SECRET).");
    }
    return next();
  },
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/auth/google/failure",
  }),
  async (req, res) => {
    // req.user is the User doc
    const user = req.user;

    const accessToken = signAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Token-only flow: redirect back to FE callback with token
    const redirectTo = buildFrontendCallbackUrl(accessToken);
    return res.redirect(302, redirectTo);
  }
);

// Failure page (simple)
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
