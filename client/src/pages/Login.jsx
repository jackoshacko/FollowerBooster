// client/src/pages/Login.jsx
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { api, setToken, apiUrl } from "../lib/api.js";

import bg from "../assets/bg.jpg";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      // login
      const data = await api.post("/auth/login", { email, password });

      // token
      const accessToken = data?.accessToken || data?.token;
      if (!accessToken) throw new Error("Login response missing accessToken");

      setToken(accessToken);
      window.dispatchEvent(new Event("auth-changed"));

      // user/role
      let user = data?.user || null;
      let role = data?.user?.role || data?.role || "";

      // ako login ne vraća user/role → povuci /api/me (token-only)
      if (!role || !user) {
        const me = await api.get("/api/me");
        user = me || user;
        role = me?.role || role || "user";
      }

      if (user) localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("role", role || "user");

      // redirect
      const fromPath = loc.state?.from?.pathname || "/dashboard";
      const isAdminRoute = String(fromPath).startsWith("/admin");

      if (isAdminRoute && role !== "admin") {
        nav("/dashboard", { replace: true });
        return;
      }

      nav(fromPath === "/" ? "/dashboard" : fromPath, { replace: true });
    } catch (e2) {
      setErr(e2?.message || "Login failed");
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
  }

  function googleLogin() {
    // ✅ koristi isti backend base kao i ostatak app-a (ngrok/prod)
    window.location.href = apiUrl("/auth/google");
  }

  // UI helpers (micro-interactions)
  function focusOn(e) {
    e.currentTarget.style.border = "1px solid #00d4ff";
    e.currentTarget.style.boxShadow = "0 0 12px rgba(0,212,255,0.35)";
  }
  function focusOff(e) {
    e.currentTarget.style.border = "1px solid rgba(255,255,255,.12)";
    e.currentTarget.style.boxShadow = "none";
  }

  function glowOn(e) {
    e.currentTarget.style.boxShadow = "0 0 25px rgba(0,212,255,0.55)";
    e.currentTarget.style.transform = "translateY(-1px)";
  }
  function glowOff(e) {
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.transform = "translateY(0px)";
  }

  const loginBg =
    email.length > 0
      ? "linear-gradient(135deg, #7c6cff, #00e0ff)"
      : styles.loginBtn.background;

  return (
    <div style={{ ...styles.page, backgroundImage: `url(${bg})` }}>
      <div style={styles.overlay} />

      <div style={styles.card}>
        <div style={styles.brand}>FollowerBooster</div>
        <div style={styles.subtitle}>Premium Social Media Infrastructure</div>

        {err && <div style={styles.error}>{err}</div>}

        <button
          onClick={googleLogin}
          style={styles.googleBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f4f4f4";
            e.currentTarget.style.boxShadow = "0 0 18px rgba(255,255,255,0.25)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0px)";
          }}
          disabled={loading}
        >
          Continue with Google
        </button>

        <div style={styles.divider}>
          <span style={styles.divLine} />
          <p style={{ margin: 0 }}>or</p>
          <span style={styles.divLine} />
        </div>

        <form onSubmit={submit} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={focusOn}
            onBlur={focusOff}
            autoComplete="email"
          />

          <input
            style={styles.input}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={focusOn}
            onBlur={focusOff}
            autoComplete="current-password"
          />

          <button
            style={{
              ...styles.loginBtn,
              background: loginBg,
              opacity: email.length > 0 ? 1 : 0.92,
            }}
            disabled={loading}
            onMouseEnter={glowOn}
            onMouseLeave={glowOff}
          >
            {loading ? "Authenticating..." : "Login"}
          </button>
        </form>

        <div style={styles.footer}>
          No account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundSize: "cover",
    backgroundPosition: "center",
    display: "grid",
    placeItems: "center",
    padding: 16,
    fontFamily: "Inter, sans-serif",
    position: "relative",
  },

  overlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(180deg, rgba(0,0,0,.65), rgba(0,0,0,.85))",
  },

  card: {
    position: "relative",
    width: "100%",
    maxWidth: 420,
    padding: "32px",
    borderRadius: 18,
    background: "rgba(15,15,15,0.75)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 30px 80px rgba(0,0,0,.8)",
    color: "#fff",
    zIndex: 1,
  },

  brand: {
    fontFamily: "Orbitron, sans-serif",
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 1.5,
    textAlign: "center",
  },

  subtitle: {
    textAlign: "center",
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 22,
  },

  error: {
    background: "rgba(255,50,50,.15)",
    border: "1px solid rgba(255,50,50,.3)",
    padding: 10,
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 12,
  },

  googleBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: 12,
    background: "#fff",
    color: "#000",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
    transition: "all 0.25s ease",
  },

  divider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: "18px 0",
    opacity: 0.5,
    fontSize: 12,
  },

  divLine: {
    height: 1,
    background: "rgba(255,255,255,.18)",
    flex: 1,
  },

  form: {
    display: "grid",
    gap: 12,
  },

  input: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(0,0,0,.4)",
    color: "#fff",
    outline: "none",
    fontSize: 14,
    transition: "all 0.25s ease",
  },

  loginBtn: {
    marginTop: 6,
    padding: "12px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #6a5cff, #00d4ff)",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
    transition: "all 0.25s ease",
  },

  footer: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 13,
    opacity: 0.8,
  },
};

