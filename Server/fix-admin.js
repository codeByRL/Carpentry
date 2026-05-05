import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from './models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const fixAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB...");

    const newHashedPassword = await bcrypt.hash('admin123', 10);
    
    const result = await User.updateOne(
      { email: 'admin@test.com' },
      { $set: { password: newHashedPassword } }
    );

    if (result.modifiedCount > 0) {
      console.log("✅ הסיסמה עודכנה בהצלחה ל-admin123!");
    } else {
      console.log("❌ המשתמש לא נמצא או שהסיסמה כבר הייתה כזו.");
    }

    process.exit();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

fixAdmin();