// client/src/lib/api.js

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ================= URL HELPERS ================= */
export function apiUrl(path = "") {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${String(API).replace(/\/$/, "")}${p}`;
}

/* ================= TOKEN + USER HELPERS ================= */
export function getToken() {
  const t = localStorage.getItem("token") || "";
  if (!t || t === "null" || t === "undefined") return "";
  return String(t);
}

function normalizeToken(token) {
  const t = String(token || "").trim();
  if (!t) return "";
  if (/^bearer\s+/i.test(t)) return t.replace(/^bearer\s+/i, "").trim();
  return t;
}

export function setToken(token) {
  const t = normalizeToken(token);
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (user) localStorage.setItem("user", JSON.stringify(user));
  else localStorage.removeItem("user");
}

export function getRole() {
  return localStorage.getItem("role") || "";
}

export function setRole(role) {
  if (role) localStorage.setItem("role", String(role));
  else localStorage.removeItem("role");
}

export function clearAuthLocal() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
}

/* ================= ROUTE GUARDS ================= */
const PUBLIC_PREFIXES = [
  "/",
  "/services",
  "/faq",
  "/contact",
  "/terms",
  "/privacy",
  "/refund",
  "/login",
  "/register",
  "/no-access",
  "/auth/callback",
];

function isPublicPath(pathname) {
  const p = String(pathname || "/");
  if (p === "/") return true;
  return PUBLIC_PREFIXES.some((x) => x !== "/" && p.startsWith(x));
}

const PROTECTED_PREFIXES = [
  "/app",
  "/dashboard",
  "/create-order",
  "/orders",
  "/wallet",
  "/admin",
];

function isProtectedPath(pathname) {
  const p = String(pathname || "/");
  return PROTECTED_PREFIXES.some((x) => p.startsWith(x));
}

function redirectToLogin() {
  if (typeof window === "undefined") return;

  const path = window.location.pathname || "/";
  if (!isProtectedPath(path)) return;

  if (path !== "/login") {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}`;
  }
}

/* ================= CORE PARSERS ================= */
async function readResponse(res) {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  let text = "";
  try {
    text = await res.text();
  } catch {
    text = "";
  }

  let json = null;
  if (text) {
    if (contentType.includes("application/json")) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    } else {
      const t = text.trim();
      if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
        try {
          json = JSON.parse(t);
        } catch {
          json = null;
        }
      }
    }
  }

  return { json, text, contentType };
}

function pickErrorMessage(json, textFallback = "", statusFallback = "Request failed") {
  return json?.message || json?.error || textFallback || statusFallback;
}

function looksLikeHtml(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  return t.includes("<html") || t.includes("<!doctype html");
}

function apiLooksNgrok() {
  const a = String(API).toLowerCase();
  return a.includes("ngrok-free.dev") || a.includes("ngrok.io");
}

function buildAuthHeader(token) {
  const t = String(token || "").trim();
  if (!t) return null;
  if (/^bearer\s+/i.test(t)) return t;
  return `Bearer ${t}`;
}

function isSameOriginApi() {
  try {
    const api = new URL(String(API));
    const cur = new URL(window.location.origin);
    return api.origin === cur.origin;
  } catch {
    return false;
  }
}

/* ================= CORE REQUEST ================= */
export async function request(path, options = {}) {
  const token = getToken();
  const method = String(options.method || "GET").toUpperCase();

  const { headers: extraHeaders, body, withCredentials, ...rest } = options;

  const hasBody = body !== undefined && body !== null;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
  const isString = typeof body === "string";

  // ✅ ako je body objekat, mora JSON.stringify
  const finalBody =
    !hasBody ? undefined : isForm || isBlob || isString ? body : JSON.stringify(body);

  const authHeader = buildAuthHeader(token);

  const headers = {
    Accept: "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(hasBody && !(isForm || isBlob) && !isString ? { "Content-Type": "application/json" } : {}),
    ...(extraHeaders || {}),
  };

  if (apiLooksNgrok()) {
    headers["ngrok-skip-browser-warning"] = "true";
  }

  // ✅ auth flow (refresh cookie) -> include
  const credentialsMode =
    withCredentials === true || isSameOriginApi() ? "include" : "omit";

  const res = await fetch(apiUrl(path), {
    ...rest,
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : finalBody,
    credentials: credentialsMode,
    // mode: "cors", // može i bez, default je ok; ostavljam kompatibilno:
    mode: "cors",
    cache: "no-store",
    redirect: "follow",
  });

  const { json, text, contentType } = await readResponse(res);

  // HTML umesto JSON (ngrok warning / proxy / wrong URL)
  if (looksLikeHtml(text) && !contentType.includes("application/json")) {
    const err = new Error(
      `API returned HTML instead of JSON.\nURL: ${apiUrl(path)}`
    );
    err.status = res.status;
    err.data = { text };
    throw err;
  }

  // ✅ 401 handling: ne brisi token svuda, samo na protected
  if (res.status === 401) {
    const err = new Error(pickErrorMessage(json, "Unauthorized"));
    err.status = 401;
    err.data = json ?? { text };

    if (typeof window !== "undefined") {
      const cur = window.location.pathname || "/";
      if (isProtectedPath(cur)) {
        clearAuthLocal();
        redirectToLogin();
      }
    }

    throw err;
  }

  if (!res.ok) {
    const fallbackText =
      contentType.includes("text") || contentType.includes("html")
        ? (text || "").slice(0, 500)
        : "";

    const err = new Error(
      pickErrorMessage(json, fallbackText, `Request failed (${res.status})`)
    );
    err.status = res.status;
    err.data = json ?? { text };

    // ✅ debug helper (lakše da vidiš backend message)
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("[API ERROR]", method, apiUrl(path), err.status, err.data);
    }

    throw err;
  }

  if (json !== null) return json;
  if (text) return { text };
  return null;
}

