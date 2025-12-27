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
 * Cookie options
 * NOTE:
 * - Cross-site cookie (Vercel -> ngrok) je često problem u praksi.
 * - Ako želiš refresh preko cookie-a cross-site: sameSite "none" + secure true.
 * - Ako želiš da IZBEGNEŠ CORS/cookie dramu: u client fetch stavi credentials:"omit"
 *   i refresh endpoint koristi samo kad radiš same-site/proxy.
 */
function cookieOpts() {
  const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";

  return {
    httpOnly: true,
    secure: true, // mora true za SameSite=None u modernim browserima
    sameSite: "none",
    path: "/",
    // domain: NE postavljati za ngrok/vercel
  };
}

/* ===================== REGISTER ===================== */
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

/* ===================== LOGIN ===================== */
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

    // ✅ set cookie
    res.cookie("refreshToken", refreshToken, cookieOpts());

    return res.json({
      accessToken,
      user: { id: user._id, email: user.email, role: user.role, balance: user.balance },
    });
  } catch (e) {
    next(e);
  }
});

/* ===================== REFRESH ===================== */
/**
 * POST /auth/refresh
 * NOTE: Ovo koristi cookie refreshToken.
 * Ako ti frontend radi credentials:"omit" (token-only), browser NEĆE slati cookie,
 * pa refresh neće raditi cross-site — što je OK dok ne uvedemo proxy / same-site.
 */
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

/* ===================== LOGOUT ===================== */
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

/* ===================== GOOGLE (PLACEHOLDER) ===================== */
router.get("/google", (req, res) => {
  res
    .status(200)
    .set("Content-Type", "text/html")
    .send(`<!doctype html><html><body>Coming soon</body></html>`);
});

export default router;
