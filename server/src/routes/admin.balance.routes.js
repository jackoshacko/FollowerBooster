import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/admin.js";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";

const router = Router();

/**
 * POST /admin/balance/topup
 * body: { userEmail OR userId, amount, note? }
 */
router.post("/balance/topup", requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { userId, userEmail, amount, note = "" } = req.body;

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    await session.withTransaction(async () => {
      const user =
        userId
          ? await User.findById(userId).session(session)
          : await User.findOne({ email: String(userEmail || "").toLowerCase() }).session(session);

      if (!user) throw new Error("USER_NOT_FOUND");

      const before = user.balance || 0;
      const after = Math.round((before + amt) * 100) / 100;

      user.balance = after;
      await user.save({ session });

      await Transaction.create(
        [
          {
            userId: user._id,
            type: "topup",
            amount: amt,
            balanceBefore: before,
            balanceAfter: after,
            meta: { note, adminId: req.user.id },
          },
        ],
        { session }
      );

      res.json({ ok: true, userId: user._id, balance: after });
    });
  } catch (e) {
    if (String(e?.message) === "USER_NOT_FOUND") return res.status(404).json({ message: "User not found" });
    next(e);
  } finally {
    session.endSession();
  }
});

export default router;
