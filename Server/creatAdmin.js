import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const createFirstAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB...");

    const adminExists = await User.findOne({ email: "admin@test.com" });
    if (adminExists) {
      await User.deleteOne({ email: "admin@test.com" });
      console.log("Admin deleted, recreating...");
    }

    const admin = new User({
      fullName: "מנהל ראשי",
      email: "admin@test.com",
      password: "admin123",
      role: "MANAGER"
    });

    await admin.save();
    console.log("✅ Admin created successfully!");
    console.log("Email: admin@test.com");
    console.log("Password: admin123");
    
    process.exit();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

createFirstAdmin();