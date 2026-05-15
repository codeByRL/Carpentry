/** משחרר הזמנה תפוסה לפי 6 ספרות אחרונות של המזהה */
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Order from "../models/Order.js";
import DeliveryRun from "../models/DeliveryRun.js";

dotenv.config();
await connectDB();

const suffix = process.argv[2] || "6b4f6d";
const orders = await Order.find({ status: "READY_FOR_SHIPPING" }).select("_id deliveryClaimedBy");
const order = orders.find((o) => String(o._id).endsWith(suffix));
if (!order) {
  console.log("לא נמצאה הזמנה עם סיומת", suffix);
  process.exit(1);
}

await Order.findByIdAndUpdate(order._id, {
  $set: { deliveryClaimedBy: null, deliveryClaimedAt: null },
});
await DeliveryRun.updateMany(
  { "stops.order": order._id, status: { $in: ["PENDING", "IN_PROGRESS"] } },
  { $set: { status: "COMPLETED" } }
);
console.log("שוחררה הזמנה ..." + String(order._id).slice(-6));
process.exit(0);
