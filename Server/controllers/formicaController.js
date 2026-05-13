import FormicaModel from "../models/FormicaModel.js";
import BaseProduct from "../models/BaseProduct.js";
import User from "../models/User.js";
import { createNotification } from "../services/notificationService.js";
import { nextMaterialCode } from "../utils/materialCode.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/formica";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `formica_${Date.now()}${ext}`);
  },
});

export const uploadFormicaImage = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) return cb(null, true);
    cb(new Error("ניתן להעלות רק קבצי תמונה"));
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

const assertManager = (req, res) => {
  if (req.user?.role !== "MANAGER") {
    res.status(403).json({ error: "פעולה זו מותרת למנהל בלבד" });
    return false;
  }
  return true;
};

const syncLinkedBaseProduct = async (formica, updates = {}) => {
  if (!formica?.baseProductId) return;
  const bpUpdates = {};
  if (updates.name !== undefined) bpUpdates.name = updates.name;
  if (updates.supplier !== undefined) bpUpdates.supplier = updates.supplier;
  if (updates.description !== undefined) bpUpdates.description = updates.description;
  if (updates.priceDelta !== undefined) bpUpdates.priceDelta = updates.priceDelta;
  if (updates.image !== undefined) bpUpdates.image = updates.image;
  if (Object.keys(bpUpdates).length) {
    await BaseProduct.findByIdAndUpdate(formica.baseProductId, bpUpdates);
  }
};

export const listFormicaModels = async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
    const items = await FormicaModel.find()
      .sort({ name: 1 })
      .limit(limit)
      .lean();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFormicaModel = async (req, res) => {
  try {
    const item = await FormicaModel.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ error: "דגם פורמייקה לא נמצא" });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const validateFormicaFields = (fields, { requireImage, hasImage }) => {
  if (!String(fields.name || "").trim()) return "שם דגם פורמייקה הוא שדה חובה";
  if (!String(fields.supplier || "").trim()) return "שם ספק הוא שדה חובה";
  if (!String(fields.description || "").trim()) return "תיאור הוא שדה חובה";
  if (
    fields.priceDelta === undefined ||
    fields.priceDelta === null ||
    String(fields.priceDelta).trim() === "" ||
    Number.isNaN(Number(fields.priceDelta))
  ) {
    return "תוספת מחיר היא שדה חובה";
  }
  if (requireImage && !hasImage) return "תמונה היא שדה חובה";
  return null;
};

export const createFormicaModel = async (req, res) => {
  try {
    if (!assertManager(req, res)) return;
    const { name, supplier, description, priceDelta, quantity } = req.body;
    const imagePath = req.file ? `/${req.file.path.replace(/\\/g, "/")}` : null;
    const validationError = validateFormicaFields(
      { name, supplier, description, priceDelta },
      { requireImage: true, hasImage: !!imagePath }
    );
    if (validationError) return res.status(400).json({ error: validationError });

    const existing = await FormicaModel.findOne({ name: name.trim() });
    if (existing) return res.status(409).json({ error: `דגם פורמייקה בשם "${name.trim()}" כבר קיים` });

    const code = await nextMaterialCode("FOR");
    const initialQty = Number(quantity) || 0;

    const baseProduct = await BaseProduct.create({
      name: name.trim(),
      code,
      unit: "מ״ר",
      quantity: initialQty,
      minStock: 1,
      reorderQuantity: 10,
      supplier: supplier?.trim() || "",
      description: description?.trim() || "",
      isMaterial: true,
      materialType: "formica",
      priceDelta: Number(priceDelta) || 0,
      image: imagePath,
      isNew: initialQty <= 0,
      pendingInitialSupplyQty: initialQty <= 0 ? 10 : 0,
    });

    const item = await FormicaModel.create({
      name: name.trim(),
      code,
      supplier: supplier?.trim() || "",
      description: description?.trim() || "",
      priceDelta: Number(priceDelta) || 0,
      image: imagePath,
      baseProductId: baseProduct._id,
    });

    baseProduct.formicaModelId = item._id;
    await baseProduct.save();

    if (initialQty <= 0) {
      const warehouseUsers = await User.find({ role: "WAREHOUSE" }).select("_id").lean();
      await Promise.all(
        warehouseUsers.map((w) =>
          createNotification(
            w._id,
            `נוספה פורמייקה חדשה (${item.name}, דגם ${code}) - נדרשת אספקה ראשונית`,
            "INFO"
          )
        )
      );
    }

    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateFormicaModel = async (req, res) => {
  try {
    if (!assertManager(req, res)) return;
    const existing = await FormicaModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "דגם פורמייקה לא נמצא" });

    const { name, supplier, description, priceDelta } = req.body;
    const nextImage = req.file
      ? `/${req.file.path.replace(/\\/g, "/")}`
      : existing.image;

    const validationError = validateFormicaFields(
      {
        name: name !== undefined ? name : existing.name,
        supplier: supplier !== undefined ? supplier : existing.supplier,
        description: description !== undefined ? description : existing.description,
        priceDelta: priceDelta !== undefined ? priceDelta : existing.priceDelta,
      },
      { requireImage: true, hasImage: !!nextImage }
    );
    if (validationError) return res.status(400).json({ error: validationError });

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (supplier !== undefined) updates.supplier = String(supplier).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (priceDelta !== undefined) updates.priceDelta = Number(priceDelta) || 0;
    if (req.file) updates.image = nextImage;

    const item = await FormicaModel.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ error: "דגם פורמייקה לא נמצא" });
    await syncLinkedBaseProduct(item, updates);
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteFormicaModel = async (req, res) => {
  try {
    if (!assertManager(req, res)) return;
    const item = await FormicaModel.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "דגם פורמייקה לא נמצא" });
    if (item.baseProductId) {
      await BaseProduct.findByIdAndDelete(item.baseProductId);
    }
    res.json({ message: "דגם הפורמייקה נמחק" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
