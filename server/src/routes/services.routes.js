import { Router } from "express";
import { Service } from "../models/Service.js";

const router = Router();

/**
 * GET /services
 * query:
 *  - platform (instagram|tiktok|...)
 *  - type (followers|likes|...)
 *  - q (search)
 *  - enabled (default true)
 */
router.get("/", async (req, res, next) => {
  try {
    const platform = String(req.query.platform || "").trim().toLowerCase();
    const type = String(req.query.type || "").trim().toLowerCase();
    const q = String(req.query.q || "").trim();
    const enabled = req.query.enabled === "false" ? undefined : true; // default only enabled

    const filter = {};
    if (enabled !== undefined) filter.enabled = enabled;
    if (platform) filter.platform = platform;
    if (type) filter.type = type;

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    const services = await Service.find(filter).sort({ platform: 1, type: 1, pricePer1000: 1 });
    res.json(services);
  } catch (e) {
    next(e);
  }
});

export default router;
