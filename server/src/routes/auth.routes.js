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
   Rate limit
========================================================= */
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function safeStr(x) {
  return String(x || "").trim();
}
function getEnv(name, fallback = "") {
  return safeStr(process.env[name] || fallback);
}
function isHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

/* =========================================================
   Cookie options (refresh token cookie)
   ✅ In dev (localhost) SameSite=None+secure can break if not https,
   so we switch automatically.
========================================================= */
function cookieOpts(req) {
  const isProd = getEnv("NODE_ENV") === "production";
  // if behind https (ngrok/vercel proxy), secure is ok
  const secure =
    isProd || (req.headers["x-forwarded-proto"] || "").includes("https") || req.secure;

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
  };
}

/* =========================================================
   FRONTEND CALLBACK URL builder
   ✅ supports:
     - query ?from=https://your-frontend.com
     - env FRONTEND_CALLBACK_URL (e.g. https://your.vercel.app/auth/callback)
========================================================= */
function buildFrontendCallbackUrl(req, accessToken, extra = {}) {
  const from = safeStr(req.query?.from);
  const next = safeStr(req.query?.next);

  const base =
    (from && isHttpUrl(from) ? `${from.replace(/\/$/, "")}/auth/callback` : "") ||
    getEnv("FRONTEND_CALLBACK_URL", "http://localhost:5173/auth/callback");

  const u = new URL(base);
  u.searchParams.set("token", accessToken);

  if (next) u.searchParams.set("next", next);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && String(v).length) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

/* =========================================================
   GOOGLE OAUTH STRATEGY
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
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = safeStr(profile?.emails?.[0]?.value).toLowerCase();
          const providerId = safeStr(profile?.id); // ✅ google id
          const name = safeStr(profile?.displayName);
          const avatarUrl = safeStr(profile?.photos?.[0]?.value);

          if (!email) return done(new Error("Google profile missing email"));
          if (!providerId) return done(new Error("Google profile missing id"));

          // 1) try find by provider+providerId first
          let user = await User.findOne({ provider: "google", providerId });

          // 2) if not, link by email (existing local user) OR create new
          if (!user) {
            const byEmail = await User.findOne({ email });

            if (byEmail) {
              // ✅ link existing local user to google
              byEmail.provider = "google";
              byEmail.providerId = providerId;
              if (name && !byEmail.name) byEmail.name = name;
              if (avatarUrl && !byEmail.avatarUrl) byEmail.avatarUrl = avatarUrl;
              await byEmail.save();
              user = byEmail;
            } else {
              // ✅ create new user (still needs passwordHash due to schema)
              const randomPass = `google_${Date.now()}_${Math.random().toString(16).slice(2)}`;
              const passwordHash = await bcrypt.hash(randomPass, 12);

              user = await User.create({
                email,
                passwordHash,
                provider: "google",
                providerId,
                name: name || "",
                avatarUrl: avatarUrl || "",
                role: "user",
                balance: 0,
              });
            }
          } else {
            // optional refresh profile fields
            let changed = false;
            if (name && user.name !== name) {
              user.name = name;
              changed = true;
            }
            if (avatarUrl && user.avatarUrl !== avatarUrl) {
              user.avatarUrl = avatarUrl;
              changed = true;
            }
            if (changed) await user.save();
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

    const normalizedEmail = safeStr(email).toLowerCase();
    const pw = String(password || "");

    if (!normalizedEmail || !pw) {
      return res.status(400).json({ message: "email and password required" });
    }
    if (pw.length < 8) {
      return res.status(400).json({ message: "password must be at least 8 chars" });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ message: "email already exists" });

    const passwordHash = await bcrypt.hash(pw, 12);

    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      provider: "local",
      providerId: "",
      name: safeStr(name),
      role: "user",
      balance: 0,
    });

    return res.json({
      ok: true,
      user: { id: user._id.toString(), email: user.email, role: user.role, balance: user.balance },
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
    const normalizedEmail = safeStr(email).toLowerCase();
    const pw = String(password || "");

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(pw, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    // ✅ always use Mongo _id
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
      ip: req.ip || "",
    });

    res.cookie("refreshToken", refreshToken, cookieOpts(req));

    return res.json({
      accessToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        balance: user.balance,
        name: user.name || "",
        avatarUrl: user.avatarUrl || "",
      },
    });
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   REFRESH
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
      ip: req.ip || "",
    });

    res.cookie("refreshToken", newRefresh, cookieOpts(req));

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
    return res.status(500).send("Google OAuth not configured (missing GOOGLE_CLIENT_ID/SECRET).");
  }
  return passport.authenticate("google", {
    session: false,
    scope: ["email", "profile"],
    prompt: "select_account",
  })(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/auth/google/failure" }),
  async (req, res) => {
    const user = req.user;

    if (!user?._id) {
      // should never happen now; but safe
      const redirectTo = buildFrontendCallbackUrl(req, "", { error: "google_user_id_missing" });
      return res.redirect(302, redirectTo);
    }

    // ✅ JWT MUST USE Mongo _id
    const accessToken = signAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const redirectTo = buildFrontendCallbackUrl(req, accessToken);
    return res.redirect(302, redirectTo);
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
