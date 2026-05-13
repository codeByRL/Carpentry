import CatalogProduct, { CATALOG_CATEGORIES } from "../models/CatalogProduct.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import axios from "axios";
import fs from "fs";
import path from "path";

const normalizeCategory = (rawValue) => {
  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!value) return null;
  return CATALOG_CATEGORIES.includes(value) ? value : null;
};

// ─── יצירת מוצר חדש ───────────────────────────────────────────
const createNewProduct = async (data, managerId, imagePath) => {
  const category = normalizeCategory(data.category);
  if (!category) {
    throw new Error(
      `יש לבחור קטגוריית מוצר חוקית מהרשימה: ${CATALOG_CATEGORIES.join(", ")}`
    );
  }
  const carpenterId = data.carpenterId;
  if (!carpenterId) {
    throw new Error("יש לבחור נגר לאפיון לפני יצירת המוצר");
  }
  const carpenter = await User.findById(carpenterId);
  if (!carpenter || carpenter.role !== "CARPENTER") {
    throw new Error("נגר לא תקין");
  }
  // תמונה היא שדה חובה — הנגר חייב לראות מה הוא מאפיין.
  const finalImage = imagePath || (typeof data.imageUrl === "string" ? data.imageUrl.trim() : "") || null;
  if (!finalImage) {
    throw new Error("יש להעלות תמונה למוצר (או לייצר תמונה עם AI) לפני שליחתו לאפיון");
  }
  const product = new CatalogProduct({
    name: data.name,
    category,
    description: data.description,
    image: finalImage,
    needsWoodSelection: false,
    needsFabricSelection: false,
    woodOptions: [],
    fabricOptions: [],
    createdBy: managerId,
    assignedCarpenter: carpenterId,
    status: "PENDING_CHARACTERIZATION",
  });
  await product.save();

  await Notification.create({
    user: carpenterId,
    type: "INFO",
    message: `התבקשת לאפיין את המוצר: ${product.name}`,
  });

  return product;
};

// ─── שיוך נגר + התראה ─────────────────────────────────────────
const assignCarpenterForCharacterization = async (productId, carpenterId) => {
  const carpenter = await User.findById(carpenterId);
  if (!carpenter || carpenter.role !== "CARPENTER") throw new Error("נגר לא תקין");

  const product = await CatalogProduct.findByIdAndUpdate(
    productId,
    { assignedCarpenter: carpenterId },
    { new: true }
  );
  if (!product) throw new Error("מוצר לא נמצא");

  await Notification.create({
    user: carpenterId,        // ✅ תוקן: recipient → user
    type: "INFO",             // ✅ תוקן: enum תקין
    message: `התבקשת לאפיין את המוצר: ${product.name}`,
  });

  return product;
};

// ─── נגר מאפיין + התראה למנהל ─────────────────────────────────
const characterizeProduct = async (productId, data) => {
  const product = await CatalogProduct.findById(productId);
  if (!product || product.status !== "PENDING_CHARACTERIZATION")
    throw new Error("מוצר לא זמין לאפיון");
  if (!product.assignedCarpenter) {
    throw new Error("למוצר לא שויך נגר — יש לשייך נגר לפני אפיון");
  }

  product.baseProducts = data.baseProducts;
  product.estimatedWorkTime = data.estimatedWorkTime;
  product.woodOptions = [];
  product.needsWoodSelection = false;

  const fabricToggle = data.needsFabricSelection === true || data.needsFabricSelection === "true";
  product.needsFabricSelection = fabricToggle;
  if (fabricToggle) {
    const qty = Number(data.fabricQuantityPerUnit);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("כשנדרשת בחירת בד יש להזין כמות בד נדרשת ליחידה (גדולה מ־0)");
    }
    product.fabricQuantityPerUnit = qty;
  } else {
    product.fabricQuantityPerUnit = 0;
  }

  product.needsFormicaSelection =
    data.needsFormicaSelection === true || data.needsFormicaSelection === "true";
  if (product.needsFormicaSelection) {
    const formicaQty = Number(data.formicaQuantityPerUnit);
    if (!Number.isFinite(formicaQty) || formicaQty <= 0) {
      throw new Error("כשנדרשת בחירת פורמייקה יש להזין כמות פורמייקה נדרשת ליחידה (גדולה מ־0)");
    }
    product.formicaQuantityPerUnit = formicaQty;
  } else {
    product.formicaQuantityPerUnit = 0;
  }

  product.needsHandleSelection =
    data.needsHandleSelection === true || data.needsHandleSelection === "true";
  if (product.needsHandleSelection) {
    const handleQty = Number(data.handleQuantityPerUnit);
    if (!Number.isFinite(handleQty) || handleQty <= 0) {
      throw new Error("כשנדרשת בחירת ידית יש להזין כמות ידיות נדרשת ליחידה (גדולה מ־0)");
    }
    product.handleQuantityPerUnit = handleQty;
  } else {
    product.handleQuantityPerUnit = 0;
  }

  product.status = "WAITING_ADMIN_APPROVAL";
  await product.save();

  const managers = await User.find({ role: "MANAGER" });
  await Promise.all(managers.map(m =>
    Notification.create({
      user: m._id,            // ✅ תוקן: recipient → user
      type: "INFO",           // ✅ תוקן: enum תקין
      message: `המוצר "${product.name}" אופיין ומחכה לאישורך`,
    })
  ));

  return product;
};

