// server/src/middlewares/auth.js
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/User.js";

export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing Bearer token" });
  }

  const token = auth.slice(7).trim();
  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // ✅ support both payload.id and payload.sub
    const id = String(payload?.id || payload?.sub || "").trim();
    if (!id) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // ✅ critical: must be Mongo ObjectId (prevents bson crashes)
    if (!mongoose.isValidObjectId(id)) {
      return res.status(401).json({ message: "Invalid token user id" });
    }

    // ✅ load user from DB (authoritative role/email)
    const user = await User.findById(id).select(
      "_id email role balance name avatarUrl provider providerId"
    );

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // ✅ attach safe user object
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
