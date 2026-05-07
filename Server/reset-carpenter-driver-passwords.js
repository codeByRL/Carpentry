import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

/** סיסמה זמנית — להחליף אחרי שהמשתמשים נכנסים */
const TEMP_PASSWORD = "CarpentryReset2026";

const run = async () => {
  const emailsFromCli = process.argv.slice(2).filter((a) => a.includes("@"));

  try {
    if (!process.env.MONGO_URI) {
      console.error("חסר MONGO_URI ב-.env");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("מחובר ל-MongoDB");

    const hash = await bcrypt.hash(TEMP_PASSWORD, 10);

    let filter;
    if (emailsFromCli.length > 0) {
      filter = { email: { $in: emailsFromCli } };
    } else {
      filter = { role: { $in: ["CARPENTER", "DRIVER"] } };
    }

    const before = await User.find(filter).select("email fullName role");
    if (before.length === 0) {
      console.log("לא נמצאו משתמשים התואמים לסינון.");
      process.exit(0);
    }

    const result = await User.updateMany(filter, { $set: { password: hash } });

    console.log("\n=== סיכום ===");
    console.log("מספר רשומות שעודכנו:", result.modifiedCount);
    console.log("סיסמה זמנית (לכולם שעודכנו):", TEMP_PASSWORD);
    console.log("\nהתחברות: אימייל + הסיסמה למעלה.\n");
    console.log("משתמשים:");
    before.forEach((u) => {
      console.log(`  - ${u.email} | ${u.fullName} | ${u.role}`);
    });

    if (emailsFromCli.length === 0) {
      console.log(
        "\n(עודכנו כל הנגרים והמובילים. לסינון לפי אימייל: node reset-carpenter-driver-passwords.js a@x.com b@y.com)"
      );
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

run();
