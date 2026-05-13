/**
 * Migration: פותח מחדש מסלולי הובלה שסגרו בטעות כ-COMPLETED בעוד שיש בהם
 * עצירות PENDING. זה קרה בגלל באג שסגר את המסלול כש-currentStopIndex
 * הגיע לסוף הרשימה — גם אם עצירות באמצע נשארו לא-מסומנות (סדר לא רציף).
 *
 * שימוש:   node ./scripts/reopenIncompleteRuns.mjs
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import DeliveryRun from "../models/DeliveryRun.js";
import "../models/User.js";
import "../models/Order.js";

dotenv.config({ path: "./.env" });
await mongoose.connect(process.env.MONGO_URI);

const candidates = await DeliveryRun.find({ status: "COMPLETED" }).lean();

console.log(`\nChecking ${candidates.length} COMPLETED run(s) for stuck-PENDING stops...\n`);

let reopened = 0;
for (const run of candidates) {
  const pending = (run.stops || []).filter((s) => s.status !== "COMPLETED");
  if (pending.length === 0) continue;

  // מסלול שאף עצירה בו לא בוצעה (currentStopIndex<=0) — נטוש מלכתחילה;
  // לא לפתוח מחדש, להשאיר סגור.
  const completedCount = (run.stops || []).filter((s) => s.status === "COMPLETED").length;
  if (completedCount === 0) {
    console.log(`• SKIP run ${run._id} — no stops were completed (abandoned, keep closed)`);
    continue;
  }

  console.log(`• Run ${run._id} (date=${run.date}) — ${pending.length}/${run.stops.length} stops still PENDING; reopening to IN_PROGRESS`);
  for (const s of pending) {
    console.log(`    ↳ stop [${run.stops.indexOf(s)}] order=${String(s.order).slice(-6)} → ${s.contactName}`);
  }

  await DeliveryRun.updateOne(
    { _id: run._id },
    { $set: { status: "IN_PROGRESS" } }
  );
  reopened += 1;
}

console.log(`\nDone. Reopened ${reopened} run(s).`);

await mongoose.disconnect();
