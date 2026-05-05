import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authenticate from "./middlewares/authenticate.js";
import axios from "axios";

// ייבוא הראוטרים
import authRouter from "./routes/authRoute.js";
import ordersRouter from "./routes/orderRoute.js";
import warehouseRoutes from "./routes/warehouseRoutes.js";
import catalogRouter from "./routes/catalogRoute.js";
import carpenterRouter from "./routes/carpenterRoute.js";
import chatRouter from "./routes/chatRoute.js";
import managerAnalyticsRouter from "./routes/managerAnalyticsRoutes.js";
import deliveryRouter from "./routes/deliveryRoutes.js";
import warehousesRouter from "./routes/warehousesRoutes.js";
import baseProductRouter from "./routes/baseProductRoute.js";
import notificationRouter from "./routes/notificationRoute.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 🛠️ הגדרות CORS ו-JSON (ללא יצירת שרת כאן כדי למנוע EADDRINUSE)
app.set('etag', false);
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// קבצים סטטיים
app.use("/uploads", express.static(join(__dirname, "uploads")));

// --- נתיבים ייעודיים לצ'אט ---

// 1. קבלת פרטי משתמש ספציפי (פותר את ה-404 ואת ה"טוען...")
app.get("/api/users/:id", authenticate, async (req, res) => {
  try {
    const User = mongoose.models.User || mongoose.model('User');
    const user = await User.findById(req.params.id).select('_id fullName role isOnline');
    if (!user) return res.status(404).json({ message: "משתמש לא נמצא" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. רשימת עובדים לצ'אט
app.get("/api/chat/staff", authenticate, async (req, res) => {
  try {
    const User = mongoose.models.User || mongoose.model('User');
    const staff = await User.find({ 
      role: { $in: ['CARPENTER', 'WAREHOUSE', 'MANAGER', 'SALES', 'DRIVER'] },
      _id: { $ne: req.user.id }
    }).select('_id fullName role').sort('fullName');
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. שליחת הודעה (מתוקן לנתיב הבסיסי)
app.post("/api/chat/", authenticate, async (req, res) => {
  try {
    const { receiverId, content, orderId = null } = req.body;
    if (!receiverId || !content?.trim()) {
      return res.status(400).json({ error: 'חסרים נתונים' });
    }
    const Message = mongoose.models.Message || mongoose.model('Message');
    const message = new Message({
      sender: req.user.id,
      receiver: receiverId,
      content: content.trim(),
      order: orderId,
      isRead: false
    });
    await message.save();
    const populated = await Message.findById(message._id)
      .populate('sender', 'fullName role')
      .populate('receiver', 'fullName role');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Proxy
const ABACUS_BASE_URL = process.env.ABACUS_BASE_URL || "https://routellm.abacus.ai";
const ABACUS_API_KEY = process.env.ABACUS_API_KEY;
app.post("/api/proxy/abacus-ai", authenticate, async (req, res) => {
  try {
    if (!ABACUS_API_KEY) throw new Error("ABACUS_API_KEY missing");
    const response = await axios.post(`${ABACUS_BASE_URL}${req.body.urlPath}`, req.body.data, {
      headers: { "Authorization": `Bearer ${ABACUS_API_KEY}`, "Content-Type": "application/json" }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// שימוש בראוטרים הקיימים
app.use("/api/auth", authRouter);
app.use("/api/orders", authenticate, ordersRouter);
app.use("/api/warehouse", authenticate, warehouseRoutes);
app.use("/api/warehouses", authenticate, warehousesRouter);
app.use("/api/base-products", baseProductRouter);
app.use("/api/catalog", authenticate, catalogRouter);
app.use("/api/carpenter", authenticate, carpenterRouter);
app.use("/api/chat", authenticate, chatRouter);
app.use("/api/manager", authenticate, managerAnalyticsRouter);
app.use("/api/delivery", deliveryRouter);
app.use("/api/notifications", authenticate, notificationRouter);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "OK", timestamp: new Date() }));
app.get("/", (req, res) => res.send("🪵 Woodshop ERP API v2.0 ✅"));

// 🟢 ייצוא בלבד - server.js מטפל ב-listen
export default app;