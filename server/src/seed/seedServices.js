import "dotenv/config";
import mongoose from "mongoose";
import { Service } from "../models/Service.js";

await mongoose.connect(process.env.MONGO_URI);

await Service.deleteMany({});

await Service.insertMany([
  {
    platform: "Instagram",
    name: "Instagram Followers",
    pricePer1000: 3.5,
    min: 100,
    max: 50000
  },
  {
    platform: "TikTok",
    name: "TikTok Views",
    pricePer1000: 1.2,
    min: 1000,
    max: 1000000
  }
]);

console.log("✅ Services seeded");
process.exit(0);
