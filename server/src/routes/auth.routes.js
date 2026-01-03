// server/src/routes/auth.routes.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

import { User } from "../models/User.js";
import { RefreshSession } from "../models/RefreshSession.js";
import { signAccessTokenForUser, signRefreshToken, hashToken } from "../utils/tokens.js";
import { requireAuth } from "../middlewares/auth.js";

import authGoogleRoutes from "./auth.google.routes.js";

const router = Router();

/* =========================
   helpers
========================= */

function safeStr(x) {
  return String(x ?? "").trim();
}

function isHttpsReq(req) {
  const proto = safeStr(req.headers["x-forwarded-proto"]).toLowerCase();
  return !!req.secure || proto.includes("https");
}

function boolEnv(name, def = false) {
  const v = safeStr(process.env[name]).toLowerCase();
  if (!v) return def;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function splitCsv(v) {
  return safeStr(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function cookieOpts(req) {
  const secure = isHttpsReq(req);
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
  };
}

/* =========================
   rate limit
========================= */

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

/* =========================
   Cloudflare Turnstile verify
========================= */

const TURNSTILE_ENABLED = boolEnv("TURNSTILE_ENABLED", false);
const TURNSTILE_DISABLE_LOCAL = boolEnv("TURNSTILE_DISABLE_LOCAL", true);

function isLocalRequest(req) {
  const host = safeStr(req.headers.host).toLowerCase();
  const origin = safeStr(req.headers.origin).toLowerCase();
  return (
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1")
  );
}

async function verifyTurnstile(req, turnstileToken) {
  if (!TURNSTILE_ENABLED) return { ok: true, skipped: true };

  if (TURNSTILE_DISABLE_LOCAL && isLocalRequest(req)) {
    return { ok: true, skipped: true };
  }

  const secret = safeStr(process.env.TURNSTILE_SECRET_KEY);
  if (!secret) return { ok: false, reason: "TURNSTILE_SECRET_KEY missing on server" };

  const token = safeStr(turnstileToken);
  if (!token) return { ok: false, reason: "turnstile required" };

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);

  const ip = safeStr(req.headers["cf-connecting-ip"]) || safeStr(req.ip);
  if (ip) body.set("remoteip", ip);

  let out = null;
  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    out = await resp.json();
  } catch {
    return { ok: false, reason: "turnstile verify network error" };
  }

  if (!out?.success) {
    const codes = Array.isArray(out?.["error-codes"]) ? out["error-codes"].join(",") : "";
    return { ok: false, reason: codes || "turnstile failed" };
  }

  const allow = splitCsv(process.env.TURNSTILE_EXPECTED_HOSTNAMES);
  if (allow.length) {
    const h = safeStr(out?.hostname).toLowerCase();
    const okHost = allow.some((x) => h === x.toLowerCase());
    if (!okHost) {
      return { ok: false, reason: `turnstile hostname mismatch (${out?.hostname || "?"})` };
    }
  }

  return { ok: true, skipped: false, hostname: out?.hostname || "" };
}

/* =========================
   REGISTER
========================= */
router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { email, password, name, turnstileToken } = req.body || {};
    const normalizedEmail = safeStr(email).toLowerCase();
    const pw = String(password || "");

    const ts = await verifyTurnstile(req, turnstileToken);
    if (!ts.ok) return res.status(400).json({ message: ts.reason });

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
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        balance: user.balance,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* =========================
   LOGIN
========================= */
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password, turnstileToken } = req.body || {};
    const normalizedEmail = safeStr(email).toLowerCase();
    const pw = String(password || "");

    // ✅ basic validation first (pre nego bcrypt)
    if (!normalizedEmail || !pw) {
      return res.status(400).json({ message: "email and password required" });
    }

    const ts = await verifyTurnstile(req, turnstileToken);
    if (!ts.ok) return res.status(400).json({ message: ts.reason });

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    // ✅ FIX: ako je Google user ili nema passwordHash -> bcrypt puca sa “data and hash arguments required”
    if (!user.passwordHash) {
      return res.status(401).json({
        message: "This account has no password. Use Google login or reset password.",
      });
    }

    const ok = await bcrypt.compare(pw, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = signAccessTokenForUser(user, { provider: user.provider || "local" });
    const refreshToken = signRefreshToken({ id: user._id.toString() });

    await RefreshSession.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers["user-agent"] || "",
      ip: safeStr(req.headers["cf-connecting-ip"]) || req.ip || "",
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

/* =========================
   REFRESH
========================= */
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
      ip: safeStr(req.headers["cf-connecting-ip"]) || req.ip || "",
    });

    res.cookie("refreshToken", newRefresh, cookieOpts(req));

    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    const accessToken = signAccessTokenForUser(user, { provider: user.provider || "local" });
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

/* =========================
   LOGOUT
========================= */
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

/* =========================
   Google OAuth routes
========================= */
router.use(authGoogleRoutes);

export default router;