// ─── מנהל מאשר + קובע מחיר ────────────────────────────────────
const approveProduct = async (productId, price) => {
  const product = await CatalogProduct.findById(productId);
  if (!product || product.status !== "WAITING_ADMIN_APPROVAL")
    throw new Error("מוצר לא ממתין לאישור");

  product.price = price;
  product.status = "ACTIVE";
  await product.save();
  return product;
};

// ─── עריכת מוצר ───────────────────────────────────────────────
const updateProduct = async (productId, updates, imagePath) => {
  // ⚠️ לעולם אל תיקח את שדה image מהבודי — multer מחזיר את הקובץ ב־req.file,
  // וכל ערך אחר ב־req.body.image הוא זבל (לרוב אובייקט ריק שמגיע מ־FormData)
  // שיגרום ל־Cast to string failed ב־Mongoose.
  const { image: _ignoredImage, ...rest } = updates || {};
  const payload = { ...rest };
  if (imagePath) {
    payload.image = imagePath;
  } else if (typeof updates?.imageUrl === "string" && updates.imageUrl.trim()) {
    payload.image = updates.imageUrl.trim();
  }
  delete payload.imageUrl;
  if (payload.price === "" || payload.price === undefined) payload.price = null;
  else if (payload.price != null) payload.price = Number(payload.price);
  if (payload.estimatedWorkTime === "" || payload.estimatedWorkTime === undefined) {
    payload.estimatedWorkTime = null;
  } else if (payload.estimatedWorkTime != null) {
    payload.estimatedWorkTime = Number(payload.estimatedWorkTime);
  }
  if (payload.category !== undefined) {
    const normalized = normalizeCategory(payload.category);
    if (!normalized) {
      throw new Error(
        `קטגוריה לא חוקית. בחר אחת מתוך: ${CATALOG_CATEGORIES.join(", ")}`
      );
    }
    payload.category = normalized;
  }

  // נירמול דגלי בחירת בד וכמות הבד הנדרשת ליחידה.
  if (payload.needsFabricSelection !== undefined) {
    payload.needsFabricSelection =
      payload.needsFabricSelection === true || payload.needsFabricSelection === "true";
  }
  if (payload.needsFabricSelection === false) {
    payload.fabricQuantityPerUnit = 0;
  } else if (payload.fabricQuantityPerUnit !== undefined) {
    if (payload.fabricQuantityPerUnit === "" || payload.fabricQuantityPerUnit === null) {
      payload.fabricQuantityPerUnit = 0;
    } else {
      const qty = Number(payload.fabricQuantityPerUnit);
      if (!Number.isFinite(qty) || qty < 0) {
        throw new Error("כמות בד ליחידה חייבת להיות מספר אי־שלילי");
      }
      payload.fabricQuantityPerUnit = qty;
    }
  }
  if (payload.needsFabricSelection === true) {
    const qty = Number(payload.fabricQuantityPerUnit || 0);
    if (qty <= 0) {
      throw new Error("כשמסומן 'דורש בחירת בד' יש להזין כמות בד נדרשת ליחידה (גדולה מ־0)");
    }
  }

  if (payload.needsFormicaSelection !== undefined) {
    payload.needsFormicaSelection =
      payload.needsFormicaSelection === true || payload.needsFormicaSelection === "true";
  }
  if (payload.needsFormicaSelection === false) {
    payload.formicaQuantityPerUnit = 0;
  } else if (payload.formicaQuantityPerUnit !== undefined) {
    if (payload.formicaQuantityPerUnit === "" || payload.formicaQuantityPerUnit === null) {
      payload.formicaQuantityPerUnit = 0;
    } else {
      const qty = Number(payload.formicaQuantityPerUnit);
      if (!Number.isFinite(qty) || qty < 0) {
        throw new Error("כמות פורמייקה ליחידה חייבת להיות מספר אי־שלילי");
      }
      payload.formicaQuantityPerUnit = qty;
    }
  }
  if (payload.needsFormicaSelection === true) {
    const qty = Number(payload.formicaQuantityPerUnit || 0);
    if (qty <= 0) {
      throw new Error("כשמסומן 'דורש בחירת פורמייקה' יש להזין כמות פורמייקה נדרשת ליחידה (גדולה מ־0)");
    }
  }

  if (payload.needsHandleSelection !== undefined) {
    payload.needsHandleSelection =
      payload.needsHandleSelection === true || payload.needsHandleSelection === "true";
  }
  if (payload.needsHandleSelection === false) {
    payload.handleQuantityPerUnit = 0;
  } else if (payload.handleQuantityPerUnit !== undefined) {
    if (payload.handleQuantityPerUnit === "" || payload.handleQuantityPerUnit === null) {
      payload.handleQuantityPerUnit = 0;
    } else {
      const qty = Number(payload.handleQuantityPerUnit);
      if (!Number.isFinite(qty) || qty < 0) {
        throw new Error("כמות ידיות ליחידה חייבת להיות מספר אי־שלילי");
      }
      payload.handleQuantityPerUnit = qty;
    }
  }
  if (payload.needsHandleSelection === true) {
    const qty = Number(payload.handleQuantityPerUnit || 0);
    if (qty <= 0) {
      throw new Error("כשמסומן 'דורש בחירת ידית' יש להזין כמות ידיות נדרשת ליחידה (גדולה מ־0)");
    }
  }

  const product = await CatalogProduct.findByIdAndUpdate(productId, payload, {
    new: true,
    runValidators: true,
  });
  if (!product) throw new Error("מוצר לא נמצא");
  return product;
};

