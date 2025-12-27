// server/src/services/provider/lionfollowApi.js
import fetch from "node-fetch";

function providerError(message, code, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

function envStr(x) {
  return String(x ?? "").trim();
}

function joinUrl(base, path = "") {
  const b = envStr(base).replace(/\/+$/, "");
  const p = envStr(path).replace(/^\/+/, "");
  return p ? `${b}/${p}` : b;
}

/**
 * LionFollow / SMM API v2 client
 * EXPECTS:
 *  - baseUrl: https://lionfollow.com/api/v2
 *  - apiKey: string
 * SENDS:
 *  - POST x-www-form-urlencoded
 *  - body: key=...&action=services ...
 */
export function createLionFollowClient({ baseUrl, apiKey }) {
  const BASE = envStr(baseUrl);
  const KEY = envStr(apiKey);

  if (!BASE) throw providerError("LionFollow baseUrl missing", "PROVIDER_CONFIG");
  if (!KEY) throw providerError("LionFollow apiKey missing", "PROVIDER_CONFIG");

  async function call(action, params = {}) {
    const url = joinUrl(BASE); // SMM v2 je endpoint baseUrl sam po sebi

    const body = new URLSearchParams({
      key: KEY,
      action,
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, v == null ? "" : String(v)])
      ),
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json, text/plain, */*",
      },
      body,
    });

    const text = await res.text();

    // pokušaj JSON parse
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // neki provideri vrate plain text kad fail
      throw providerError("Provider response not JSON", "PROVIDER_NON_JSON", {
        httpStatus: res.status,
        providerPayload: text,
        url,
        action,
      });
    }

    // HTTP error (401/403/etc)
    if (!res.ok) {
      throw providerError(`Provider HTTP ${res.status}`, "PROVIDER_HTTP_ERROR", {
        httpStatus: res.status,
        providerPayload: json,
        url,
        action,
      });
    }

    // SMM API često vraća { error: "Invalid API key" }
    if (json && typeof json === "object" && json.error) {
      throw providerError(`Provider error: ${json.error}`, "PROVIDER_ERROR", {
        providerPayload: json,
        url,
        action,
      });
    }

    return json;
  }

  return {
    services: () => call("services"),
    balance: () => call("balance"),
    addOrder: ({ service, link, quantity, runs, interval }) =>
      call("add", { service, link, quantity, runs, interval }),
    status: ({ orderId }) => call("status", { order: orderId }),
  };
}
