import jwt from "jsonwebtoken";
import crypto from "crypto";

export function signAccessToken(payload) {
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET missing");
  }

  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
  });
}

export function signRefreshToken(payload) {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_REFRESH_SECRET missing");
  }

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_TTL || "30d",
  });
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
