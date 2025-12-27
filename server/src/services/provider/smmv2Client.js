import fetch from "node-fetch";

export function createSmmV2Client({ baseUrl, apiKey }) {
  async function call(action, data = {}) {
    const body = new URLSearchParams({ key: apiKey, action, ...data }).toString();

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }

    if (!res.ok) {
      const err = new Error(`Provider HTTP ${res.status}`);
      err.httpStatus = res.status;
      err.providerPayload = json;
      throw err;
    }

    // neki paneli vraćaju error u JSON-u i sa 200
    if (json && typeof json === "object" && json.error) {
      const err = new Error(String(json.error));
      err.code = "PROVIDER_ERROR";
      err.providerPayload = json;
      throw err;
    }

    return json;
  }

  return {
    services: () => call("services"),
    balance: () => call("balance"),
    addOrder: ({ service, link, quantity, runs, interval }) =>
      call("add", { service, link, quantity, ...(runs ? { runs } : {}), ...(interval ? { interval } : {}) }),
    status: ({ orderId }) => call("status", { order: orderId }),
  };
}
