import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { Service } from "../models/Service.js";

const router = Router();

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  return next();
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function safeNumber(x, fallback = null) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * GET /admin/services
 * returns ALL services (enabled + disabled)
 */
router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const list = await Service.find({}).sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /admin/services
 */
router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};
    const doc = await Service.create({
      name: b.name,
      description: b.description || "",
      platform: (b.platform || "other").toLowerCase(),
      type: (b.type || "other").toLowerCase(),
      category: b.category || "Other",
      pricePer1000: Number(b.pricePer1000),
      min: Number(b.min || 1),
      max: Number(b.max || 1000000),
      provider: b.provider || "default",
      providerServiceId: b.providerServiceId || "",
      enabled: b.enabled !== false,
    });

    res.json(doc);
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /admin/services/:id
 */
router.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};
    const updated = await Service.findByIdAndUpdate(
      req.params.id,
      {
        ...(b.name != null ? { name: b.name } : {}),
        ...(b.description != null ? { description: b.description } : {}),
        ...(b.platform != null ? { platform: String(b.platform).toLowerCase() } : {}),
        ...(b.type != null ? { type: String(b.type).toLowerCase() } : {}),
        ...(b.category != null ? { category: b.category } : {}),
        ...(b.pricePer1000 != null ? { pricePer1000: round2(Number(b.pricePer1000)) } : {}),
        ...(b.min != null ? { min: Number(b.min) } : {}),
        ...(b.max != null ? { max: Number(b.max) } : {}),
        ...(b.provider != null ? { provider: b.provider } : {}),
        ...(b.providerServiceId != null ? { providerServiceId: b.providerServiceId } : {}),
        ...(b.enabled != null ? { enabled: !!b.enabled } : {}),
      },
      { new: true }
    );

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /admin/services/:id/toggle
 */
router.post("/:id/toggle", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const s = await Service.findById(req.params.id);
    if (!s) return res.status(404).json({ message: "Service not found" });

    s.enabled = !s.enabled;
    await s.save();
    res.json(s);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /admin/services/reprice
 * Body:
 * {
 *   allMultiplier?: number,        // e.g. 0.5 (50% cheaper)
 *   viewsMultiplier?: number,      // e.g. 0.3333333 (views /3)
 *   roundTo?: number              // default 2 decimals
 *   filter?: { platform?, type?, enabled? }  // optional filter
 * }
 *
 * Applies:
 * - for ALL matched services: pricePer1000 *= allMultiplier (if provided)
 * - for type=views matched: pricePer1000 *= viewsMultiplier (if provided)
 */
router.post("/reprice", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};
    const allMultiplier = safeNumber(b.allMultiplier, null);
    const viewsMultiplier = safeNumber(b.viewsMultiplier, null);
    const roundTo = Number.isFinite(Number(b.roundTo)) ? Number(b.roundTo) : 2;

    const filter = b.filter || {};
    const q = {};
    if (filter.platform) q.platform = String(filter.platform).toLowerCase();
    if (filter.type) q.type = String(filter.type).toLowerCase();
    if (filter.enabled === true) q.enabled = true;
    if (filter.enabled === false) q.enabled = false;

    const list = await Service.find(q);

    let touched = 0;
    for (const s of list) {
      let p = Number(s.pricePer1000 || 0);

      if (allMultiplier != null) p = p * allMultiplier;
      if (viewsMultiplier != null && String(s.type) === "views") p = p * viewsMultiplier;

      // rounding
      const factor = Math.pow(10, roundTo);
      p = Math.round(p * factor) / factor;

      // avoid negative / NaN
      if (!Number.isFinite(p) || p < 0) p = 0;

      s.pricePer1000 = p;
      await s.save();
      touched++;
    }

    res.json({ ok: true, matched: list.length, updated: touched });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /admin/services/bulk
 * Body:
 * {
 *   ids?: string[],                     // optional
 *   filter?: { platform?, type?, q? },  // optional search
 *   patch: { pricePer1000?, min?, max?, enabled?, category?, platform?, type? }
 * }
 * - If ids provided -> update those
 * - Else filter -> update many
 */
router.post("/bulk", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};
    const patch = b.patch || {};
    if (!patch || Object.keys(patch).length === 0) {
      return res.status(400).json({ message: "Missing patch" });
    }

    const query = {};
    if (Array.isArray(b.ids) && b.ids.length) {
      query._id = { $in: b.ids };
    } else if (b.filter) {
      const f = b.filter || {};
      if (f.platform) query.platform = String(f.platform).toLowerCase();
      if (f.type) query.type = String(f.type).toLowerCase();
      if (f.enabled === true) query.enabled = true;
      if (f.enabled === false) query.enabled = false;

      if (f.q) {
        const qq = String(f.q).trim();
        if (qq) {
          query.$or = [
            { name: new RegExp(qq, "i") },
            { category: new RegExp(qq, "i") },
            { platform: new RegExp(qq, "i") },
            { type: new RegExp(qq, "i") },
          ];
        }
      }
    }

    const update = {};
    if (patch.name != null) update.name = patch.name;
    if (patch.description != null) update.description = patch.description;
    if (patch.category != null) update.category = patch.category;
    if (patch.platform != null) update.platform = String(patch.platform).toLowerCase();
    if (patch.type != null) update.type = String(patch.type).toLowerCase();
    if (patch.pricePer1000 != null) update.pricePer1000 = round2(Number(patch.pricePer1000));
    if (patch.min != null) update.min = Number(patch.min);
    if (patch.max != null) update.max = Number(patch.max);
    if (patch.enabled != null) update.enabled = !!patch.enabled;

    const out = await Service.updateMany(query, { $set: update });
    res.json({ ok: true, matched: out.matchedCount ?? out.n ?? 0, modified: out.modifiedCount ?? out.nModified ?? 0 });
  } catch (e) {
    next(e);
  }
});

export default router;
