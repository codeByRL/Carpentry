/**
 * מסיר ממסד את חומר הגלם «ריפוד צבע 44» (או וריאציות שם) וכל ההפניות אליו.
 *
 *   node ./scripts/removeRipudColor44.mjs
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import BaseProduct from "../models/BaseProduct.js";
import CatalogProduct from "../models/CatalogProduct.js";
import Order from "../models/Order.js";
import PurchaseList from "../models/PurchaseList.js";

dotenv.config({ path: "./.env" });

const TARGET_NAMES = [
  "ריפוד צבע 44",
  "ריפוד צבע מס' 44",
  "ריפוד צבע מס׳ 44",
  "ריפוד צבע מס' 44",
];

async function findBogus() {
  const exact = await BaseProduct.findOne({ name: { $in: TARGET_NAMES } });
  if (exact) return exact;
  return BaseProduct.findOne({
    name: { $regex: /ריפוד.*44/, $options: "i" },
    $or: [{ materialType: "fabric" }, { materialType: null }, { materialType: { $exists: false } }],
  });
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("חסר MONGO_URI");
  }
  await mongoose.connect(process.env.MONGO_URI);

  const bogus = await findBogus();

  if (!bogus) {
    console.log("לא נמצא BaseProduct מתאים ל«ריפוד צבע 44» — כנראה כבר הוסר.");
    await mongoose.disconnect();
    return;
  }

  const bogusId = bogus._id;
  console.log(`נמצא: id=${bogusId} | name="${bogus.name}" | code=${bogus.code || "—"}`);

  const plDel = await PurchaseList.deleteMany({ product: bogusId });
  console.log(`נמחקו רשומות רכש (PurchaseList): ${plDel.deletedCount}`);

  const catalogPullRes = await CatalogProduct.updateMany(
    { "baseProducts.product": bogusId },
    { $pull: { baseProducts: { product: bogusId } } }
  );
  console.log(
    `הוסר ממוצרים קטלוגיים: matched=${catalogPullRes.matchedCount}, modified=${catalogPullRes.modifiedCount}`
  );

  const affectedOrders = await Order.find({ "requiredMaterials.product": bogusId });
  let totalQtyToRelease = 0;
  for (const order of affectedOrders) {
    const matching = (order.requiredMaterials || []).filter((m) => String(m.product) === String(bogusId));
    for (const rm of matching) {
      const qty = Number(rm.quantity || 0);
      if (!rm.isPicked) totalQtyToRelease += qty;
    }
  }

  const orderPullRes = await Order.updateMany(
    { "requiredMaterials.product": bogusId },
    { $pull: { requiredMaterials: { product: bogusId } } }
  );
  console.log(
    `הוסר מהזמנות: matched=${orderPullRes.matchedCount}, modified=${orderPullRes.modifiedCount} | שחרור שריון לא נלקט: ${totalQtyToRelease}`
  );

  const fresh = await BaseProduct.findById(bogusId);
  if (fresh) {
    const newReserved = Math.max(0, Number(fresh.reservedQuantity || 0) - totalQtyToRelease);
    fresh.reservedQuantity = newReserved;
    await fresh.save();
  }

  await BaseProduct.deleteOne({ _id: bogusId });
  console.log(`נמחק BaseProduct id=${bogusId}.`);

  await mongoose.disconnect();
  console.log("סיום.");
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
