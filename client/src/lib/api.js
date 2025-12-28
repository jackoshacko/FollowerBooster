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

function looksLikeNgrokHtml(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return t.includes("<html") && t.includes("ngrok");
}

/* ================= ENV / NGROK HEADER ================= */
// ❌ ngrok-skip-browser-warning u browseru pravi CORS preflight probleme.
// ✅ Dozvoli ga samo u lokalnom devu, i samo ako si ti baš na localhost-u.
const IS_BROWSER = typeof window !== "undefined";
const HOST = IS_BROWSER ? String(window.location.hostname) : "";
const IS_VERCEL = HOST.includes("vercel.app");

function shouldSendNgrokSkipHeader() {
  if (!IS_BROWSER) return false;
  if (IS_VERCEL) return false; // NEVER on vercel/prod
  const isLocalHost = HOST === "localhost" || HOST === "127.0.0.1";
  return isLocalHost; // only local dev
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
    !hasBody
      ? undefined
      : isForm || isBlob || isString
      ? body
      : JSON.stringify(body);

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

  const res = await fetch(apiUrl(path), {
    ...rest,
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : finalBody,
    credentials: "omit", // ✅ ALWAYS token-only
    mode: "cors",
  });

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
      contentType.includes("text") || contentType.includes("html") ? (text || "").slice(0, 300) : "";
    throw new Error(pickErrorMessage(json, fallbackText, `Request failed (${res.status})`));
  }

  if (json !== null) return json;
  if (text) return { text };
  return null;
}

/* ================= API WRAPPER ================= */
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

export const api = {
  get: (p) => request(p),
  post: (p, b) => request(p, { method: "POST", body: b }),
  put: (p, b) => request(p, { method: "PUT", body: b }),
  patch: (p, b) => request(p, { method: "PATCH", body: b }),
  del: (p, b) => request(p, { method: "DELETE", body: b }),

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
};

