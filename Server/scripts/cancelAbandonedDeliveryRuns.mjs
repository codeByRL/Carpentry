/**
 * Migration: מבטל מסלולי הובלה (DeliveryRun) ב-PENDING שלא בוצעו במשך
 * יותר מ-24 שעות, ומשחרר את ה-claims על ההזמנות שלהם כדי שיחזרו לבריכה.
 *
 * שימוש:   node ./scripts/cancelAbandonedDeliveryRuns.mjs
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import DeliveryRun from "../models/DeliveryRun.js";
import Order from "../models/Order.js";
import "../models/User.js";

dotenv.config({ path: "./.env" });

await mongoose.connect(process.env.MONGO_URI);

const ABANDONED_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const cutoff = new Date(Date.now() - ABANDONED_AGE_MS);

const stale = await DeliveryRun.find({
  status: "PENDING",
  $or: [
    { currentStopIndex: { $lte: 0 } },
    { currentStopIndex: { $exists: false } },
  ],
  date: { $lt: cutoff },
})
  .populate("driver", "fullName")
  .lean();

console.log(`\nFound ${stale.length} abandoned PENDING run(s) older than 24h.\n`);

for (const run of stale) {
  console.log(`• Run ${run._id} | driver=${run.driver?.fullName} | date=${run.date} | stops=${run.stops?.length || 0}`);
  const orderIds = (run.stops || [])
    .filter((s) => s.status !== "COMPLETED")
    .map((s) => s.order)
    .filter(Boolean);

  if (orderIds.length) {
    const orderRes = await Order.updateMany(
      { _id: { $in: orderIds }, deliveryClaimedBy: run.driver?._id || run.driver },
      { $set: { deliveryClaimedBy: null, deliveryClaimedAt: null } }
    );
    console.log(`    released ${orderRes.modifiedCount}/${orderIds.length} order claims`);
  }

  await DeliveryRun.updateOne({ _id: run._id }, { $set: { status: "COMPLETED" } });
  console.log(`    run marked COMPLETED (closed)`);
}

console.log(`\nDone.`);

await mongoose.disconnect();
