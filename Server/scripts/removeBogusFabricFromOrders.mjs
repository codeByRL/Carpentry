/**
 * Migration: מסיר את חומר הגלם "ריפוד צבע מס' 30" (BaseProduct ישן עם code=YUT-7445
 * ו-materialType=null) שדלף לכל הזמנה למרות שאינו רלוונטי כבד ברירת מחדל.
 *
 *   1. מסיר את הרשומה ממערך baseProducts בכל מוצר קטלוגי שמכיל אותה.
 *   2. מסיר את הרשומה ממערך requiredMaterials בכל הזמנה קיימת (כולל הזמנות
 *      שכבר נמצאות במחסן/ליקוט/אספקה), ומשחרר את reservedQuantity חזרה ל-BaseProduct
 *      לפני המחיקה (כדי שלא יישאר חוב על שריון של רשומה שעומדת להימחק).
 *   3. מוחק את ה-BaseProduct עצמו (לא בשימוש יותר).
 *
 * שימוש:   node ./scripts/removeBogusFabricFromOrders.mjs
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import BaseProduct from "../models/BaseProduct.js";
import CatalogProduct from "../models/CatalogProduct.js";
import Order from "../models/Order.js";

dotenv.config({ path: "./.env" });

const TARGET_NAMES = ["ריפוד צבע מס' 30"];
const TARGET_CODES = ["YUT-7445"];

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("חסר משתנה סביבה MONGO_URI");
  }
  await mongoose.connect(process.env.MONGO_URI);

  const bogus = await BaseProduct.findOne({
    $or: [{ name: { $in: TARGET_NAMES } }, { code: { $in: TARGET_CODES } }],
  });

  if (!bogus) {
    console.log("לא נמצא חומר הגלם 'ריפוד צבע מס׳ 30' — ייתכן שכבר נמחק. אין מה לעשות.");
    await mongoose.disconnect();
    return;
  }

  const bogusId = bogus._id;
  console.log(`נמצא: id=${bogusId} | name="${bogus.name}" | code=${bogus.code}`);
  console.log(`  reservedQuantity לפני שחרור = ${bogus.reservedQuantity}`);

  // 1) הסרה ממוצרים קטלוגיים שמכילים את החומר במערך baseProducts
  const catalogPullRes = await CatalogProduct.updateMany(
    { "baseProducts.product": bogusId },
    { $pull: { baseProducts: { product: bogusId } } }
  );
  console.log(
    `הוסר ממוצרים קטלוגיים: matched=${catalogPullRes.matchedCount}, modified=${catalogPullRes.modifiedCount}`
  );

  // 2) עוברים על כל ההזמנות שמפנות לחומר הזה, ומשחררים את הכמות המשוריינת
  //    לפני שמסירים את הרשומה ממערך requiredMaterials.
  const affectedOrders = await Order.find({ "requiredMaterials.product": bogusId });
  let totalQtyToRelease = 0;
  for (const order of affectedOrders) {
    const matching = (order.requiredMaterials || []).filter(
      (m) => String(m.product) === String(bogusId)
    );
    for (const rm of matching) {
      const qty = Number(rm.quantity || 0);
      // משחררים את השריון רק אם הרשומה לא נלקטה בפועל (isPicked=false).
      // אם נלקטה — הכמות כבר ירדה מהמלאי בעת הליקוט, אז אין שריון פתוח לשחרור.
      if (!rm.isPicked) {
        totalQtyToRelease += qty;
      }
    }
  }
  console.log(`כמות לשחרור (לא נלקטה עדיין): ${totalQtyToRelease}`);

  // הסרה ממערך requiredMaterials בכל ההזמנות
  const orderPullRes = await Order.updateMany(
    { "requiredMaterials.product": bogusId },
    { $pull: { requiredMaterials: { product: bogusId } } }
  );
  console.log(
    `הוסר מהזמנות: matched=${orderPullRes.matchedCount}, modified=${orderPullRes.modifiedCount}`
  );

  // שחרור הכמות המשוריינת מה-BaseProduct (לפני מחיקה — כדי לא להשאיר חוב תיאורטי)
  const fresh = await BaseProduct.findById(bogusId);
  if (fresh) {
    const newReserved = Math.max(0, Number(fresh.reservedQuantity || 0) - totalQtyToRelease);
    fresh.reservedQuantity = newReserved;
    await fresh.save();
    console.log(`reservedQuantity אחרי שחרור = ${newReserved}`);
  }

  // 3) מחיקת ה-BaseProduct
  await BaseProduct.deleteOne({ _id: bogusId });
  console.log(`נמחק BaseProduct id=${bogusId} ("${bogus.name}").`);

  await mongoose.disconnect();
  console.log("סיום ההגירה.");
}

run().catch(async (err) => {
  console.error("removeBogusFabricFromOrders failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
