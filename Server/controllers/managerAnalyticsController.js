import * as analyticsService from "../services/managerAnalyticsService.js";
import User from "../models/User.js";
import multer from "multer";
import path from "path";
import fs from "fs";

// הגדרת multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/contracts";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `contract_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

export const uploadContract = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("רק קבצי PDF ו-Word מותרים"));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// GET /api/manager/employees
export const getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find()
      .populate("warehouse")
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(employees);
  } catch (error) {
    console.error("Error in getAllEmployees:", error); // ← ידפיס בטרמינל השרת
    res.status(500).json({ message: "שגיאה בטעינת עובדים", error: error.message });
  }
};

// GET /api/manager/dashboard
export const getDashboardData = async (req, res) => {
  try {
    const [monthlyStats, warehousePerf, carpentersWorkload, statusDist] = await Promise.all([
      analyticsService.getMonthlyStats(),
      analyticsService.getWarehousePerformance(),
      analyticsService.getCarpentersWorkload(),
      analyticsService.getOrderStatusDistribution()
    ]);

    res.json({
      monthlyStats,
      warehousePerformance: warehousePerf,
      carpentersWorkload,
      orderStatusDistribution: statusDist
    });
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: "Error fetching dashboard data" });
  }
};

// POST /api/manager/employees
export const createEmployee = async (req, res) => {
  try {
    const {
      fullName, email, password, role,
      phone, address,
      emergencyContactName, emergencyContactPhone, emergencyContactRelation,
      idNumber, birthDate, gender,
      startDate, employmentType, salary,
      bankName, branchNumber, accountNumber,
      warehouse, seniority, specialization, notes
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "האימייל כבר קיים" });
    }

    const newUser = new User({
      fullName, email, password, role,
      phone: phone || "",
      address: address || "",
      emergencyContact: {
        name: emergencyContactName || "",
        phone: emergencyContactPhone || "",
        relation: emergencyContactRelation || ""
      },
      idNumber: idNumber || "",
      birthDate: birthDate || null,
      gender: gender || "",
      startDate: startDate || Date.now(),
      employmentType: employmentType || "FULL_TIME",
      salary: salary || 0,
      bankDetails: {
        bankName: bankName || "",
        branchNumber: branchNumber || "",
        accountNumber: accountNumber || ""
      },
      warehouse: (role === "WAREHOUSE" && warehouse) ? warehouse : null,
      seniority: role === "CARPENTER" ? (Number(seniority) || 0) : 0,
      specialization: role === "CARPENTER" ? specialization || "" : "",
      notes: notes || "",
      contractFile: req.file ? req.file.path : ""
    });

    await newUser.save();
    const result = newUser.toObject();
    delete result.password;
    res.status(201).json(result);
  } catch (error) {
    console.error("Create Employee Error:", error);
    res.status(500).json({ message: "שגיאה ביצירת עובד" });
  }
};

// DELETE /api/manager/employees/:id
export const deleteEmployee = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "עובד נמחק בהצלחה" });
  } catch (error) {
    console.error("Delete Employee Error:", error);
    res.status(500).json({ message: "שגיאה במחיקת עובד" });
  }
};

// PATCH /api/manager/employees/:id
export const updateEmployee = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.file) updateData.contractFile = req.file.path;

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select("-password");

    res.json(updated);
  } catch (error) {
    console.error("Update Employee Error:", error);
    res.status(500).json({ message: "שגיאה בעדכון עובד" });
  }
};