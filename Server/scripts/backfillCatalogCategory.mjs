import dotenv from "dotenv";
import mongoose from "mongoose";
import CatalogProduct, { CATALOG_CATEGORIES } from "../models/CatalogProduct.js";

dotenv.config({ path: "./.env" });

// קטגוריות "אמיתיות" (לא 'אחר') לחיפוש בתוך השם הקיים.
const NAMED_CATEGORIES = CATALOG_CATEGORIES.filter((c) => c !== "אחר");
const FALLBACK_CATEGORY = "אחר";

const inferCategoryFromName = (name = "") => {
  const text = String(name || "").trim();
  if (!text) return FALLBACK_CATEGORY;
  const match = NAMED_CATEGORIES.find((c) => text.includes(c));
  return match || FALLBACK_CATEGORY;
};

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("חסר משתנה סביבה MONGO_URI");
  }
  await mongoose.connect(process.env.MONGO_URI);

  // טוענים את כל המוצרים — רק את שדות השם והקטגוריה — כדי לסווג בפועל.
  const products = await CatalogProduct.find({}, { name: 1, category: 1 }).lean();
  let updated = 0;
  let alreadyValid = 0;
  let fallback = 0;
  const summary = Object.fromEntries(CATALOG_CATEGORIES.map((c) => [c, 0]));

  for (const p of products) {
    const currentValid = CATALOG_CATEGORIES.includes(p.category);
    if (currentValid) {
      alreadyValid += 1;
      summary[p.category] += 1;
      continue;
    }
    const inferred = inferCategoryFromName(p.name);
    if (inferred === FALLBACK_CATEGORY) fallback += 1;
    summary[inferred] += 1;
    await CatalogProduct.updateOne({ _id: p._id }, { $set: { category: inferred } });
    updated += 1;
  }

  console.log("Catalog category backfill completed.");
  console.log(`  total products  = ${products.length}`);
  console.log(`  already valid   = ${alreadyValid}`);
  console.log(`  updated         = ${updated}`);
  console.log(`  fell back to "${FALLBACK_CATEGORY}" = ${fallback}`);
  console.log(`  distribution    = ${JSON.stringify(summary)}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("backfillCatalogCategory failed:", err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
