// client/src/lib/api.js

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ================= URL HELPERS ================= */
export function apiUrl(path = "") {
  // path mora počinjati sa "/"
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API}${p}`;
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

// Vrati { json, text, contentType }
async function readResponse(res) {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();

  // prvo probaj text (radi i za json i za html)
  let text = "";
  try {
    text = await res.text();
  } catch {
    text = "";
  }

  // ako je json, probaj parse
  let json = null;
  if (text) {
    if (contentType.includes("application/json")) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    } else {
      // nekad backend vrati json bez content-type; probaj heuristiku
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
  // ngrok error/warning pages su HTML + imaju "ngrok"
  return t.includes("<html") && t.includes("ngrok");
}

/* ================= CORE REQUEST (HARD TOKEN-ONLY) ================= */
export async function request(path, options = {}) {
  const token = getToken();
  const method = String(options.method || "GET").toUpperCase();

  // HARD: zabrani da iko prosledi credentials/mode koji sjebe CORS
  const { credentials, mode, headers: extraHeaders, body, ...rest } = options;

  const hasBody = body !== undefined && body !== null;

  // ako je body plain object -> JSON.stringify
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
    // ngrok: preskoči warning page (ne smeta ni kad nije ngrok)
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(hasBody && !(isForm || isBlob) && !isString ? { "Content-Type": "application/json" } : {}),
    ...(extraHeaders || {}),
  };

  const res = await fetch(apiUrl(path), {
    ...rest,
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : finalBody,
    credentials: "omit", // ✅ ALWAYS token-only
    mode: "cors",
  });

  const { json, text, contentType } = await readResponse(res);

  // Ako ngrok vrati HTML (warning/error page), objasni lepo
  if (looksLikeNgrokHtml(text)) {
    throw new Error(
      `NGROK returned HTML instead of API response. Check that ngrok is running and forwarding to localhost:5000, and that VITE_API_URL is correct.\n` +
        `URL: ${apiUrl(path)}`
    );
  }

  // 401 -> očisti auth i baci error
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

  // Ako backend vrati text (npr. "ok") a ne json
  if (json !== null) return json;
  if (text) return { text };

  return null;
}

/* ================= API WRAPPER ================= */
export const api = {
  get: (p) => request(p),

  // možeš slati objekat direktno (ne mora JSON.stringify)
  post: (p, b) => request(p, { method: "POST", body: b }),
  put: (p, b) => request(p, { method: "PUT", body: b }),
  patch: (p, b) => request(p, { method: "PATCH", body: b }),
  del: (p, b) => request(p, { method: "DELETE", body: b }),

  me: () => request("/api/me"),

  // login/register: očekujem { token, user } ali radi i ako vrati samo token
  login: async (payload) => {
    const out = await request("/auth/login", { method: "POST", body: payload });
    if (out?.token) setToken(out.token);
    if (out?.user) {
      setUser(out.user);
      if (out.user.role) setRole(out.user.role);
    }
    return out;
  },

  register: async (payload) => {
    const out = await request("/auth/register", { method: "POST", body: payload });
    if (out?.token) setToken(out.token);
    if (out?.user) {
      setUser(out.user);
      if (out.user.role) setRole(out.user.role);
    }
    return out;
  },

  logoutLocal: () => {
    clearAuthLocal();
    redirectToLogin();
  },
};

