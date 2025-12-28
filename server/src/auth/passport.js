// server/src/auth/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

export function initPassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL;

  if (!clientID || !clientSecret || !callbackURL) {
    console.warn("⚠️ Google OAuth env missing. Google login will not work until set.");
    return passport;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // samo prosledimo dalje profile (mi ćemo user napraviti u ruti)
          return done(null, profile);
        } catch (e) {
          return done(e);
        }
      }
    )
  );

  return passport;
}
