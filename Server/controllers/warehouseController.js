import * as warehouseService from "../services/warehouseService.js";
import BaseProduct from "../models/BaseProduct.js";
import PurchaseList from "../models/PurchaseList.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { createNotification } from "../services/notificationService.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const baseProductImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/base-products";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `base_product_${Date.now()}${ext}`);
  },
});

export const uploadBaseProductImage = multer({
  storage: baseProductImageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) return cb(null, true);
    cb(new Error("ניתן להעלות רק קבצי תמונה"));
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

export const getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const status = await warehouseService.getOrderWarehouseStatus(orderId);
    res.json(status);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const markOrderReadyForShipping = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await warehouseService.markOrderReadyForShipping(orderId);
    res.json({ message: "Order marked as ready for shipping", order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateStockOnArrival = async (req, res) => {
  try {
    const body = req.body || {};
    let arrivals;
    if (Array.isArray(body)) {
      arrivals = body;
    } else if (body.arrivals && Array.isArray(body.arrivals)) {
      arrivals = body.arrivals;
    } else if (body.baseProductId != null) {
      arrivals = [{ productId: body.baseProductId, quantityArrived: Number(body.quantity) || 0 }];
    } else {
      return res.status(400).json({ error: "נדרש מערך arrivals או baseProductId + quantity" });
    }
    await warehouseService.updateStockOnArrival(arrivals);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getPurchaseList = async (req, res) => {
  try {
    const purchaseList = await warehouseService.generatePurchaseList();
    res.json(purchaseList);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getLowStockAlerts = async (req, res) => {
  try {
    const alerts = await warehouseService.getLowStockAlerts();
    res.json(alerts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateBaseProductStock = async (req, res) => {
  try {
    const { baseProductId } = req.params;
    const { quantity } = req.body;
    const baseProduct = await warehouseService.updateProductStock(baseProductId, quantity);
    res.json(baseProduct);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllBaseProducts = async (req, res) => {
  try {
    const products = await BaseProduct.find().sort({ name: 1 });

    // ניקוי נתונים היסטוריים: אין reserved שלילי/מעבר לכמות בפועל
    const updates = [];
    for (const p of products) {
      const qty = Math.max(Number(p.quantity || 0), 0);
      const reserved = Math.max(Number(p.reservedQuantity || 0), 0);
      const normalizedReserved = Math.min(reserved, qty);
      if (normalizedReserved !== reserved) {
        updates.push({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { reservedQuantity: normalizedReserved } },
          },
        });
        p.reservedQuantity = normalizedReserved;
      }
    }
    if (updates.length > 0) {
      await BaseProduct.bulkWrite(updates);
    }

    res.json(products);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createBaseProduct = async (req, res) => {
  try {
    const {
      name, code, unit, quantity, minStock, reorderQuantity,
      shelfLocation, supplier, isMaterial, materialType,
      priceDelta, image, description
    } = req.body;

    const existing = await BaseProduct.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ error: `מוצר בשם "${name}" כבר קיים במערכת` });
    }

    const nextCodeByPrefix = async (prefix) => {
      const regex = new RegExp(`^${prefix}-\\d+$`, "i");
      const existingCodes = await BaseProduct.find({ code: regex }).select("code").lean();
      const maxNum = existingCodes.reduce((max, item) => {
        const matched = item.code?.match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
        const current = matched ? Number(matched[1]) : 0;
        return current > max ? current : max;
      }, 0);
      return `${prefix}-${String(maxNum + 1).padStart(4, "0")}`;
    };

    const isFabricMaterial = (isMaterial === true || isMaterial === "true") && materialType === "fabric";
    // קוד אוטומטי לכל מוצר בסיס שמתווסף ע"י מחסנאי
    const autoCode = isFabricMaterial
      ? await nextCodeByPrefix("FAB")
      : await nextCodeByPrefix("MAT");

    const imagePath = req.file
      ? `/${req.file.path.replace(/\\/g, "/")}`
      : image;

    const product = await BaseProduct.create({
      name: name.trim(),
      code: autoCode, unit,
      quantity: quantity || 0,
      minStock: minStock || 5,
      reorderQuantity: reorderQuantity || 20,
      shelfLocation, supplier,
      isMaterial: isMaterial || false,
      materialType: materialType || null,
      priceDelta: priceDelta || 0,
      image: imagePath || null, description,
      isNew: true,
    });

    if (isFabricMaterial) {
      const warehouseUsers = await User.find({ role: "WAREHOUSE" }).select("_id").lean();
      await Promise.all(
        warehouseUsers.map((w) =>
          createNotification(
            w._id,
            `נוסף בד ריפוד חדש (${product.name}, דגם ${product.code}) - נדרשת אספקה ראשונית`,
            "INFO"
          )
        )
      );
    }

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateBaseProduct = async (req, res) => {
  try {
    const { baseProductId } = req.params;
    const {
      name, code, unit, quantity, minStock, reorderQuantity,
      shelfLocation, supplier, isMaterial, materialType,
      priceDelta, image, description, confirmNewProduct
    } = req.body;

    const nextQuantity = Number(quantity || 0);
    const existing = await BaseProduct.findById(baseProductId).select("reservedQuantity");
    if (!existing) return res.status(404).json({ error: 'מוצר לא נמצא' });
    const normalizedReserved = Math.min(
      Math.max(Number(existing.reservedQuantity || 0), 0),
      Math.max(nextQuantity, 0)
    );

    const isConfirmNew = !!confirmNewProduct;
    const updatePayload = {
      name, code, unit,
      // באישור מוצר חדש: הכמות בטופס היא כמות להזמנה ראשונית (לא מלאי קיים)
      quantity: isConfirmNew ? 0 : quantity,
      minStock, reorderQuantity,
      shelfLocation, supplier, isMaterial,
      materialType: isMaterial ? materialType : null,
      priceDelta, image, description,
      reservedQuantity: normalizedReserved,
      ...(isConfirmNew ? { isNew: false, pendingInitialSupplyQty: Math.max(nextQuantity, 0) } : {}),
    };

    const product = await BaseProduct.findByIdAndUpdate(
      baseProductId,
      updatePayload,
      { new: true, runValidators: true }
    );

    if (isConfirmNew) {
      // שומרים שורת רכש ראשונית ייעודית עד הגעת הסחורה בפועל
      await PurchaseList.findOneAndUpdate(
        { product: product._id, status: { $in: ['PENDING', 'SENT_TO_SUPPLIER'] } },
        {
          product: product._id,
          totalQuantityNeeded: Math.max(nextQuantity, 0),
          forOrders: 0,
          forStock: Math.max(nextQuantity, 0),
          supplierName: product.supplier || 'ללא ספק',
          status: 'PENDING',
          sentAt: null,
          arrivedAt: null,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const pickMaterial = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { materialId } = req.body;
    const warehouseUserId = req.body.warehouseUserId ?? req.user?.id;
    if (materialId == null || materialId === "") {
      return res.status(400).json({ error: "חסר מזהה חומר (materialId)" });
    }
    await warehouseService.pickMaterial(orderId, materialId, warehouseUserId);

    const populated = await Order.findById(orderId)
      .populate('requiredMaterials.product')
      .populate('unavailableMaterials.product')
      .populate('assignedCarpenter', 'fullName address phone');

    res.json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getOrdersWithNewProducts = async (req, res) => {
  try {
    const newProducts = await BaseProduct.find({ isNew: true }).select('_id name');
    const newProductIds = newProducts.map(p => p._id.toString());

    if (newProductIds.length === 0) return res.json([]);

    const orders = await Order.find({
      status: { $in: ['WAITING_FOR_SUPPLY', 'WAITING_FOR_PICKING', 'WAITING_FOR_WAREHOUSE'] },
      'requiredMaterials.product': { $in: newProductIds }
    })
      .populate('requiredMaterials.product')
      .populate('assignedCarpenter', 'fullName')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const markBaseProductAsSupplied = async (req, res) => {
  try {
    const { baseProductId } = req.params;
    const { quantity } = req.body;

    const product = await BaseProduct.findByIdAndUpdate(
      baseProductId,
      { isNew: false, $set: { quantity: quantity || 0 } },
      { new: true }
    );

    if (!product) return res.status(404).json({ error: 'מוצר לא נמצא' });
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── ניהול ספקים ברשימת רכש ─────────────────────────────

export const markSupplierSent = async (req, res) => {
  try {
    const { supplierName } = req.params;
    const items = await warehouseService.markSupplierAsSent(
      decodeURIComponent(supplierName)
    );
    res.json(items);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const markSupplierArrived = async (req, res) => {
  try {
    const { supplierName } = req.params;
    const result = await warehouseService.processSupplierArrival(
      decodeURIComponent(supplierName)
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};