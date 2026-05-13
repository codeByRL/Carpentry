import dotenv from "dotenv";
import connectDB from "../config/db.js";
import BaseProduct from "../models/BaseProduct.js";

dotenv.config();

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

const randomChars = (pool, count) => {
  let out = "";
  for (let i = 0; i < count; i += 1) {
    out += pool[Math.floor(Math.random() * pool.length)];
  }
  return out;
};

const generateSku = () => `${randomChars(LETTERS, 3)}-${randomChars(DIGITS, 4)}`;

const hasCode = (value) => String(value || "").trim().length > 0;

const run = async () => {
  await connectDB();

  const allProducts = await BaseProduct.find({}, "_id code name").lean();
  const usedCodes = new Set(
    allProducts
      .map((p) => String(p.code || "").trim().toUpperCase())
      .filter(Boolean)
  );

  const missingCodeProducts = allProducts.filter((p) => !hasCode(p.code));
  if (missingCodeProducts.length === 0) {
    console.log("No base products are missing codes.");
    process.exit(0);
  }

  let updated = 0;
  for (const product of missingCodeProducts) {
    let candidate = "";
    let tries = 0;
    do {
      candidate = generateSku();
      tries += 1;
      if (tries > 5000) {
        throw new Error(`Failed generating unique code for product ${product._id}`);
      }
    } while (usedCodes.has(candidate));

    await BaseProduct.updateOne({ _id: product._id }, { $set: { code: candidate } });
    usedCodes.add(candidate);
    updated += 1;
    console.log(`Updated ${product.name || product._id}: ${candidate}`);
  }

  console.log(`Done. Updated ${updated} products.`);
  process.exit(0);
};

run().catch((err) => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});
