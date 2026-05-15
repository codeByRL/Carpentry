/**
 * ממלא committedWorkHours להזמנות קיימות ומחשב מחדש עומס נגרים.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import {
  calculateOrderWorkHoursFromCatalog,
  recalculateCarpenterWorkload,
} from "../services/orderService.js";
import { HOURS_PER_WORK_WEEK } from "../config/workCalendar.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

await connectDB();

const assigned = await Order.find({
  assignedCarpenter: { $exists: true, $ne: null },
}).populate("items.catalogProduct");

let backfilled = 0;
for (const order of assigned) {
  const hours = await calculateOrderWorkHoursFromCatalog(order);
  if (order.committedWorkHours !== hours) {
    order.committedWorkHours = hours;
    await order.save();
    backfilled += 1;
    console.log(`Order ...${String(order._id).slice(-6)}: committedWorkHours=${hours}`);
  }
}

const carpenters = await User.find({ role: "CARPENTER" }).lean();
for (const c of carpenters) {
  const hours = await recalculateCarpenterWorkload(c._id);
  console.log(`Carpenter ${c.fullName}: workload -> ${hours}h`);
}

console.log(`\nDone. Backfilled ${backfilled} orders. Week = ${HOURS_PER_WORK_WEEK}h.`);
process.exit(0);
