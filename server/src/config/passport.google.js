// server/src/config/passport.google.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

export function setupGooglePassport() {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
  const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || "http://localhost:5000";

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn("[auth] Google OAuth not configured");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${String(BACKEND_PUBLIC_URL).replace(/\/+$/, "")}/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        // We pass profile forward; DB work is done in callback route
        return done(null, profile);
      }
    )
  );
}
