// server/src/routes/auth.routes.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import { User } from "../models/User.js";
import { RefreshSession } from "../models/RefreshSession.js";
import { signAccessToken, signRefreshToken, hashToken } from "../utils/tokens.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(passport.initialize());

/* =========================================================
   Helpers
========================================================= */
function safeStr(x) {
  return String(x || "").trim();
}
function getEnv(name, fallback = "") {
  return safeStr(process.env[name] ?? fallback);
}
function isHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}
function isProd(req) {
  // prod mode can still run locally; use NODE_ENV + https signal for cookies
  const envProd = getEnv("NODE_ENV") === "production";
  const proto = safeStr(req.headers["x-forwarded-proto"]);
  const isHttps = req.secure || proto.includes("https");
  return envProd && isHttps;
}

/**
 * Allowlist redirect origins to prevent open redirect.
 * FRONTEND_URL is the main allowed origin.
 * FRONTEND_ALLOWED_ORIGINS can add more, comma-separated.
 */
function getAllowedOrigins() {
  const main = getEnv("FRONTEND_URL");
  const extra = getEnv("FRONTEND_ALLOWED_ORIGINS");
  const list = []
    .concat(main ? [main] : [])
    .concat(
      extra
        ? extra
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    )
    .map((o) => o.replace(/\/$/, ""));
  return Array.from(new Set(list));
}
function isAllowedOrigin(origin) {
  if (!origin) return false;
  const o = origin.replace(/\/$/, "");
  return getAllowedOrigins().includes(o);
}

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
   Cookies
========================================================= */
function cookieOpts(req) {
  const secure =
    isProd(req) ||
    safeStr(req.headers["x-forwarded-proto"]).includes("https") ||
    req.secure;

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
  };
}

/* =========================================================
   FRONTEND CALLBACK URL builder

   Priority:
   1) state.from OR query.from (must be allowed origin)
   2) FRONTEND_CALLBACK_URL (full path)
   3) FRONTEND_URL + "/auth/callback"
   4) dev fallback localhost (only if NODE_ENV != production)
========================================================= */
function resolveFrontendCallbackBase(req, stateObj = null) {
  const qFrom = safeStr(req.query?.from);
  const stFrom = safeStr(stateObj?.from);
  const from = stFrom || qFrom;

  if (from && isHttpUrl(from)) {
    const origin = new URL(from).origin;
    if (isAllowedOrigin(origin)) {
      return `${origin.replace(/\/$/, "")}/auth/callback`;
    }
  }

  const envCallback = getEnv("FRONTEND_CALLBACK_URL");
  if (envCallback && isHttpUrl(envCallback)) return envCallback;

  const fe = getEnv("FRONTEND_URL");
  if (fe && isHttpUrl(fe)) return `${fe.replace(/\/$/, "")}/auth/callback`;

  if (getEnv("NODE_ENV") !== "production") {
    return "http://localhost:5173/auth/callback";
  }

  throw new Error("Missing FRONTEND_URL or FRONTEND_CALLBACK_URL in production.");
}

function buildFrontendCallbackUrl(req, accessToken, extra = {}, stateObj = null) {
  const base = resolveFrontendCallbackBase(req, stateObj);
  const u = new URL(base);

  // do NOT set token if missing
  if (accessToken) u.searchParams.set("token", accessToken);

  const next = safeStr(stateObj?.next) || safeStr(req.query?.next);
  if (next) u.searchParams.set("next", next);

  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && String(v).length) {
      u.searchParams.set(k, String(v));
    }
  }
  return u.toString();
}

/* =========================================================
   OAuth "state" (CSRF + carry from/next)
========================================================= */
function makeState(req) {
  const from = safeStr(req.query?.from);
  const next = safeStr(req.query?.next);
  const nonce = crypto.randomBytes(16).toString("hex");

  const secure =
    isProd(req) ||
    safeStr(req.headers["x-forwarded-proto"]).includes("https") ||
    req.secure;

  const stateCookieOpts = {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/auth/google",
    maxAge: 10 * 60 * 1000,
  };

  const obj = { from, next, nonce, t: Date.now() };
  const raw = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return { raw, cookie: { name: "oauth_state", value: nonce, opts: stateCookieOpts } };
}

