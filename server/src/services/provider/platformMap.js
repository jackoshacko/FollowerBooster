// server/src/services/provider/platformMap.js

function norm(s) {
  return String(s || "").toLowerCase().trim();
}

function pickPlatform(text) {
  const t = norm(text);

  const rules = [
    ["instagram", ["instagram", "insta", "ig "]],
    ["tiktok", ["tiktok", "tik tok"]],
    ["youtube", ["youtube", "yt ", "youtub"]],
    ["facebook", ["facebook", "fb "]],
    ["twitter", ["twitter", "x ", "x.com"]],
    ["telegram", ["telegram", "tg "]],
    ["spotify", ["spotify"]],
    ["snapchat", ["snapchat", "snap "]],
    ["discord", ["discord"]],
    ["website", ["website", "traffic", "seo", "google", "visits", "visitor"]],
  ];

  for (const [platform, keys] of rules) {
    if (keys.some((k) => t.includes(k))) return platform;
  }
  return "other";
}

function pickType(text) {
  const t = norm(text);

  const rules = [
    ["followers", ["followers", "follower"]],
    ["likes", ["likes", "like"]],
    ["views", ["views", "view", "watch"]],
    ["comments", ["comments", "comment"]],
    ["shares", ["shares", "share"]],
    ["saves", ["saves", "save"]],
    ["subscribers", ["subscribers", "subscriber", "subs"]],
    ["members", ["members", "member", "join"]],
    ["reactions", ["reactions", "reaction"]],
    ["traffic", ["traffic", "visits", "visit", "seo"]],
  ];

  for (const [type, keys] of rules) {
    if (keys.some((k) => t.includes(k))) return type;
  }
  return "other";
}

/**
 * provider row tipično:
 * { category, name, type, ... }
 * mi gledamo category + name (+ type iz providera) i mapiramo
 */
export function detectPlatformAndType(row) {
  const cat = norm(row?.category);
  const name = norm(row?.name);
  const ptype = norm(row?.type);

  // prvo pokušaj iz category
  let platform = pickPlatform(cat);
  if (platform === "other") platform = pickPlatform(name);

  // type: probaj iz provider type, pa iz name, pa iz category
  let type = pickType(ptype);
  if (type === "other") type = pickType(name);
  if (type === "other") type = pickType(cat);

  // normalized category label za UI (da bude lep)
  const category = row?.category ? String(row.category).trim() : "Other";

  return { platform, type, category };
}
