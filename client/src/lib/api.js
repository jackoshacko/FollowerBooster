// client/src/lib/api.js
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ================= URL HELPERS ================= */
export function apiUrl(path = "") {
  return `${API}${path}`;
}

/* ================= TOKEN + USER HELPERS ================= */
export function getToken() {
  return localStorage.getItem("token") || "";
}

export function setToken(token) {
  if (token) localStorage.setItem("token", token);
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

export function clearAuthLocal() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
}

function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

/* ================= CORE PARSERS ================= */
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function pickErrorMessage(json, textFallback = "") {
  return (
    json?.message ||
    json?.error ||
    (typeof json === "string" ? json : "") ||
    textFallback ||
    "Request failed"
  );
}

/* ================= CORE REQUEST (TOKEN-ONLY) ================= */
export async function request(path, options = {}) {
  const token = getToken();

  const method = (options.method || "GET").toUpperCase();
  const hasBody = options.body != null; // body već dolazi kao string u tvom wrapperu

  // headers: Content-Type samo kad ima body
  const headers = {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(apiUrl(path), {
    ...options,
    method,
    headers,

    // ✅ HARD FIX: token-only => NO cookies => nema Allow-Credentials drama
    credentials: "omit",
  });

  // backend nekad vrati HTML/text
  const data = await safeJson(res);
  const text = data === null ? await safeText(res) : "";

  // 401 → token invalid/expired
  if (res.status === 401) {
    clearAuthLocal();
    redirectToLogin();
    throw new Error(pickErrorMessage(data, "Unauthorized"));
  }

  if (!res.ok) {
    throw new Error(pickErrorMessage(data, text));
  }

  // ako nema json body, vrati text (ili {})
  return data ?? (text ? { text } : {});
}

// kad želiš plain text (npr. health check)
export async function requestText(path, options = {}) {
  const token = getToken();

  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },

    // ✅ isto ovde
    credentials: "omit",
  });

  const text = await safeText(res);

  if (res.status === 401) {
    clearAuthLocal();
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    throw new Error(text || "Request failed");
  }

  return text;
}

/* ================= API WRAPPER ================= */
export const api = {
  /* ---- generic ---- */
  get: (p) => request(p),
  post: (p, b) => request(p, { method: "POST", body: JSON.stringify(b) }),
  put: (p, b) => request(p, { method: "PUT", body: JSON.stringify(b) }),
  del: (p) => request(p, { method: "DELETE" }),

  /* ---- misc ---- */
  me: () => request("/api/me"),
  health: () => requestText("/health"),

  /* ---- auth ---- */
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),

  logoutLocal: () => {
    clearAuthLocal();
    redirectToLogin();
  },

  /* ---- services ---- */
  servicesPublic: () => request("/services"),
  servicesAdmin: () => request("/admin/services"),

  createService: (payload) => request("/admin/services", { method: "POST", body: JSON.stringify(payload) }),
  updateService: (id, payload) => request(`/admin/services/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteService: (id) => request(`/admin/services/${id}`, { method: "DELETE" }),

  /* ---- orders ---- */
  createOrder: (payload) => request("/orders", { method: "POST", body: JSON.stringify(payload) }),
  myOrders: () => request("/orders"),

  /* ---- wallet ---- */
  wallet: () => request("/wallet"),

  /* ---- payments: PayPal ---- */
  paypalCreate: (payload) => request("/payments/paypal/create", { method: "POST", body: JSON.stringify(payload) }),
  paypalCapture: (payload) => request("/payments/paypal/capture", { method: "POST", body: JSON.stringify(payload) }),
};
