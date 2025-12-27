// client/src/api.js
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export function setToken(token) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

export function getToken() {
  return localStorage.getItem("token") || "";
}

export function setUser(user) {
  if (user) localStorage.setItem("user", JSON.stringify(user));
  else localStorage.removeItem("user");
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

let refreshing = null;

async function refreshAccessToken() {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const res = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Refresh failed");

    if (data?.accessToken) setToken(data.accessToken);
    return data?.accessToken;
  })();

  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

async function request(path, options = {}, retry = true) {
  const token = getToken();

  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && retry) {
    try {
      await refreshAccessToken();
      return request(path, options, false);
    } catch (e) {
      setToken("");
      setUser(null);
      if (window.location.pathname !== "/login") window.location.href = "/login";
      throw e;
    }
  }

  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, b) => request(p, { method: "POST", body: JSON.stringify(b) }),
  put: (p, b) => request(p, { method: "PUT", body: JSON.stringify(b) }),
  del: (p) => request(p, { method: "DELETE" }),
};
