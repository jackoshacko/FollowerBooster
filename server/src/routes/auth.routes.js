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

function safeStr(x) {
  return String(x ?? "").trim();
}
function isHttpsReq(req) {
  const proto = safeStr(req.headers["x-forwarded-proto"]).toLowerCase();
  return !!req.secure || proto.includes("https");
}

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

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
   REGISTER
========================= */
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

/* =========================
   LOGIN
========================= */
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = safeStr(email).toLowerCase();
    const pw = String(password || "");

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(pw, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = signAccessTokenForUser(user, { provider: user.provider || "local" });
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

// ✅ mount google routes here (so /auth/google works)
router.use(authGoogleRoutes);

export default router;
