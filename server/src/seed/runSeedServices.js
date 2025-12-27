import mongoose from "mongoose";
import "dotenv/config";
import { Service } from "../models/Service.js";

const MONGO_URI = process.env.MONGO_URI;

/* ===========================
   CONFIG (profit & discounts)
   =========================== */

// PROFIT multiplier (default 3)
const PROFIT_X = Number(process.env.SEED_PROFIT_X || 3);

// Global discount: everything /2 (50% off)
const DISCOUNT_ALL_X = Number(process.env.SEED_DISCOUNT_ALL_X || 0.5);

// Extra discount for views: additional /3
const DISCOUNT_VIEWS_X = Number(process.env.SEED_DISCOUNT_VIEWS_X || 1 / 3);

// rounding
function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function toLc(v) {
  return String(v || "").trim().toLowerCase();
}

/**
 * Provider cost based on min offer:
 * base = (minPrice / minQty) * 1000
 * then apply PROFIT_X, then discounts
 */
function pricePer1000FromMin(minQty, minPrice) {
  const qty = Number(minQty);
  const price = Number(minPrice);

  if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Bad minQty: ${minQty}`);
  if (!Number.isFinite(price) || price < 0) throw new Error(`Bad minPrice: ${minPrice}`);

  const base = (price / qty) * 1000;
  const withProfit = base * PROFIT_X;
  return round2(withProfit);
}

function applyDiscounts(pricePer1000, type) {
  let out = Number(pricePer1000 || 0);

  // all services /2
  out = out * DISCOUNT_ALL_X;

  // views extra /3
  if (type === "views") {
    out = out * DISCOUNT_VIEWS_X;
  }

  // avoid 0.00
  if (out > 0 && out < 0.01) out = 0.01;

  return round2(out);
}

/* ===========================
   ENUMS (source of truth)
   =========================== */
const PLATFORM_ENUM = new Set([
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "twitter",
  "telegram",
  "spotify",
  "snapchat",
  "discord",
  "website",
  "other",
]);

const TYPE_ENUM = new Set([
  "followers",
  "likes",
  "views",
  "comments",
  "shares",
  "saves",
  "live",
  "watchtime",
  "traffic",
  "other",
]);

function normPlatform(p) {
  const x = toLc(p);

  // aliases
  if (x === "x" || x === "twitter/x" || x === "twitterx") return "twitter";
  if (x === "web" || x === "website traffic" || x === "site" || x === "traffic") return "website";
  if (x === "yt") return "youtube";
  if (x === "ig") return "instagram";
  if (x === "tt") return "tiktok";

  if (PLATFORM_ENUM.has(x)) return x;
  return "other";
}

function normType(t) {
  const x = toLc(t);

  // aliases
  if (x === "subs" || x === "subscribers") return "followers";
  if (x === "members") return "followers";
  if (x === "plays") return "views";
  if (x === "reels" || x === "reels views") return "views";
  if (x === "watch time" || x === "watch_time") return "watchtime";

  if (TYPE_ENUM.has(x)) return x;
  return "other";
}

/* ===========================
   FULL AUSTATTUNG RAW
   minPrice = tvoja NABAVNA cijena za MIN količinu
   =========================== */

const RAW = [
  // ================= INSTAGRAM =================
  { name: "Instagram Followers — Standard", platform: "Instagram", type: "Followers", category: "Instagram", min: 50, max: 200000, minPrice: 0.20 },
  { name: "Instagram Followers — Fast", platform: "Instagram", type: "Followers", category: "Instagram", min: 100, max: 300000, minPrice: 0.50 },
  { name: "Instagram Likes — Standard", platform: "Instagram", type: "Likes", category: "Instagram", min: 50, max: 300000, minPrice: 0.10 },
  { name: "Instagram Likes — HQ", platform: "Instagram", type: "Likes", category: "Instagram", min: 50, max: 200000, minPrice: 0.18 },
  { name: "Instagram Post Views", platform: "Instagram", type: "Views", category: "Instagram", min: 100, max: 8000000, minPrice: 0.10 },
  { name: "Instagram Reels Views", platform: "Instagram", type: "Views", category: "Instagram", min: 100, max: 8000000, minPrice: 0.10 },
  { name: "Instagram Story Views", platform: "Instagram", type: "Views", category: "Instagram", min: 100, max: 5000000, minPrice: 0.12 },
  { name: "Instagram Comments (Custom)", platform: "Instagram", type: "Comments", category: "Instagram", min: 10, max: 20000, minPrice: 0.50 },
  { name: "Instagram Shares", platform: "Instagram", type: "Shares", category: "Instagram", min: 20, max: 100000, minPrice: 0.30 },
  { name: "Instagram Saves", platform: "Instagram", type: "Saves", category: "Instagram", min: 20, max: 100000, minPrice: 0.35 },

  // ================= TIKTOK =================
  { name: "TikTok Followers — Standard", platform: "TikTok", type: "Followers", category: "TikTok", min: 50, max: 200000, minPrice: 0.20 },
  { name: "TikTok Followers — Fast", platform: "TikTok", type: "Followers", category: "TikTok", min: 100, max: 300000, minPrice: 0.55 },
  { name: "TikTok Likes — Standard", platform: "TikTok", type: "Likes", category: "TikTok", min: 50, max: 500000, minPrice: 0.10 },
  { name: "TikTok Likes — HQ", platform: "TikTok", type: "Likes", category: "TikTok", min: 50, max: 300000, minPrice: 0.20 },
  { name: "TikTok Views", platform: "TikTok", type: "Views", category: "TikTok", min: 100, max: 10000000, minPrice: 0.10 },
  { name: "TikTok Shares", platform: "TikTok", type: "Shares", category: "TikTok", min: 20, max: 300000, minPrice: 0.30 },
  { name: "TikTok Saves", platform: "TikTok", type: "Saves", category: "TikTok", min: 20, max: 300000, minPrice: 0.35 },
  { name: "TikTok Comments (Custom)", platform: "TikTok", type: "Comments", category: "TikTok", min: 10, max: 20000, minPrice: 0.50 },

  // ================= YOUTUBE =================
  { name: "YouTube Subscribers — Standard", platform: "YouTube", type: "Followers", category: "YouTube", min: 50, max: 100000, minPrice: 0.50 },
  { name: "YouTube Subscribers — HQ", platform: "YouTube", type: "Followers", category: "YouTube", min: 50, max: 50000, minPrice: 0.80 },
  { name: "YouTube Views — Standard", platform: "YouTube", type: "Views", category: "YouTube", min: 100, max: 20000000, minPrice: 1.00 },
  { name: "YouTube Shorts Views", platform: "YouTube", type: "Views", category: "YouTube", min: 100, max: 20000000, minPrice: 0.90 },
  { name: "YouTube Likes", platform: "YouTube", type: "Likes", category: "YouTube", min: 50, max: 500000, minPrice: 0.35 },
  { name: "YouTube Comments (Custom)", platform: "YouTube", type: "Comments", category: "YouTube", min: 10, max: 20000, minPrice: 0.50 },
  { name: "YouTube Live Viewers (15 min)", platform: "YouTube", type: "Live", category: "YouTube", min: 50, max: 20000, minPrice: 0.50 },
  { name: "YouTube Watchtime (30 min)", platform: "YouTube", type: "Watchtime", category: "YouTube", min: 100, max: 100000, minPrice: 2.50 },

  // ================= FACEBOOK =================
  { name: "Facebook Page Likes", platform: "Facebook", type: "Likes", category: "Facebook", min: 50, max: 200000, minPrice: 0.25 },
  { name: "Facebook Followers", platform: "Facebook", type: "Followers", category: "Facebook", min: 50, max: 200000, minPrice: 0.30 },
  { name: "Facebook Post Views", platform: "Facebook", type: "Views", category: "Facebook", min: 100, max: 20000000, minPrice: 0.20 },
  { name: "Facebook Video Views", platform: "Facebook", type: "Views", category: "Facebook", min: 100, max: 20000000, minPrice: 0.22 },
  { name: "Facebook Shares", platform: "Facebook", type: "Shares", category: "Facebook", min: 20, max: 300000, minPrice: 0.30 },

  // ================= TWITTER / X =================
  { name: "Twitter/X Followers", platform: "Twitter/X", type: "Followers", category: "Twitter/X", min: 50, max: 200000, minPrice: 0.30 },
  { name: "Twitter/X Likes", platform: "Twitter/X", type: "Likes", category: "Twitter/X", min: 50, max: 200000, minPrice: 0.25 },
  { name: "Twitter/X Views", platform: "Twitter/X", type: "Views", category: "Twitter/X", min: 100, max: 20000000, minPrice: 0.20 },
  { name: "Twitter/X Retweets", platform: "Twitter/X", type: "Shares", category: "Twitter/X", min: 20, max: 200000, minPrice: 0.30 },

  // ================= TELEGRAM =================
  { name: "Telegram Channel Members", platform: "Telegram", type: "Followers", category: "Telegram", min: 50, max: 500000, minPrice: 0.25 },
  { name: "Telegram Post Views", platform: "Telegram", type: "Views", category: "Telegram", min: 100, max: 20000000, minPrice: 0.20 },
  { name: "Telegram Reactions", platform: "Telegram", type: "Likes", category: "Telegram", min: 50, max: 500000, minPrice: 0.15 },

  // ================= SPOTIFY =================
  { name: "Spotify Plays", platform: "Spotify", type: "Views", category: "Spotify", min: 100, max: 5000000, minPrice: 0.15 },
  { name: "Spotify Followers", platform: "Spotify", type: "Followers", category: "Spotify", min: 50, max: 500000, minPrice: 0.25 },
  { name: "Spotify Saves", platform: "Spotify", type: "Saves", category: "Spotify", min: 20, max: 200000, minPrice: 0.25 },

  // ================= SNAPCHAT =================
  { name: "Snapchat Views", platform: "Snapchat", type: "Views", category: "Snapchat", min: 100, max: 20000000, minPrice: 0.20 },
  { name: "Snapchat Followers", platform: "Snapchat", type: "Followers", category: "Snapchat", min: 50, max: 200000, minPrice: 0.45 },

  // ================= DISCORD =================
  { name: "Discord Server Members", platform: "Discord", type: "Followers", category: "Discord", min: 50, max: 200000, minPrice: 0.40 },
  { name: "Discord Server Boost (1 month)", platform: "Discord", type: "Other", category: "Discord", min: 2, max: 100, minPrice: 5.00 },

  // ================= WEBSITE =================
  { name: "Website Traffic — Worldwide", platform: "Website", type: "Traffic", category: "Website Traffic", min: 100, max: 50000000, minPrice: 0.20 },
  { name: "Website Traffic — Tier1", platform: "Website", type: "Traffic", category: "Website Traffic", min: 100, max: 20000000, minPrice: 0.35 },

  // ================= OTHER =================
  { name: "Custom Service (Coming Soon)", platform: "Other", type: "Other", category: "Other", min: 10, max: 10000, minPrice: 0.50 },
];

function buildDocs(rawList) {
  return rawList.map((r) => {
    const min = Number(r.min);
    const max = Number(r.max);

    if (!Number.isFinite(min) || min <= 0) throw new Error(`Bad min for ${r.name}: ${r.min}`);
    if (!Number.isFinite(max) || max < min) throw new Error(`Bad max for ${r.name}: ${r.max}`);

    const platform = normPlatform(r.platform);
    const type = normType(r.type);

    // base * profit
    const p0 = pricePer1000FromMin(min, r.minPrice);

    // discounts: all /2, views additional /3
    const pricePer1000 = applyDiscounts(p0, type);

    return {
      name: String(r.name || "").trim(),
      description: r.description ? String(r.description).trim() : "",
      platform,
      type,
      category: r.category ? String(r.category).trim() : "Other",
      pricePer1000,
      min,
      max,
      provider: r.provider || "default",
      providerServiceId: r.providerServiceId || "",
      enabled: r.enabled !== false,
    };
  });
}

async function run() {
  if (!MONGO_URI) throw new Error("Missing MONGO_URI in .env");

  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected");

  await Service.deleteMany({});
  console.log("🧹 Cleared old services");

  const docs = buildDocs(RAW);

  await Service.insertMany(docs);

  console.log(
    `🚀 Seeded ${docs.length} services (profit x${PROFIT_X}, all x${DISCOUNT_ALL_X}, views x${DISCOUNT_VIEWS_X})`
  );

  console.table(
    docs.slice(0, 12).map((d) => ({
      name: d.name,
      platform: d.platform,
      type: d.type,
      min: d.min,
      pricePer1000: d.pricePer1000,
    }))
  );

  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Seed failed:", e?.message || e);
  process.exit(1);
});
