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

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/refresh",
  };
}

// ===================== REGISTER =====================
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

    res.cookie("refreshToken", refreshToken, cookieOpts());

    return res.json({
      accessToken,
      user: { id: user._id, email: user.email, role: user.role, balance: user.balance },
    });
  } catch (e) {
    next(e);
  }
});

// ===================== ME (✅ bitno za Sidebar/admin) =====================
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

    res.clearCookie("refreshToken", { path: "/auth/refresh" });
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ===================== GOOGLE (COMING SOON) =====================
router.get("/google", (req, res) => {
  res
    .status(200)
    .set("Content-Type", "text/html")
    .send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FollowerBooster • Coming Soon</title>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Orbitron:wght@500;600;700&display=swap" rel="stylesheet" />

  <style>
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: Inter, system-ui, Arial, sans-serif;
      background: radial-gradient(1200px 700px at 50% 40%, rgba(0,212,255,.14), rgba(0,0,0,0) 55%),
                  linear-gradient(180deg, #0b0b0b, #050505);
      color: #fff;
      display: grid;
      place-items: center;
      padding: 18px;
    }
    .card {
      width: 100%;
      max-width: 560px;
      border-radius: 18px;
      background: rgba(15,15,15,0.75);
      border: 1px solid rgba(255,255,255,0.08);
      backdrop-filter: blur(18px);
      box-shadow: 0 30px 80px rgba(0,0,0,.8);
      padding: 28px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .glow {
      position: absolute;
      inset: -120px;
      background: radial-gradient(circle at 50% 35%, rgba(0,212,255,.18), rgba(106,92,255,.12), rgba(0,0,0,0) 55%);
      filter: blur(22px);
      pointer-events: none;
    }
    .brand {
      font-family: Orbitron, Inter, sans-serif;
      font-weight: 700;
      letter-spacing: 1.5px;
      font-size: 26px;
      margin-bottom: 8px;
      position: relative;
    }
    .title {
      font-size: 18px;
      font-weight: 800;
      margin: 0 0 8px;
      position: relative;
    }
    .sub {
      opacity: .72;
      margin: 0 0 18px;
      position: relative;
      line-height: 1.5;
      font-size: 14px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(0,0,0,.35);
      border: 1px solid rgba(255,255,255,.10);
      font-weight: 700;
      position: relative;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #00d4ff;
      box-shadow: 0 0 18px rgba(0,212,255,.55);
      animation: pulse 1.4s infinite ease-in-out;
    }
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.35); opacity: .75; }
      100% { transform: scale(1); opacity: 1; }
    }
    .btnRow {
      margin-top: 18px;
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
      position: relative;
    }
    a.btn {
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 14px;
      border-radius: 12px;
      font-weight: 900;
      transition: all .25s ease;
      min-width: 180px;
    }
    a.primary {
      background: linear-gradient(135deg, #6a5cff, #00d4ff);
      color: #000;
    }
    a.primary:hover {
      box-shadow: 0 0 25px rgba(0,212,255,.55);
      transform: translateY(-1px);
    }
    a.ghost {
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12);
      color: #fff;
    }
    a.ghost:hover {
      box-shadow: 0 0 18px rgba(255,255,255,.16);
      transform: translateY(-1px);
    }
    .small {
      margin-top: 14px;
      opacity: .55;
      font-size: 12px;
      position: relative;
    }
    code {
      background: rgba(0,0,0,.35);
      border: 1px solid rgba(255,255,255,.10);
      padding: 3px 8px;
      border-radius: 10px;
      color: rgba(255,255,255,.85);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="glow"></div>
    <div class="brand">FollowerBooster</div>
    <h1 class="title">Google Sign-in is coming soon</h1>
    <p class="sub">
      We’re polishing the OAuth flow and security hardening.<br />
      For now, please use email & password login.
    </p>

    <div class="pill">
      <span class="dot"></span>
      Coming Soon • OAuth
    </div>

    <div class="btnRow">
      <a class="btn primary" href="http://localhost:5173/login">Back to Login</a>
      <a class="btn ghost" href="http://localhost:5173/register">Create Account</a>
    </div>

    <div class="small">
      Endpoint: <code>GET /auth/google</code>
    </div>
  </div>
</body>
</html>`);
});

export default router;
