// server/src/services/provider/smmv2Api.js
import fetch from "node-fetch";

function providerError(message, code, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

function clean(s) {
  return String(s ?? "").trim();
}

function parseLoose(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;

  // JSON?
  try {
    return JSON.parse(t);
  } catch {}

  // form-like: error=Invalid+API+key
  try {
    const params = new URLSearchParams(t);
    if ([...params.keys()].length > 0) {
      const obj = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      return obj;
    }
  } catch {}

  // fallback
  return { raw: t };
}

// heuristika: prepoznaj provider error poruke čak i kad nije JSON
function detectProviderError(payload) {
  if (!payload) return null;

  // JSON standard: { error: "..." }
  if (typeof payload === "object") {
    if (payload.error) return String(payload.error);

    // neke varijante: { errors: [...] } ili { message: "..." }
    if (Array.isArray(payload.errors) && payload.errors.length) {
      return payload.errors.map(String).join("; ");
    }
    if (payload.message && /error|invalid|denied|unauthorized/i.test(String(payload.message))) {
      return String(payload.message);
    }

    // form decoded: { error: "..."} ili { Error: "..."}
    if (payload.Error) return String(payload.Error);

    // raw string fallback
    if (payload.raw && typeof payload.raw === "string") {
      const raw = payload.raw;
      // tipično: "Invalid API key" / "Incorrect request" / HTML error pages
      if (/invalid api key|incorrect request|unauthorized|forbidden|access denied/i.test(raw)) {
        return raw.slice(0, 500);
      }
    }
  }

  return null;
}

export function createSmmV2Client({ baseUrl, apiKey, timeoutMs = 20000 }) {
  const BASE = clean(baseUrl).replace(/\/+$/, "");
  const KEY = clean(apiKey);

  if (!BASE) throw new Error("createSmmV2Client: baseUrl missing");
  if (!KEY) throw new Error("createSmmV2Client: apiKey missing");

  async function call(action, params = {}) {
    const body = new URLSearchParams({
      key: KEY,
      action,
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, v == null ? "" : String(v)])
      ),
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    let text = "";
    try {
      res = await fetch(BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json, text/plain, */*",
          "User-Agent": "FollowerBooster API",
        },
        body,
        signal: controller.signal,
      });

      text = await res.text();
    } catch (e) {
      clearTimeout(timer);

      // timeout / abort
      if (e?.name === "AbortError") {
        throw providerError(`Provider timeout after ${timeoutMs}ms`, "PROVIDER_TIMEOUT", {
          httpStatus: null,
          providerPayload: { raw: text || null },
        });
      }

      throw providerError(`Provider network error: ${e?.message || "fetch failed"}`, "PROVIDER_NETWORK_ERROR", {
        httpStatus: null,
        providerPayload: { raw: text || null },
      });
    } finally {
      clearTimeout(timer);
    }

    const payload = parseLoose(text);

    // 1) HTTP error
    if (!res.ok) {
      throw providerError(`Provider HTTP ${res.status}`, "PROVIDER_HTTP_ERROR", {
        httpStatus: res.status,
        providerPayload: payload,
      });
    }

    // 2) logical provider error even on 200
    const pErr = detectProviderError(payload);
    if (pErr) {
      // mnogi paneli šalju 200 + "Invalid API key"
      // ovde ga tretiramo kao provider error
      throw providerError(`Provider error: ${pErr}`, "PROVIDER_ERROR", {
        httpStatus: res.status,
        providerPayload: payload,
      });
    }

    // 3) sometimes provider returns empty
    if (payload == null) {
      throw providerError("Provider returned empty response", "PROVIDER_EMPTY_RESPONSE", {
        httpStatus: res.status,
        providerPayload: null,
      });
    }

    return payload;
  }

  return {
    services: () => call("services"),
    balance: () => call("balance"),
    addOrder: ({ service, link, quantity, runs, interval }) =>
      call("add", { service, link, quantity, runs, interval }),
    status: ({ orderId }) => call("status", { order: orderId }),
    // bonus: multi status
    multiStatus: ({ orderIds }) => call("status", { orders: orderIds }),
  };
}

