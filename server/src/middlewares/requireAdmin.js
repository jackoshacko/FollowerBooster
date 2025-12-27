// server/src/middlewares/requireAdmin.js
import { User } from "../models/User.js";

/**
 * requireAdmin
 * - pretpostavlja da je requireAuth već prošao (tj. req.user postoji)
 * - proverava role u tokenu ili u bazi (sigurnije)
 */
export async function requireAdmin(req, res, next) {
  try {
    const roleFromToken = req.user?.role;

    // brza provera (token)
    if (roleFromToken === "admin") return next();

    // fallback: proveri u bazi (ako token nema role ili je star)
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const u = await User.findById(userId).select("role");
    if (u?.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    return next();
  } catch (e) {
    next(e);
  }
}