/* ================= API WRAPPER HELPERS ================= */
function extractToken(out) {
  return (
    out?.token ||
    out?.accessToken ||
    out?.access_token ||
    out?.data?.token ||
    out?.data?.accessToken ||
    out?.data?.access_token ||
    ""
  );
}

function extractUser(out) {
  return out?.user || out?.data?.user || null;
}

function cleanStr(x) {
  return String(x || "").trim();
}

/* ================= API WRAPPER ================= */
export const api = {
  get: (p) => request(p),
  post: (p, b) => request(p, { method: "POST", body: b }),
  put: (p, b) => request(p, { method: "PUT", body: b }),
  patch: (p, b) => request(p, { method: "PATCH", body: b }),
  del: (p, b) => request(p, { method: "DELETE", body: b }),

  me: () => request("/api/me", { withCredentials: true }),

  // ✅ LOGIN harden: always send clean strings + include cookies
  login: async (payload) => {
    const safe = {
      email: cleanStr(payload?.email).toLowerCase(),
      password: cleanStr(payload?.password),
      turnstileToken: cleanStr(payload?.turnstileToken),
    };

    const out = await request("/auth/login", {
      method: "POST",
      body: safe,
      withCredentials: true,
    });

    const t = extractToken(out);
    if (t) setToken(t);

    const u = extractUser(out);
    if (u) {
      setUser(u);
      if (u.role) setRole(u.role);
    }
    return out;
  },

  // ✅ REGISTER harden
  register: async (payload) => {
    const safe = {
      email: cleanStr(payload?.email).toLowerCase(),
      password: cleanStr(payload?.password),
      name: cleanStr(payload?.name),
      turnstileToken: cleanStr(payload?.turnstileToken),
    };

    const out = await request("/auth/register", {
      method: "POST",
      body: safe,
      withCredentials: true,
    });

    const t = extractToken(out);
    if (t) setToken(t);

    const u = extractUser(out);
    if (u) {
      setUser(u);
      if (u.role) setRole(u.role);
    }
    return out;
  },

  logoutLocal: () => {
    clearAuthLocal();
    redirectToLogin();
  },

  servicesPublic: () => request("/services"),
  servicesAdmin: () => request("/admin/services"),

  createService: (payload) =>
    request("/admin/services", { method: "POST", body: payload, withCredentials: true }),
  updateService: (id, payload) =>
    request(`/admin/services/${id}`, { method: "PUT", body: payload, withCredentials: true }),
  toggleService: (id) =>
    request(`/admin/services/${id}/toggle`, { method: "PATCH", withCredentials: true }),

  createOrder: (payload) =>
    request("/orders", { method: "POST", body: payload, withCredentials: true }),
  myOrders: () => request("/orders", { withCredentials: true }),

  wallet: () => request("/wallet", { withCredentials: true }),
  dashboard: () => request("/api/dashboard", { withCredentials: true }),

  /* ===== PayPal ===== */
  paypalCreate: (payload) =>
    request("/payments/paypal/create", { method: "POST", body: payload, withCredentials: true }),
  paypalCapture: (payload) =>
    request("/payments/paypal/capture", { method: "POST", body: payload, withCredentials: true }),

  /* ===== Stripe ===== */
  stripeCheckout: (payload) =>
    request("/payments/stripe/checkout", { method: "POST", body: payload, withCredentials: true }),

  stripeSession: (sessionId) =>
    request(`/payments/stripe/session?session_id=${encodeURIComponent(sessionId || "")}`, {
      withCredentials: true,
    }),
};
