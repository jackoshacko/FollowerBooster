// server/src/services/provider/providerApi.js
import { createSmmV2Client } from "./smmv2Api.js";

// =====================
// env helpers
// =====================
function env(name, fallback = "") {
  return process.env[name] || fallback;
}

function isLiveMode() {
  return env("PROVIDER_MODE", "mock") === "live";
}

function getProviderName() {
  return String(env("PROVIDER_NAME", "smmprovider")).trim().toLowerCase();
}

function getLiveClient() {
  if (!isLiveMode()) return null;

  const name = getProviderName();
  const baseUrl = env("PROVIDER_BASE_URL");
  const apiKey = env("PROVIDER_API_KEY");

  if (!baseUrl) throw new Error("PROVIDER_BASE_URL missing");
  if (!apiKey) throw new Error("PROVIDER_API_KEY missing");

  const supported = new Set(["smmprovider", "smmfollows", "lionfollow", "cheapest", "panel"]);
  if (!supported.has(name)) {
    console.warn(`⚠️ Unknown PROVIDER_NAME=${name}. Using generic SMM v2 client anyway.`);
  }

  return createSmmV2Client({ baseUrl, apiKey });
}

// =====================
// error helper
// =====================
function providerError(message, code, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

function extractProviderMessage(e) {
  const p = e?.providerPayload;
  if (typeof p === "string") return p;
  if (p && typeof p === "object") {
    return (
      p?.error ||
      p?.message ||
      p?.msg ||
      p?.errors?.[0] ||
      JSON.stringify(p).slice(0, 400)
    );
  }
  return e?.message || "Provider error";
}

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function str(x) {
  return String(x ?? "").trim();
}

// provider status normalization (live compatibility)
function normalizeStatus(x) {
  const s = str(x).toLowerCase();
  if (!s) return "processing";

  // completed synonyms
  if (["completed", "complete", "success", "succeeded", "done", "finished"].includes(s)) return "completed";

  // failed synonyms
  if (["failed", "fail", "error", "rejected"].includes(s)) return "failed";

  // canceled synonyms -> treat as failed (or you can return "canceled" if you support it)
  if (["canceled", "cancelled"].includes(s)) return "failed";

  // in progress
  if (s.includes("progress") || s.includes("in progress") || s.includes("processing") || s.includes("active")) {
    return "processing";
  }

  return "processing";
}

// extract provider order id from various response formats
function extractProviderOrderId(out) {
  const id =
    out?.providerOrderId ??
    out?.orderId ??
    out?.order ??
    out?.order_id ??
    out?.id ??
    out?.data?.order ??
    out?.data?.orderId ??
    out?.data?.order_id ??
    out?.data?.id ??
    "";

  return str(id);
}

// =====================
// API
// =====================

export async function providerListServices() {
  if (!isLiveMode()) return [];

  const client = getLiveClient();

  let out;
  try {
    out = await client.services();
  } catch (e) {
    throw providerError(extractProviderMessage(e), e?.code || "PROVIDER_ERROR", {
      httpStatus: e?.httpStatus,
      providerPayload: e?.providerPayload,
    });
  }

  if (Array.isArray(out)) return out;
  if (out && Array.isArray(out.services)) return out.services;

  throw providerError("Provider services response not array", "PROVIDER_BAD_SERVICES_RESPONSE", {
    providerPayload: out,
  });
}

/**
 * CREATE ORDER on provider (SMM API v2)
 * ACCEPTS: externalServiceId OR providerServiceId OR service
 */
export async function providerCreateOrder({
  externalServiceId,
  providerServiceId,
  service, // alias
  link,
  quantity,
  meta,
}) {
  // MOCK
  if (!isLiveMode()) {
    const fake = `mock_${Date.now()}`;
    return { providerOrderId: fake, raw: { order: fake } };
  }

  const providerSvcId = externalServiceId || providerServiceId || service;

  if (!providerSvcId) {
    throw providerError(
      "Missing provider service id (externalServiceId/providerServiceId/service)",
      "MISSING_PROVIDER_SERVICE_ID"
    );
  }

  if (!link || typeof link !== "string" || !str(link)) {
    throw providerError("Missing/invalid link", "INVALID_LINK");
  }

  const qty = toNumber(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw providerError("Missing/invalid quantity", "INVALID_QUANTITY");
  }

  const runs = meta?.runs;
  const interval = meta?.interval;

  const client = getLiveClient();

  let out;
  try {
    out = await client.addOrder({
      service: str(providerSvcId),
      link: str(link),
      quantity: String(Math.round(qty)),
      ...(runs != null ? { runs } : {}),
      ...(interval != null ? { interval } : {}),
    });
  } catch (e) {
    console.error("🔥 Provider addOrder FAILED:", extractProviderMessage(e));
    if (e?.providerPayload) console.error("🔥 Provider payload:", e.providerPayload);

    throw providerError(extractProviderMessage(e), e?.code || "PROVIDER_ERROR", {
      httpStatus: e?.httpStatus,
      providerPayload: e?.providerPayload,
    });
  }

  const providerOrderId = extractProviderOrderId(out);

  if (!providerOrderId) {
    console.error("🔥 Provider addOrder response (no order id):", out);
    throw providerError("Provider did not return order id", "PROVIDER_NO_ORDER_ID", {
      providerPayload: out,
    });
  }

  return { providerOrderId, raw: out };
}

/**
 * GET STATUS from provider
 * ✅ Accepts:
 * - providerGetStatus("123")
 * - providerGetStatus({ providerOrderId: "123" })
 */
export async function providerGetStatus(arg) {
  const providerOrderId = typeof arg === "string" ? arg : arg?.providerOrderId;

  if (!isLiveMode()) {
    return {
      status: "completed",
      charge: "0",
      startCount: null,
      remains: "0",
      raw: { status: "completed" },
    };
  }

  if (!str(providerOrderId)) {
    throw providerError("Missing providerOrderId", "MISSING_PROVIDER_ORDER_ID");
  }

  const client = getLiveClient();

  let out;

  // ✅ fallback: some panels expect { order }, some { orderId }
  try {
    out = await client.status({ orderId: str(providerOrderId) });

    // if response is empty or has no status, fallback to { order }
    if (!out || (typeof out === "object" && !out.status)) {
      out = await client.status({ order: str(providerOrderId) });
    }
  } catch (e) {
    // fallback attempt with { order }
    try {
      out = await client.status({ order: str(providerOrderId) });
    } catch (e2) {
      console.error("🔥 Provider status FAILED:", extractProviderMessage(e2));
      if (e2?.providerPayload) console.error("🔥 Provider payload:", e2.providerPayload);

      throw providerError(extractProviderMessage(e2), e2?.code || "PROVIDER_ERROR", {
        httpStatus: e2?.httpStatus,
        providerPayload: e2?.providerPayload,
      });
    }
  }

  const normalized = normalizeStatus(out?.status);

  return {
    status: normalized,
    charge: out?.charge ?? null,
    startCount: out?.start_count ?? null,
    remains: out?.remains ?? null,
    raw: out,
  };
}

export async function providerBalance() {
  if (!isLiveMode()) return { balance: null, currency: null, raw: null };

  const client = getLiveClient();

  let out;
  try {
    out = await client.balance();
  } catch (e) {
    console.error("🔥 Provider balance FAILED:", extractProviderMessage(e));
    if (e?.providerPayload) console.error("🔥 Provider payload:", e.providerPayload);

    throw providerError(extractProviderMessage(e), e?.code || "PROVIDER_ERROR", {
      httpStatus: e?.httpStatus,
      providerPayload: e?.providerPayload,
    });
  }

  return {
    balance: out?.balance ?? null,
    currency: out?.currency ?? null,
    raw: out,
  };
}
