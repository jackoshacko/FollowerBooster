// server/src/middlewares/auth.js
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/User.js";

function pickBearer(req) {
  const auth = req.headers.authorization || "";
  if (!auth) return "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? String(m[1] || "").trim() : "";
}

export async function requireAuth(req, res, next) {
  const token = pickBearer(req);

  if (!token) {
    return res.status(401).json({ message: "Missing Bearer token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // ✅ prefer DB id (Mongo ObjectId) from token payload
    const rawDbId = String(payload?.id || payload?.userId || "").trim();

    // ✅ allow provider subject (google/etc) as fallback
    const sub = String(payload?.sub || "").trim();

    let user = null;

    // 1) If token contains a valid Mongo id → use it
    if (rawDbId && mongoose.isValidObjectId(rawDbId)) {
      user = await User.findById(rawDbId).select(
        "_id email role balance name avatarUrl provider providerId"
      );
    }

    // 2) If no valid DB id, try resolving via providerId = sub
    //    (Google 'sub' is NOT a Mongo id; it's provider user id)
    if (!user && sub) {
      // optional: if you store provider in token, use it; otherwise just lookup by providerId
      const provider = String(payload?.provider || payload?.issProvider || "").trim(); // optional
      const q = provider
        ? { provider, providerId: sub }
        : { providerId: sub };

      user = await User.findOne(q).select(
        "_id email role balance name avatarUrl provider providerId"
      );
    }

    if (!user) {
      // better message for debugging
      return res.status(401).json({
        message: "User not found for token",
      });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role || "user",
      balance: Number(user.balance || 0),
      name: user.name || "",
      avatarUrl: user.avatarUrl || "",
      provider: user.provider || "local",
      providerId: user.providerId || "",
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
