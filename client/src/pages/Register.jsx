// client/src/pages/Register.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

import bg from "../assets/bg.jpg";

export default function Register() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      await api.post("/auth/register", {
        email: email.trim(),
        password,
      });

      // Backend /auth/register ne vraća accessToken u tvom kodu -> vodi na login
      nav("/login", { replace: true });
    } catch (e) {
      setErr(e.message || "Register failed");
    } finally {
      setLoading(false);
    }
  }

  function googleLogin() {
    window.location.href = "http://localhost:5000/auth/google";
  }

  // UI helpers
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

  const primaryBg =
    email.length > 0
      ? "linear-gradient(135deg, #7c6cff, #00e0ff)"
      : styles.primaryBtn.background;

  return (
    <div style={{ ...styles.page, backgroundImage: `url(${bg})` }}>
      <div style={styles.overlay} />

      <div style={styles.card}>
        <div style={styles.brand}>FollowerBooster</div>
        <div style={styles.subtitle}>Create your account and start boosting.</div>

        {err && <div style={styles.error}>{err}</div>}

        <button
          type="button"
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
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={focusOn}
              onBlur={focusOff}
              autoComplete="email"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              placeholder="Min 8 characters"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={focusOn}
              onBlur={focusOff}
              autoComplete="new-password"
            />
          </div>

          <button
            style={{
              ...styles.primaryBtn,
              background: primaryBg,
              opacity: email.length > 0 ? 1 : 0.92,
            }}
            disabled={loading}
            onMouseEnter={glowOn}
            onMouseLeave={glowOff}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div style={styles.footer}>
          Already have an account? <Link to="/login">Sign in</Link>
        </div>

        <div style={styles.micro}>
          By creating an account you agree to our terms.
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
    background: "linear-gradient(180deg, rgba(0,0,0,.65), rgba(0,0,0,.88))",
  },

  card: {
    position: "relative",
    width: "100%",
    maxWidth: 440,
    padding: 32,
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
    opacity: 0.72,
    marginTop: 6,
    marginBottom: 18,
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

  field: {
    display: "grid",
    gap: 6,
  },

  label: {
    fontSize: 12,
    opacity: 0.75,
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

  primaryBtn: {
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
    marginTop: 14,
    textAlign: "center",
    fontSize: 13,
    opacity: 0.85,
  },

  micro: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 11,
    opacity: 0.55,
  },
};
