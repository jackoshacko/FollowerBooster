router.get("/google", (req, res, next) => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res
        .status(500)
        .send("Google OAuth not configured (missing GOOGLE_CLIENT_ID/SECRET).");
    }

    // ---- Validate "from" to prevent open redirect ----
    const fromRaw = safeStr(req.query?.from);
    let fromOrigin = "";

    if (fromRaw) {
      try {
        const u = new URL(fromRaw);
        fromOrigin = u.origin;
      } catch {
        fromOrigin = "";
      }
    }

    // If from is present but not allowlisted, ignore it
    if (fromOrigin && !isAllowedOrigin(fromOrigin)) {
      if (AUTH_DEBUG) {
        console.log("[auth] /auth/google blocked from origin:", fromOrigin);
        console.log("[auth] allowed origins:", getAllowedOrigins());
      }
      fromOrigin = "";
    }

    // ---- Create CSRF state nonce ----
    const state = makeOAuthState(); // random hex string

    // ---- Set cookie for CSRF verification ----
    // IMPORTANT: path "/" so it's sent to /auth/google/callback
    res.cookie("oauth_state", state, oauthStateCookieOpts(req));

    // ---- Security headers: prevent caching redirects ----
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");

    if (AUTH_DEBUG) {
      console.log("[auth] /auth/google");
      console.log("  https:", isHttpsReq(req));
      console.log("  state:", state);
      console.log("  fromOrigin:", fromOrigin || "(none)");
      console.log("  cookieOpts:", oauthStateCookieOpts(req));
    }

    // ---- Redirect to Google (must be top-level navigation) ----
    // We pass "from" through query so callback can pick it up again
    // (Don't rely on state JSON for from; keep state purely CSRF)
    if (fromOrigin) {
      req.query.from = fromOrigin;
    } else {
      delete req.query.from;
    }

    return passport.authenticate("google", {
      session: false,
      scope: ["email", "profile"],
      prompt: "select_account",
      state, // ✅ nonce
    })(req, res, next);
  } catch (err) {
    return next(err);
  }
});
