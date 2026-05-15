/**
 * ממלא estimatedWorkTime למוצרים פעילים/בקטלוג בלי שעות.
 * שידה/מיטה = שבוע (20ש), ספה/ארון = שבועיים (40ש), כסא = שבוע (20ש).
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import CatalogProduct from "../models/CatalogProduct.js";
import { HOURS_PER_WORK_WEEK } from "../config/workCalendar.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const ONE_WEEK = HOURS_PER_WORK_WEEK;
const TWO_WEEKS = HOURS_PER_WORK_WEEK * 2;

const hoursForProduct = (product) => {
  const cat = String(product.category || "");
  const name = String(product.name || "");
  if (cat === "ספה" || cat === "ארון" || /ספה|ארון/.test(name)) return TWO_WEEKS;
  if (cat === "שידה" || cat === "מיטה" || cat === "כסא" || /שידה|מיטה|כסא/.test(name)) {
    return ONE_WEEK;
  }
  return ONE_WEEK;
};

const isMissingHours = (v) => v == null || !Number.isFinite(Number(v)) || Number(v) <= 0;

await connectDB();

const products = await CatalogProduct.find({
  $or: [
    { estimatedWorkTime: null },
    { estimatedWorkTime: { $exists: false } },
    { estimatedWorkTime: { $lte: 0 } },
  ],
}).select("name category status estimatedWorkTime");

if (!products.length) {
  console.log("אין מוצרים בלי שעות — הכול תקין.");
  process.exit(0);
}

console.log(`נמצאו ${products.length} מוצרים בלי שעות:\n`);

for (const p of products) {
  const hours = hoursForProduct(p);
  p.estimatedWorkTime = hours;
  await p.save();
  console.log(`  ✓ ${p.name} [${p.category}] → ${hours}ש (${hours === ONE_WEEK ? "שבוע" : "שבועיים"})`);
}

console.log(`\nעודכנו ${products.length} מוצרים.`);
process.exit(0);
