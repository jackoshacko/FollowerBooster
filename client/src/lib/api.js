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
export function clearAuthLocal() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
}
function redirectToLogin() {
  if (window.location.pathname !== "/login") window.location.href = "/login";
}

/* ================= CORE PARSERS ================= */
async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}
async function safeText(res) {
  try { return await res.text(); } catch { return ""; }
}
function pickErrorMessage(json, textFallback = "") {
  return json?.message || json?.error || textFallback || "Request failed";
}

/* ================= CORE REQUEST (TOKEN-ONLY) ================= */
export async function request(path, options = {}) {
  const token = getToken();
  const method = (options.method || "GET").toUpperCase();
  const hasBody = options.body != null;

  // ⚠️ HARD: ne dozvoli da neko prosledi credentials include
  const { credentials, ...rest } = options;

  const headers = {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(rest.headers || {}),
  };

  const res = await fetch(apiUrl(path), {
    ...rest,
    method,
    headers,
    credentials: "omit", // ✅ ALWAYS
    mode: "cors",
  });

  const data = await safeJson(res);
  const text = data === null ? await safeText(res) : "";

  if (res.status === 401) {
    clearAuthLocal();
    redirectToLogin();
    throw new Error(pickErrorMessage(data, "Unauthorized"));
  }

  if (!res.ok) {
    throw new Error(pickErrorMessage(data, text));
  }

  return data ?? (text ? { text } : {});
}

export const api = {
  get: (p) => request(p),
  post: (p, b) => request(p, { method: "POST", body: JSON.stringify(b) }),
  put: (p, b) => request(p, { method: "PUT", body: JSON.stringify(b) }),
  del: (p) => request(p, { method: "DELETE" }),

  me: () => request("/api/me"),

  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),

  logoutLocal: () => {
    clearAuthLocal();
    redirectToLogin();
  },
};
