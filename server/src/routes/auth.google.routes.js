// server/src/routes/auth.google.routes.js
import { Router } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

const router = Router();

function safeEmail(profile) {
  const emails = profile?.emails || [];
  const e = emails[0]?.value || "";
  return String(e).trim().toLowerCase();
}

function safeName(profile) {
  return (
    profile?.displayName ||
    [profile?.name?.givenName, profile?.name?.familyName].filter(Boolean).join(" ") ||
    "User"
  );
}

function signAccessToken(user) {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET missing");

  // 7d kao i do sada (promeni ako hoćeš)
  return jwt.sign(
    { sub: String(user._id), role: user.role || "user" },
    secret,
    { expiresIn: "7d" }
  );
}

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    prompt: "select_account",
  })
);

// callback
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/auth/google/fail" }),
  async (req, res, next) => {
    try {
      const profile = req.user;
      const email = safeEmail(profile);

      if (!email) {
        return res.redirect(
          `${process.env.FRONTEND_CALLBACK_URL || "http://localhost:5173/auth/callback"}?error=${encodeURIComponent(
            "Google account has no email"
          )}`
        );
      }

      // upsert user
      let user = await User.findOne({ email });

      if (!user) {
        user = await User.create({
          email,
          username: email.split("@")[0],
          role: "user",
          // opcionalno: možeš dodati googleId ako imaš polje
        });
      }

      const token = signAccessToken(user);

      const frontendCb = process.env.FRONTEND_CALLBACK_URL || "http://localhost:5173/auth/callback";
      // ne šaljemo secret, samo token u query
      return res.redirect(`${frontendCb}?token=${encodeURIComponent(token)}`);
    } catch (e) {
      next(e);
    }
  }
);

router.get("/google/fail", (req, res) => {
  const frontendCb = process.env.FRONTEND_CALLBACK_URL || "http://localhost:5173/auth/callback";
  return res.redirect(`${frontendCb}?error=${encodeURIComponent("Google login failed")}`);
});

export default router;
