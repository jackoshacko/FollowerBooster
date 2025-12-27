// server/src/middlewares/auth.js
import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
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

    const id = payload.id || payload.sub;
    if (!id) return res.status(401).json({ message: "Invalid token payload" });

    req.user = {
      id: String(id),
      email: payload.email,
      role: payload.role || "user",
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
