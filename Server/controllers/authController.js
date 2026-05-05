import bcrypt from "bcrypt";
import User from "../models/User.js";
import { generateToken } from "../utils/jwt.js";

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log("=== LOGIN ATTEMPT ===");
    console.log("Email received:", JSON.stringify(email));
    console.log("Password received:", JSON.stringify(password));

    // חיפוש משתמש
    const user = await User.findOne({ email });
    console.log("User found:", user ? "YES" : "NO");
    
    if (!user) {
      console.log("❌ User not found in DB");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("User in DB:", {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      passwordHash: user.password?.substring(0, 20) + "..." // רק תחילת ה-hash
    });

    // השוואת סיסמה
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match:", isMatch ? "✅ YES" : "❌ NO");

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);
    console.log("✅ Login successful for:", user.fullName);

    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        role: user.role,
        warehouse: user.warehouse
      }
    });
  } catch (e) {
    console.error("❌ Server error:", e);
    res.status(500).json({ message: "Server error", error: e.message });
  }
};

export { login };