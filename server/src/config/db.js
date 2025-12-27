// server/src/config/db.js
import mongoose from "mongoose";

export async function connectDb(uri) {
  if (!uri) throw new Error("MONGO_URI missing");

  mongoose.set("strictQuery", true);

  // 🔥 OVDE JE FIX
  mongoose.set("autoIndex", false);

  await mongoose.connect(uri);

  console.log("✅ MongoDB connected");
}
