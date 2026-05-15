/**
 * משחרר הובלות שנתפסו בטעות — מסלול פתוח מהיום שלא הושלם.
 * שימוש: node scripts/releaseMistakenDeliveryClaim.mjs [orderIdSuffix]
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import Order from "../models/Order.js";
import DeliveryRun from "../models/DeliveryRun.js";
import User from "../models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const suffix = process.argv[2] || null;

const startOfDay = () => {
  const x = new Date();
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = () => {
  const x = new Date();
  x.setHours(23, 59, 59, 999);
  return x;
};

await connectDB();

const todayStart = startOfDay();
const todayEnd = endOfDay();

const openRuns = await DeliveryRun.find({
  date: { $gte: todayStart, $lte: todayEnd },
  status: { $in: ["PENDING", "IN_PROGRESS"] },
})
  .populate("driver", "fullName")
  .populate("stops.order")
  .lean();

console.log(`מסלולים פתוחים היום: ${openRuns.length}\n`);

for (const run of openRuns) {
  const driverName = run.driver?.fullName || run.driver;
  console.log(`מסלול ${run._id} | נהג: ${driverName} | משך משוער: ${run.estimatedDuration}ש`);
  for (const s of run.stops || []) {
    const oid = s.order?._id || s.order;
    const code = oid ? `#${String(oid).slice(-6)}` : "?";
    const done = s.status === "COMPLETED";
    console.log(`  - ${code} ${s.deliveryType} ${done ? "[הושלם]" : "[ממתין]"}`);
  }
}

let orderIdsToRelease = [];

if (suffix) {
  const order = await Order.findOne({
    _id: { $regex: new RegExp(`${suffix}$`, "i") },
    status: "READY_FOR_SHIPPING",
  });
  if (!order) {
    console.error(`\nלא נמצאה הזמנה READY_FOR_SHIPPING עם סיומת ${suffix}`);
    process.exit(1);
  }
  orderIdsToRelease = [order._id];
} else {
  for (const run of openRuns) {
    for (const s of run.stops || []) {
      if (s.status === "COMPLETED") continue;
      const oid = s.order?._id || s.order;
      if (oid) orderIdsToRelease.push(oid);
    }
  }
}

orderIdsToRelease = [...new Set(orderIdsToRelease.map(String))];

if (!orderIdsToRelease.length) {
  console.log("\nאין הובלות פתוחות לשחרור.");
  process.exit(0);
}

console.log(`\nמשחרר ${orderIdsToRelease.length} הזמנה/ות חזרה לבריכה...`);

for (const oid of orderIdsToRelease) {
  await Order.findByIdAndUpdate(oid, {
    $set: { deliveryClaimedBy: null, deliveryClaimedAt: null },
  });
  console.log(`  ✓ הזמנה ...${oid.slice(-6)} — תפיסה בוטלה`);
}

if (openRuns.length) {
  await DeliveryRun.updateMany(
    { _id: { $in: openRuns.map((r) => r._id) } },
    { $set: { status: "COMPLETED" } }
  );
  console.log(`  ✓ ${openRuns.length} מסלול/ים סומנו כהושלמו (בוטלו)`);
}

console.log("\nההובלות חזרו לבריכה הממתינה.");
process.exit(0);
