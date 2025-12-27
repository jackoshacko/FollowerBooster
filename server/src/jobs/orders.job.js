// server/src/jobs/orders.job.js
import { Order } from "../models/Order.js";
import { Service } from "../models/Service.js";
import { providerCreateOrder, providerGetStatus } from "../services/provider/providerApi.js";

let timer = null;
let inFlight = false;

function s(x) {
  return String(x ?? "").trim();
}

/**
 * Provider statuses are messy:
 * - "Completed" / "completed" / "success"
 * - "In progress" / "in_progress" / "processing" / "active"
 * - "Canceled" / "cancelled" / "refunded"
 *
 * We normalize to buckets:
 * - pending | processing | completed | failed
 */
function normStatus(raw) {
  const x = s(raw).toLowerCase().replace(/[\s\-]+/g, "_");

  // ✅ completed aliases
  if (
    [
      "completed",
      "success",
      "successful",
      "done",
      "finished",
      "complete",
      "completed_successfully",
    ].includes(x)
  ) {
    return "completed";
  }

  // ✅ failed aliases
  if (
    [
      "failed",
      "fail",
      "error",
      "canceled",
      "cancelled",
      "canceled_by_user",
      "cancelled_by_user",
      "refunded",
      "refund",
      "rejected",
      "declined",
    ].includes(x)
  ) {
    return "failed";
  }

  // ✅ pending aliases
  if (["pending", "queued", "queue", "waiting", "created", "new"].includes(x)) {
    return "pending";
  }

  // ✅ processing aliases
  if (
    [
      "processing",
      "in_progress",
      "inprogress",
      "active",
      "progress",
      "running",
      "in_process",
      "inprocess",
      "partial",
      "partially_completed",
      "started",
    ].includes(x)
  ) {
    return "processing";
  }

  // default safe
  return "processing";
}

export function startOrdersJob({ intervalMs = 5000 } = {}) {
  if (timer) return;

  timer = setInterval(async () => {
    if (inFlight) return;
    inFlight = true;

    try {
      // ==========================================
      // 1) DISPATCH 1 pending order (no providerOrderId)
      // ==========================================
      const pending = await Order.findOne({
        status: "pending",
        $or: [
          { providerOrderId: null },
          { providerOrderId: "" },
          { providerOrderId: { $exists: false } },
        ],
      }).sort({ createdAt: 1 });

      if (pending) {
        const service = await Service.findById(pending.serviceId).lean();

        if (!service) {
          pending.status = "failed";
          pending.lastError = "SERVICE_NOT_FOUND";
          await pending.save();
          return;
        }

        // providerCreateOrder expects: externalServiceId + link + quantity (+meta)
        let resp;
        try {
          resp = await providerCreateOrder({
            externalServiceId: service.externalServiceId,
            link: pending.link,
            quantity: pending.quantity,
            meta: { reference: pending._id.toString() },
          });
        } catch (e) {
          pending.status = "failed";
          pending.lastError = `PROVIDER_CREATE_ERROR:${s(e?.message || e)}`.slice(0, 180);
          pending.providerStatus = null;
          await pending.save();
          return;
        }

        const providerOrderId = s(resp?.providerOrderId);

        if (!providerOrderId) {
          pending.status = "failed";
          pending.lastError = "PROVIDER_MISSING_ORDER_ID";
          pending.providerStatus = null;
          await pending.save();
          return;
        }

        pending.providerOrderId = providerOrderId;

        // initial state
        pending.providerStatus = "processing";
        pending.status = "processing";
        pending.lastError = null;

        await pending.save();
        return;
      }

      // ==========================================
      // 2) SYNC 1 "active-ish" order
      // (processing OR pending with providerOrderId OR inconsistent states)
      // ==========================================
      const syncCandidate = await Order.findOne({
        // do not touch final states
        status: { $in: ["pending", "processing"] },
        providerOrderId: { $exists: true, $nin: [null, ""] },
      }).sort({ updatedAt: 1 });

      if (!syncCandidate) return;

      const providerOrderId = s(syncCandidate.providerOrderId);
      if (!providerOrderId) return;

      let st;
      try {
        st = await providerGetStatus({ providerOrderId });
      } catch (e) {
        syncCandidate.lastError = `PROVIDER_STATUS_ERROR:${s(e?.message || e)}`.slice(0, 180);
        await syncCandidate.save();
        return;
      }

      const providerStatusRaw = s(st?.status) || s(syncCandidate.providerStatus) || "processing";
      const mapped = normStatus(providerStatusRaw);

      // keep BOTH
      syncCandidate.providerStatus = providerStatusRaw;
      syncCandidate.status = mapped;

      if (mapped === "completed" && !syncCandidate.completedAt) {
        syncCandidate.completedAt = new Date();
      }

      syncCandidate.lastError = null;
      await syncCandidate.save();
    } catch (e) {
      console.error("[orders.job] error:", e?.message || e);
    } finally {
      inFlight = false;
    }
  }, intervalMs);

  console.log(`[orders.job] started interval=${intervalMs}ms`);
}

export function stopOrdersJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[orders.job] stopped");
  }
}

