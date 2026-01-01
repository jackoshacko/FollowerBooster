import jwt from "jsonwebtoken";
import crypto from "crypto";

/* =========================================================
   Helpers
========================================================= */
function mustEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`${name} missing`);
  }
  return v;
}

function safeStr(x) {
  return String(x || "").trim();
}

/* =========================================================
   ACCESS TOKEN (generic)
========================================================= */
export function signAccessToken(payload) {
  const secret = mustEnv("JWT_ACCESS_SECRET");

  return jwt.sign(payload, secret, {
    expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
  });
}

/* =========================================================
   REFRESH TOKEN
========================================================= */
export function signRefreshToken(payload) {
  const secret = mustEnv("JWT_REFRESH_SECRET");

  return jwt.sign(payload, secret, {
    expiresIn: process.env.REFRESH_TOKEN_TTL || "30d",
  });
}

/* =========================================================
   ✅ ACCESS TOKEN FOR USER (BULLETPROOF)
   - id  = MongoDB _id   (OBAVEZNO)
   - sub = providerId   (Google / OAuth, optional)
========================================================= */
export function signAccessTokenForUser(user, extra = {}) {
  if (!user || !user._id) {
    throw new Error("signAccessTokenForUser: user._id missing");
  }

  const provider = safeStr(extra.provider || user.provider || "local");
  const providerId = safeStr(
    extra.providerId ||
    extra.sub ||                // allow passing { sub }
    user.providerId ||
    ""
  );

  return signAccessToken({
    id: user._id.toString(),     // ✅ MongoDB ObjectId (24 chars)
    role: user.role || "user",
    provider,
    ...(providerId ? { sub: providerId } : {}), // ✅ OAuth-safe
  });
}

/* =========================================================
   TOKEN HASH (for refresh sessions)
========================================================= */
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
