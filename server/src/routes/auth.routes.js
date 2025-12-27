// server/src/routes/auth.routes.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

import { User } from "../models/User.js";
import { RefreshSession } from "../models/RefreshSession.js";
import { signAccessToken, signRefreshToken, hashToken } from "../utils/tokens.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Cookie options (FIXED for Vercel <-> ngrok cross-site)
 * - sameSite must be "none"
 * - secure must be true (required by browsers for SameSite=None)
 * - path should be "/" (simpler) so refreshToken is available when needed
 */
function cookieOpts() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    // domain: do NOT set domain here for ngrok/vercel; let browser scope it naturally
  };
}

// ===================== REGISTER =====================
// NOTE: register returns ok, but does NOT auto-login (you can add it later).
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

// ===================== LOGIN =====================
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

    const refreshToken = signRefreshToken({ id: user._id.toString() });

    await RefreshSession.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers["user-agent"] || "",
      ip: req.ip || "",
    });

    // ✅ FIXED COOKIE
    res.cookie("refreshToken", refreshToken, cookieOpts());

    return res.json({
      accessToken,
      user: { id: user._id, email: user.email, role: user.role, balance: user.balance },
    });
  } catch (e) {
    next(e);
  }
});

// ===================== ME =====================
// GET /auth/me
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("_id email role balance");
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      id: user._id,
      email: user.email,
      role: user.role,
      balance: user.balance,
    });
  } catch (e) {
    next(e);
  }
});

// ===================== REFRESH =====================
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

    // ✅ FIXED COOKIE
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

// ===================== LOGOUT =====================
router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await RefreshSession.updateMany(
        { userId: req.user.id, tokenHash: hashToken(refreshToken), revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    // ✅ clear cookie WITH SAME OPTIONS (path/samesite/secure must match)
    res.clearCookie("refreshToken", cookieOpts());

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ===================== GOOGLE (COMING SOON) =====================
router.get("/google", (req, res) => {
  // (ostaje isto kao kod tebe)
  res
    .status(200)
    .set("Content-Type", "text/html")
    .send(`<!doctype html><html><body>Coming soon</body></html>`);
});

export default router;
