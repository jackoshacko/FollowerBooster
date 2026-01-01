// server/src/routes/auth.google.routes.js
import { Router } from "express";
import passport from "passport";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { signAccessTokenForUser } from "../utils/tokens.js";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const AUTH_DEBUG = String(process.env.AUTH_DEBUG || "").toLowerCase() === "true";

function safeStr(x) {
  return String(x || "").trim();
}
function stripSlash(s) {
  return String(s || "").replace(/\/+$/, "");
}
function isHttpsReq(req) {
  const proto = safeStr(req.headers["x-forwarded-proto"]) || (req.secure ? "https" : "http");
  return proto === "https";
}
function makeOAuthState() {
  return crypto.randomBytes(16).toString("hex");
}
function getAllowedOrigins() {
  const raw =
    process.env.CORS_ORIGIN ||
    process.env.CORS_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function isAllowedOrigin(origin) {
  if (!origin) return false;
  const allow = getAllowedOrigins();
  if (allow.includes(origin)) return true;

  try {
    const u = new URL(origin);
    if (u.hostname.endsWith(".vercel.app")) return true;
    if (u.hostname.endsWith(".ngrok-free.dev")) return true;
    return false;
  } catch {
    return false;
  }
}
function oauthStateCookieOpts(req) {
  const secure = isHttpsReq(req);
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/auth",
    maxAge: 10 * 60 * 1000,
  };
}
function sanitizeNext(nextRaw) {
  const n = safeStr(nextRaw);
  if (!n) return "";
  if (!n.startsWith("/")) return "";
  if (n.startsWith("//")) return "";
  if (n.includes("\\") || n.toLowerCase().startsWith("/\\")) return "";
  return n;
}
function buildFrontendRedirect({ token, next = "" }) {
  const base = stripSlash(FRONTEND_URL);
  const qs = new URLSearchParams();
  if (token) qs.set("token", token);
  if (next) qs.set("next", next);
  return `${base}/auth/callback?${qs.toString()}`;
}
function pickFromOrigin(req) {
  const fromRaw = safeStr(req.query?.from);
  if (!fromRaw) return "";
  try {
    const u = new URL(fromRaw);
    return isAllowedOrigin(u.origin) ? u.origin : "";
  } catch {
    return "";
  }
}

// robust extractor (passport sometimes gives google profile)
function extractGoogle(p) {
  const googleId =
    safeStr(p?.id) ||
    safeStr(p?.providerId) ||
    safeStr(p?.json?.sub) ||
    safeStr(p?.sub) ||
    "";

  const email =
    safeStr(p?.emails?.[0]?.value) ||
    safeStr(p?.email) ||
    safeStr(p?.emails?.[0]) ||
    "";

  const name =
    safeStr(p?.displayName) ||
    safeStr(p?.name) ||
    "";

  const avatarUrl =
    safeStr(p?.photos?.[0]?.value) ||
    safeStr(p?.avatarUrl) ||
    "";

  return { googleId, email, name, avatarUrl };
}

// ============================================
// GET /auth/google
// ============================================
router.get("/google", (req, res, next) => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).send("Google OAuth not configured (missing GOOGLE_CLIENT_ID/SECRET).");
    }

    const fromOrigin = pickFromOrigin(req);
    const nextPath = sanitizeNext(req.query?.next);

    const state = makeOAuthState();
    res.cookie("oauth_state", state, oauthStateCookieOpts(req));

    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");

    if (AUTH_DEBUG) {
      console.log("[auth] /auth/google");
      console.log("  https:", isHttpsReq(req));
      console.log("  state:", state);
      console.log("  fromOrigin:", fromOrigin || "(none)");
      console.log("  nextPath:", nextPath || "(none)");
    }

    if (fromOrigin) req.query.from = fromOrigin;
    else delete req.query.from;

    if (nextPath) req.query.next = nextPath;
    else delete req.query.next;

    return passport.authenticate("google", {
      session: false,
      scope: ["email", "profile"],
      prompt: "select_account",
      state,
    })(req, res, next);
  } catch (e) {
    return next(e);
  }
});

// ============================================
// GET /auth/google/callback
// ============================================
router.get("/google/callback", (req, res, next) => {
  const stateCookie = safeStr(req.cookies?.oauth_state);
  const stateQuery = safeStr(req.query?.state);

  if (!stateCookie || !stateQuery || stateCookie !== stateQuery) {
    if (AUTH_DEBUG) {
      console.log("[auth] google callback state mismatch");
      console.log("  cookie:", stateCookie);
      console.log("  query :", stateQuery);
    }
    res.clearCookie("oauth_state", { ...oauthStateCookieOpts(req) });
    return res.status(400).send("OAuth state mismatch");
  }

  res.clearCookie("oauth_state", { ...oauthStateCookieOpts(req) });

  passport.authenticate("google", { session: false }, async (err, profileOrUser, info) => {
    try {
      if (err) return next(err);
      if (!profileOrUser) {
        if (AUTH_DEBUG) console.log("[auth] passport no profile", info);
        return res.status(401).send("Google login failed");
      }

      const { googleId, email, name, avatarUrl } = extractGoogle(profileOrUser);
      if (!googleId) return res.status(401).send("Google profile missing id");

      // ✅ find/create user
      let user = await User.findOne({ provider: "google", providerId: googleId });

      if (!user) {
        // ✅ IMPORTANT: passwordHash is REQUIRED in your schema -> create a random one
        const randomPass = `google_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
        const passwordHash = await bcrypt.hash(randomPass, 12);

        user = await User.create({
          email: (email || `google_${googleId}@no-email.local`).toLowerCase(),
          passwordHash, // ✅ FIX
          provider: "google",
          providerId: googleId,
          name: name || "",
          avatarUrl: avatarUrl || "",
          role: "user",
          balance: 0,
        });

        if (AUTH_DEBUG) console.log("[auth] google user CREATED:", user._id.toString());
      } else {
        // refresh profile
        const upd = {};
        const normEmail = email ? email.toLowerCase() : "";
        if (normEmail && user.email !== normEmail) upd.email = normEmail;
        if (name && user.name !== name) upd.name = name;
        if (avatarUrl && user.avatarUrl !== avatarUrl) upd.avatarUrl = avatarUrl;

        // if old google users exist without passwordHash, patch them too
        if (!user.passwordHash) {
          const randomPass = `google_fix_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
          upd.passwordHash = await bcrypt.hash(randomPass, 12);
        }

        if (Object.keys(upd).length) {
          await User.updateOne({ _id: user._id }, { $set: upd });
          user = await User.findById(user._id);
        }

        if (AUTH_DEBUG) console.log("[auth] google user EXISTS:", user._id.toString());
      }

      // ✅ JWT: id = mongo _id, sub = googleId
      const token = signAccessTokenForUser(user, { provider: "google", sub: googleId });

      if (AUTH_DEBUG) {
        console.log("[auth] jwt -> id:", user._id.toString(), "sub:", googleId);
      }

      const nextPath = sanitizeNext(req.query?.next);
      const redirectUrl = buildFrontendRedirect({ token, next: nextPath });

      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      return res.redirect(redirectUrl);
    } catch (e) {
      return next(e);
    }
  })(req, res, next);
});

export default router;
