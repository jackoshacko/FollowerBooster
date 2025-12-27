// server/src/seed/seed.services.js

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Helper: izracunaj pricePer1000 na osnovu “minQty costs minPrice”
 * npr 50 followers = 0.20 EUR -> per1000 = 0.20 * (1000/50) = 4.00
 * profit x3 -> 12.00
 */
function per1000FromMin(minQty, minPrice, profitMult = 3) {
  const basePer1000 = Number(minPrice) * (1000 / Number(minQty));
  return round2(basePer1000 * profitMult);
}

export const seedServices = [
  // ========================= INSTAGRAM =========================
  {
    platform: "instagram",
    type: "followers",
    category: "Instagram Followers",
    name: "[Instagram] Followers — HQ",
    description: "High quality IG followers. Start fast. No password needed.",
    min: 50,
    max: 50000,
    pricePer1000: per1000FromMin(50, 0.2, 3), // 50 = 0.20 => per1000 4 => x3 => 12
  },
  {
    platform: "instagram",
    type: "likes",
    category: "Instagram Likes",
    name: "[Instagram] Likes — Post",
    description: "Likes for posts. Gradual delivery.",
    min: 50,
    max: 100000,
    pricePer1000: per1000FromMin(50, 0.1, 3), // 50 = 0.10 => per1000 2 => x3 => 6
  },
  {
    platform: "instagram",
    type: "views",
    category: "Instagram Views",
    name: "[Instagram] Views — Post",
    description: "Views for video posts.",
    min: 100,
    max: 1000000,
    pricePer1000: per1000FromMin(100, 0.1, 3), // 100 = 0.10 => per1000 1 => x3 => 3
  },
  {
    platform: "instagram",
    type: "views",
    category: "Instagram Reels",
    name: "[Instagram] Reels Views",
    description: "Reels views. Smooth delivery.",
    min: 100,
    max: 2000000,
    pricePer1000: per1000FromMin(100, 0.1, 3), // same
  },
  {
    platform: "instagram",
    type: "comments",
    category: "Instagram Comments",
    name: "[Instagram] Comments — Custom",
    description: "10+ comments. Customer provides comment text (or we randomize).",
    min: 10,
    max: 5000,
    pricePer1000: per1000FromMin(10, 0.5, 3), // 10 = 0.50 => per1000 50 => x3 => 150
  },

  // ========================= TIKTOK =========================
  {
    platform: "tiktok",
    type: "followers",
    category: "TikTok Followers",
    name: "[TikTok] Followers — Fast",
    description: "TikTok followers, fast start.",
    min: 50,
    max: 50000,
    // nisi dao cijenu — stavio sam slično IG followers (profit x3)
    pricePer1000: per1000FromMin(50, 0.2, 3),
  },
  {
    platform: "tiktok",
    type: "likes",
    category: "TikTok Likes",
    name: "[TikTok] Likes",
    description: "Likes for TikTok videos.",
    min: 50,
    max: 200000,
    pricePer1000: per1000FromMin(50, 0.1, 3),
  },
  {
    platform: "tiktok",
    type: "views",
    category: "TikTok Views",
    name: "[TikTok] Views",
    description: "Views for TikTok videos.",
    min: 100,
    max: 5000000,
    pricePer1000: per1000FromMin(100, 0.1, 3),
  },
  {
    platform: "tiktok",
    type: "comments",
    category: "TikTok Comments",
    name: "[TikTok] Comments — Custom",
    description: "10+ comments. Customer provides comment text.",
    min: 10,
    max: 5000,
    pricePer1000: per1000FromMin(10, 0.5, 3),
  },

  // ========================= YOUTUBE =========================
  {
    platform: "youtube",
    type: "followers",
    category: "YouTube Subscribers",
    name: "[YouTube] Subscribers",
    description: "Subscribers for channels.",
    min: 50,
    max: 50000,
    pricePer1000: per1000FromMin(50, 0.5, 3), // 50 = 0.50 => per1000 10 => x3 => 30
  },
  {
    platform: "youtube",
    type: "views",
    category: "YouTube Views",
    name: "[YouTube] Views",
    description: "Video views (standard).",
    min: 100,
    max: 5000000,
    pricePer1000: per1000FromMin(100, 1.0, 3), // 100 = 1.00 => per1000 10 => x3 => 30
  },
  {
    platform: "youtube",
    type: "live",
    category: "YouTube Live",
    name: "[YouTube] Live viewers — 15min",
    description: "Live viewers for 15 minutes.",
    min: 50,
    max: 5000,
    pricePer1000: per1000FromMin(50, 0.5, 3), // 50 = 0.50 => per1000 10 => x3 => 30
  },
  {
    platform: "youtube",
    type: "comments",
    category: "YouTube Comments",
    name: "[YouTube] Comments — Custom",
    description: "10+ comments. Customer provides comment text.",
    min: 10,
    max: 5000,
    pricePer1000: per1000FromMin(10, 0.5, 3),
  },

  // ========================= DISCORD / WEBSITE TRAFFIC / OTHER =========================
  {
    platform: "discord",
    type: "followers",
    category: "Discord",
    name: "[Discord] Discord Server Members",
    description: "Members for Discord servers.",
    min: 50,
    max: 50000,
    // trenutno placeholder (podesi posle)
    pricePer1000: 25,
  },
  {
    platform: "website",
    type: "traffic",
    category: "Website Traffic",
    name: "[Website] Traffic — Worldwide",
    description: "Website visits / clicks.",
    min: 100,
    max: 5000000,
    pricePer1000: 12,
  },

  // ========================= COMING SOON PLATFORMS (enabled=false) =========================
  {
    platform: "facebook",
    type: "likes",
    category: "Facebook",
    name: "[Facebook] Likes — Coming soon",
    description: "Coming soon.",
    min: 50,
    max: 50000,
    pricePer1000: 10,
    enabled: false,
  },
  {
    platform: "twitter",
    type: "followers",
    category: "Twitter/X",
    name: "[Twitter/X] Followers — Coming soon",
    description: "Coming soon.",
    min: 50,
    max: 50000,
    pricePer1000: 12,
    enabled: false,
  },
  {
    platform: "telegram",
    type: "followers",
    category: "Telegram",
    name: "[Telegram] Channel members — Coming soon",
    description: "Coming soon.",
    min: 50,
    max: 50000,
    pricePer1000: 10,
    enabled: false,
  },
  {
    platform: "spotify",
    type: "views",
    category: "Spotify",
    name: "[Spotify] Plays — Coming soon",
    description: "Coming soon.",
    min: 100,
    max: 2000000,
    pricePer1000: 8,
    enabled: false,
  },
  {
    platform: "snapchat",
    type: "views",
    category: "Snapchat",
    name: "[Snapchat] Views — Coming soon",
    description: "Coming soon.",
    min: 100,
    max: 2000000,
    pricePer1000: 8,
    enabled: false,
  },
  {
    platform: "other",
    type: "other",
    category: "Other",
    name: "[Other] Coming soon",
    description: "More services soon.",
    min: 1,
    max: 1,
    pricePer1000: 0.01,
    enabled: false,
  },
];
