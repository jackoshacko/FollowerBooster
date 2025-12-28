// client/src/lib/api.js

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ================= URL HELPERS ================= */
export function apiUrl(path = "") {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API}${p}`;
}

/* ================= TOKEN + USER HELPERS ================= */
export function getToken() {
  return localStorage.getItem("token") || "";
}

export function setToken(token) {
  if (token) localStorage.setItem("token", String(token));
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

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/login") window.location.href = "/login";
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
      // backend nekad vrati json bez content-type
      const t = text.trim();
      if (
        (t.startsWith("{") && t.endsWith("}")) ||
        (t.startsWith("[") && t.endsWith("]"))
      ) {
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

function looksLikeNgrokHtml(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return t.includes("<html") && t.includes("ngrok");
}

/* ================= ENV / NGROK HEADER =================
   ❌ ngrok-skip-browser-warning u production browseru pravi CORS preflight fail
   ✅ šalji ga SAMO kad si lokalno na localhost
======================================================== */
const IS_BROWSER = typeof window !== "undefined";
const HOST = IS_BROWSER ? String(window.location.hostname) : "";
const IS_LOCALHOST = HOST === "localhost" || HOST === "127.0.0.1";

function shouldSendNgrokSkipHeader() {
  return IS_BROWSER && IS_LOCALHOST;
}

/* ================= CORE REQUEST (TOKEN-ONLY) ================= */
export async function request(path, options = {}) {
  const token = getToken();
  const method = String(options.method || "GET").toUpperCase();

  // zabrani da neko prosledi credentials/mode i sjebe CORS
  const { credentials, mode, headers: extraHeaders, body, ...rest } = options;

  const hasBody = body !== undefined && body !== null;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
  const isString = typeof body === "string";

  const finalBody =
    !hasBody ? undefined : (isForm || isBlob || isString) ? body : JSON.stringify(body);

  const headers = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(hasBody && !(isForm || isBlob) && !isString ? { "Content-Type": "application/json" } : {}),
    ...(extraHeaders || {}),
  };

  // ✅ only local dev (optional)
  if (shouldSendNgrokSkipHeader()) {
    headers["ngrok-skip-browser-warning"] = "true";
  }

  let res;
  try {
    res = await fetch(apiUrl(path), {
      ...rest,
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : finalBody,
      credentials: "omit", // ✅ ALWAYS token-only
      mode: "cors",
    });
  } catch (e) {
    // pravi “NetworkError when attempting to fetch resource.”
    throw new Error(e?.message || "NetworkError when attempting to fetch resource.");
  }

  const { json, text, contentType } = await readResponse(res);

  if (looksLikeNgrokHtml(text)) {
    throw new Error(
      `NGROK returned HTML instead of API response. Check ngrok + VITE_API_URL.\nURL: ${apiUrl(path)}`
    );
  }

  if (res.status === 401) {
    clearAuthLocal();
    redirectToLogin();
    throw new Error(pickErrorMessage(json, "Unauthorized"));
  }

  if (!res.ok) {
    const fallbackText =
      contentType.includes("text") || contentType.includes("html")
        ? (text || "").slice(0, 300)
        : "";
    throw new Error(pickErrorMessage(json, fallbackText, `Request failed (${res.status})`));
  }

  if (json !== null) return json;
  if (text) return { text };
  return null;
}

/* plain text helper */
export async function requestText(path, options = {}) {
  const token = getToken();
  const method = String(options.method || "GET").toUpperCase();

  const { headers: extraHeaders, ...rest } = options;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders || {}),
  };

  const res = await fetch(apiUrl(path), {
    ...rest,
    method,
    headers,
    credentials: "omit",
    mode: "cors",
  });

  const text = await res.text().catch(() => "");

  if (res.status === 401) {
    clearAuthLocal();
    redirectToLogin();
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(text || "Request failed");
  return text;
}

/* ================= API WRAPPER ================= */
function extractToken(out) {
  const t =
    out?.token ||
    out?.accessToken ||
    out?.access_token ||
    out?.data?.token ||
    out?.data?.accessToken ||
    out?.data?.access_token;
  return t ? String(t) : "";
}

function extractUser(out) {
  return out?.user || out?.data?.user || null;
}

export const api = {
  /* generic */
  get: (p) => request(p),
  post: (p, b) => request(p, { method: "POST", body: b }),
  put: (p, b) => request(p, { method: "PUT", body: b }),
  patch: (p, b) => request(p, { method: "PATCH", body: b }),
  del: (p, b) => request(p, { method: "DELETE", body: b }),

  /* misc */
  health: () => requestText("/health"),
  root: () => request("/"),

  /* auth */
  me: () => request("/api/me"),

  login: async (payload) => {
    const out = await request("/auth/login", { method: "POST", body: payload });

    const t = extractToken(out);
    if (t) setToken(t);

    const u = extractUser(out);
    if (u) {
      setUser(u);
      if (u.role) setRole(u.role);
    }

    return out;
  },

  register: async (payload) => {
    const out = await request("/auth/register", { method: "POST", body: payload });

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

  /* services */
  servicesPublic: () => request("/services"),
  servicesAdmin: () => request("/admin/services"),

  createService: (payload) => request("/admin/services", { method: "POST", body: payload }),
  updateService: (id, payload) => request(`/admin/services/${id}`, { method: "PUT", body: payload }),
  toggleService: (id) => request(`/admin/services/${id}/toggle`, { method: "PATCH" }),

  /* orders */
  createOrder: (payload) => request("/orders", { method: "POST", body: payload }),
  myOrders: () => request("/orders"),

  /* wallet */
  wallet: () => request("/wallet"),

  /* paypal */
  paypalCreate: (payload) => request("/payments/paypal/create", { method: "POST", body: payload }),
  paypalCapture: (payload) => request("/payments/paypal/capture", { method: "POST", body: payload }),
};

