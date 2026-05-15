import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Order from "../models/Order.js";
import DeliveryRun from "../models/DeliveryRun.js";
import "../models/User.js";

dotenv.config();
await connectDB();

const ready = await Order.find({ status: "READY_FOR_SHIPPING" })
  .populate("assignedCarpenter", "fullName address")
  .lean();

console.log("READY_FOR_SHIPPING:", ready.length);
for (const o of ready) {
  console.log({
    id: "..." + String(o._id).slice(-6),
    carpenter: o.assignedCarpenter?.fullName,
    claimed: o.deliveryClaimedBy ? "..." + String(o.deliveryClaimedBy).slice(-6) : null,
    completed: !!o.carpenterCompletedAt,
    received: !!o.receivedByCarpenter,
    driverMarked: !!o.driverMarkedDeliveredToCarpenterAt,
    paid: o.isPaid,
  });
}

const runs = await DeliveryRun.find({
  status: { $in: ["PENDING", "IN_PROGRESS", "COMPLETED"] },
})
  .sort({ updatedAt: -1 })
  .limit(5)
  .populate("driver", "fullName")
  .lean();

console.log("\nRecent runs:");
for (const r of runs) {
  console.log(
    "Run ..." + String(r._id).slice(-6),
    r.driver?.fullName,
    r.status,
    "stops:",
    (r.stops || []).length
  );
  for (const s of r.stops || []) {
    console.log(" ", s.deliveryType, "order ..." + String(s.order).slice(-6), s.status);
  }
}

process.exit(0);