// ─── מחיקת מוצר ───────────────────────────────────────────────
const deleteProduct = async (productId) => {
  const product = await CatalogProduct.findByIdAndDelete(productId);
  if (!product) throw new Error("מוצר לא נמצא");
  return product;
};

// ─── שינוי נגר משויך ──────────────────────────────────────────
const reassignCarpenter = async (productId, newCarpenterId) => {
  const carpenter = await User.findById(newCarpenterId);
  if (!carpenter || carpenter.role !== "CARPENTER") throw new Error("נגר לא תקין");

  const product = await CatalogProduct.findByIdAndUpdate(
    productId,
    { assignedCarpenter: newCarpenterId },
    { new: true }
  );
  if (!product) throw new Error("מוצר לא נמצא");

  await Notification.create({
    user: newCarpenterId,     // ✅ תוקן: recipient → user
    type: "INFO",             // ✅ תוקן: enum תקין
    message: `הועברת לאפיין את המוצר: ${product.name}`,
  });

  return product;
};

// ─── יצירת תמונה עם Abacus AI ─────────────────────────────────
const generateImageWithAI = async (prompt) => {
  try {
    if (!process.env.ABACUS_BASE_URL || !process.env.ABACUS_API_KEY) {
      throw new Error("חסרה הגדרת ABACUS_BASE_URL או ABACUS_API_KEY בשרת");
    }

    const baseUrl = process.env.ABACUS_BASE_URL.endsWith('/v1')
      ? process.env.ABACUS_BASE_URL
      : `${process.env.ABACUS_BASE_URL}/v1`;

    const response = await axios.post(
      `${baseUrl}/images/generations`,
      { prompt: `Create a professional product image for a carpentry business: ${prompt}`, n: 1, size: "1024x1024" },
      { headers: { "Authorization": `Bearer ${process.env.ABACUS_API_KEY}`, "Content-Type": "application/json" } }
    );

    if (!response.data.data || !response.data.data[0].url)
      throw new Error("לא נוצרה תמונה על ידי ה-AI");

    const imageUrl = response.data.data[0].url;
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });

    const uploadsDir = process.env.UPLOADS_DIR || "uploads";
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const fileName = `ai_${Date.now()}.png`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, imageResponse.data);

    return `/${uploadsDir}/${fileName}`;
  } catch (error) {
    console.error("שגיאה ביצירת תמונה:", error.message);
    throw new Error(`שגיאה ביצירת תמונה: ${error.message}`);
  }
};

// ─── שליפת מוצרים לפי סטטוס ───────────────────────────────────
const getProductsByStatus = async (status) => {
  return CatalogProduct.find({ status })
    .populate("baseProducts.product", "name code unit")
    .populate("createdBy", "fullName")
    .populate("assignedCarpenter", "fullName seniority currentWorkloadHours");
};

// ─── שליפת כל הנגרים ──────────────────────────────────────────
const getAllCarpenters = async () => {
  return User.find({ role: "CARPENTER" }).select("fullName seniority currentWorkloadHours");
};

export {
  createNewProduct,
  assignCarpenterForCharacterization,
  characterizeProduct,
  approveProduct,
  updateProduct,
  deleteProduct,
  reassignCarpenter,
  generateImageWithAI,
  getProductsByStatus,
  getAllCarpenters,
};