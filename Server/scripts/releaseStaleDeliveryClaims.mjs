/**
 * Migration: משחרר תפיסות (deliveryClaimedBy) ישנות שלא תואמות מסלול נהג פעיל.
 *
 * רקע: יכלו להישאר claims על הזמנות READY_FOR_SHIPPING בלי שיש להן עצירה
 * פתוחה במסלול PENDING/IN_PROGRESS — למשל אם נהג תפס רגל מחסן→נגר ולא
 * סיים אותה במערכת, או אם הנגר אישר קבלה (markReceived) בלי שהמוביל סימן
 * סיום. תוצאה: ההזמנה לא נכנסה לבריכה כשחזרה ל-READY_FOR_SHIPPING.
 *
 * שימוש:   node ./scripts/releaseStaleDeliveryClaims.mjs
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import DeliveryRun from "../models/DeliveryRun.js";
import "../models/User.js";

dotenv.config({ path: "./.env" });

await mongoose.connect(process.env.MONGO_URI);

const claimedReady = await Order.find({
  status: "READY_FOR_SHIPPING",
  deliveryClaimedBy: { $ne: null },
})
  .select({ _id: 1, status: 1, deliveryClaimedBy: 1, carpenterCompletedAt: 1, "customer.name": 1 })
  .lean();

console.log(`\nFound ${claimedReady.length} READY_FOR_SHIPPING orders with deliveryClaimedBy set.`);

let released = 0;
for (const o of claimedReady) {
  // האם יש למוביל הזה (או לכל מוביל) עצירה לא-מושלמת על ההזמנה במסלול פעיל?
  const expectedType = o.carpenterCompletedAt ? "TO_CUSTOMER" : "TO_CARPENTER";
  const activeRun = await DeliveryRun.findOne({
    status: { $in: ["PENDING", "IN_PROGRESS"] },
    stops: {
      $elemMatch: {
        order: o._id,
        deliveryType: expectedType,
        status: { $ne: "COMPLETED" },
      },
    },
  })
    .select("_id status")
    .lean();

  if (activeRun) {
    console.log(`  KEEP claim on ${o._id} (${o.customer?.name}) — has active run ${activeRun._id} (${expectedType})`);
    continue;
  }

  await Order.updateOne(
    { _id: o._id },
    { $set: { deliveryClaimedBy: null, deliveryClaimedAt: null } }
  );
  console.log(`  RELEASED stale claim on ${o._id} (${o.customer?.name}) — no active ${expectedType} run`);
  released += 1;
}

console.log(`\nDone. Released ${released} stale claim(s).`);

await mongoose.disconnect();
