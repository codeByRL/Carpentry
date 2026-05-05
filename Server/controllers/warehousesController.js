import Warehouse from "../models/Warehouse.js";
import User from "../models/User.js";

// GET /api/warehouses
export const getAllWarehouses = async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ isActive: true }).sort({ name: 1 });
    res.json(warehouses);
  } catch (err) {
    res.status(500).json({ message: "שגיאה בטעינת מחסנים" });
  }
};

// POST /api/warehouses
export const createWarehouse = async (req, res) => {
  try {
    const { name, address, description = "" } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "שם מחסן הוא שדה חובה" });
    if (!address?.trim()) return res.status(400).json({ message: "כתובת היא שדה חובה" });

    const existing = await Warehouse.findOne({ name: name.trim() });
    if (existing) return res.status(400).json({ message: "כבר קיים מחסן עם שם זה" });

    const warehouse = await Warehouse.create({
      name: name.trim(),
      address: address.trim(),
      description,
      isActive: true,
    });

    res.status(201).json(warehouse);
  } catch (err) {
    res.status(500).json({ message: "שגיאה ביצירת מחסן" });
  }
};

// PATCH /api/warehouses/:id
export const updateWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ message: "מחסן לא נמצא" });

    const { name, address, description, isActive } = req.body;

    if (name?.trim()) warehouse.name = name.trim();
    if (address?.trim()) warehouse.address = address.trim();
    if (typeof description === "string") warehouse.description = description;
    if (typeof isActive === "boolean") warehouse.isActive = isActive;

    await warehouse.save();
    res.json(warehouse);
  } catch (err) {
    res.status(500).json({ message: "שגיאה בעדכון מחסן" });
  }
};

// DELETE /api/warehouses/:id
export const deleteWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ message: "מחסן לא נמצא" });

    // הגנה: לא מוחקים אם יש מחסנאים מקושרים
    const linked = await User.countDocuments({
      role: "WAREHOUSE",
      warehouse: req.params.id,
      isActive: true,
    });

    if (linked > 0) {
      return res.status(400).json({
        message: `לא ניתן למחוק — ${linked} מחסנאים מקושרים למחסן זה`,
      });
    }

    await warehouse.deleteOne();
    res.json({ message: "מחסן נמחק בהצלחה" });
  } catch (err) {
    res.status(500).json({ message: "שגיאה במחיקת מחסן" });
  }
};