function parseState(raw) {
  try {
    const json = Buffer.from(String(raw || ""), "base64url").toString("utf8");
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== "object") return null;
    return obj;
  } catch {
    return null;
  }
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

// Optional: debug logs (set AUTH_DEBUG=1)
const AUTH_DEBUG = getEnv("AUTH_DEBUG") === "1";

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
          const providerId = safeStr(profile?.id);
          const name = safeStr(profile?.displayName);
          const avatarUrl = safeStr(profile?.photos?.[0]?.value);

          if (!email) return done(new Error("Google profile missing email"));
          if (!providerId) return done(new Error("Google profile missing id"));

          // find by providerId first
          let user = await User.findOne({ provider: "google", providerId });

          // if not found: link by email OR create new
          if (!user) {
            const byEmail = await User.findOne({ email });

            if (byEmail) {
              byEmail.provider = "google";
              byEmail.providerId = providerId;
              if (name && !byEmail.name) byEmail.name = name;
              if (avatarUrl && !byEmail.avatarUrl) byEmail.avatarUrl = avatarUrl;
              await byEmail.save();
              user = byEmail;
            } else {
              // schema needs passwordHash: create random
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
            // refresh profile fields
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
} else {
  if (AUTH_DEBUG) {
    console.log("[auth] Google OAuth disabled: missing GOOGLE_CLIENT_ID/SECRET");
  }
}

/* =========================================================
   REGISTER
========================================================= */
router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    const normalizedEmail = safeStr(email).toLowerCase();
    const pw = String(password || "");

    if (!normalizedEmail || !pw) return res.status(400).json({ message: "email and password required" });
    if (pw.length < 8) return res.status(400).json({ message: "password must be at least 8 chars" });

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

    // rotate
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

  const st = makeState(req);
  res.cookie(st.cookie.name, st.cookie.value, st.cookie.opts);

  if (AUTH_DEBUG) {
    console.log("[auth] /auth/google from=", req.query?.from, "next=", req.query?.next);
  }

  return passport.authenticate("google", {
    session: false,
    scope: ["email", "profile"],
    prompt: "select_account",
    state: st.raw,
  })(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/auth/google/failure" }),
  async (req, res) => {
    const stateObj = parseState(req.query?.state);
    const nonceCookie = safeStr(req.cookies?.oauth_state);

    res.clearCookie("oauth_state", { ...cookieOpts(req), path: "/auth/google" });

    if (!stateObj || !stateObj.nonce || !nonceCookie || stateObj.nonce !== nonceCookie) {
      const redirectTo = buildFrontendCallbackUrl(req, null, { error: "oauth_state_invalid" }, stateObj);
      return res.redirect(302, redirectTo);
    }

    const user = req.user;

    if (AUTH_DEBUG) {
      console.log("[auth] google callback user=", user);
      console.log("[auth] resolved callback base=", resolveFrontendCallbackBase(req, stateObj));
    }

    if (!user?._id) {
      const redirectTo = buildFrontendCallbackUrl(req, null, { error: "google_user_id_missing" }, stateObj);
      return res.redirect(302, redirectTo);
    }

    const accessToken = signAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const redirectTo = buildFrontendCallbackUrl(req, accessToken, {}, stateObj);
    return res.redirect(302, redirectTo);
  }
);

router.get("/google/failure", (req, res) => {
  if (AUTH_DEBUG) console.log("[auth] google failure query=", req.query);
  res
    .status(401)
    .set("Content-Type", "text/html")
    .send(`<!doctype html><html><body style="font-family:system-ui;background:#0a0a0a;color:#fff;padding:24px">
      <h2>Google login failed</h2>
      <p>Please try again.</p>
    </body></html>`);
});

export default router;
