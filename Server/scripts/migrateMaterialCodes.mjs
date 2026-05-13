/**
 * מיגרציה: מאחדת את כל קודי BaseProduct לפורמט PREFIX-0001
 * ומסנכרן FormicaModel עם אותם קודים.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const BaseProduct = mongoose.model(
  "BaseProduct",
  new mongoose.Schema({}, { strict: false }),
  "baseproducts"
);
const FormicaModel = mongoose.model(
  "FormicaModel",
  new mongoose.Schema({}, { strict: false }),
  "formicamodels"
);

const STANDARD_PREFIX_RE = /^(FAB|FOR|HND|MAT)-\d{4}$/i;

const resolvePrefix = (product) => {
  const mt = String(product.materialType || "").toLowerCase();
  const code = String(product.code || "").trim();

  if (mt === "fabric") return "FAB";
  if (mt === "formica" || product.formicaModelId) return "FOR";
  if (mt === "handle") return "HND";
  if (/^FOR-/i.test(code)) return "FOR";
  if (/^FAB-/i.test(code)) return "FAB";
  if (/^HND-/i.test(code)) return "HND";
  if (/^MAT-/i.test(code)) return "MAT";
  if (/^(YUT|ICT)-/i.test(code)) return "FAB";
  if (product.isMaterial === true || product.isMaterial === "true") {
    if (mt === "wood") return "MAT";
    return "MAT";
  }
  return "MAT";
};

const padCode = (prefix, num) => `${prefix}-${String(num).padStart(4, "0")}`;

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const products = await BaseProduct.find({}).sort({ createdAt: 1, _id: 1 }).lean();
  const byPrefix = { FAB: [], FOR: [], HND: [], MAT: [] };

  for (const p of products) {
    const prefix = resolvePrefix(p);
    byPrefix[prefix].push(p);
  }

  const codeMap = new Map();
  let updated = 0;

  for (const prefix of ["FAB", "FOR", "HND", "MAT"]) {
    let seq = 1;
    for (const p of byPrefix[prefix]) {
      const newCode = padCode(prefix, seq);
      seq += 1;
      const oldCode = String(p.code || "").trim();
      if (oldCode === newCode && STANDARD_PREFIX_RE.test(oldCode)) continue;
      codeMap.set(String(p._id), { oldCode, newCode });
      await BaseProduct.updateOne({ _id: p._id }, { $set: { code: newCode } });
      updated += 1;
      console.log(`${oldCode || "(ריק)"} -> ${newCode} | ${p.name}`);
    }
  }

  const formicas = await FormicaModel.find({}).lean();
  let formicaUpdated = 0;
  for (const f of formicas) {
    if (!f.baseProductId) continue;
    const mapped = codeMap.get(String(f.baseProductId));
    const bp = await BaseProduct.findById(f.baseProductId).select("code").lean();
    const targetCode = bp?.code || mapped?.newCode;
    if (!targetCode || f.code === targetCode) continue;
    await FormicaModel.updateOne({ _id: f._id }, { $set: { code: targetCode } });
    formicaUpdated += 1;
    console.log(`Formica ${f.name}: ${f.code} -> ${targetCode}`);
  }

  console.log(`\nDone. BaseProduct updated: ${updated}. FormicaModel synced: ${formicaUpdated}.`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
