import CatalogProduct from "../models/CatalogProduct.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import axios from "axios";
import fs from "fs";
import path from "path";

// ─── יצירת מוצר חדש ───────────────────────────────────────────
const createNewProduct = async (data, managerId, imagePath) => {
  const product = new CatalogProduct({
    name: data.name,
    description: data.description,
    image: imagePath || data.imageUrl || null,
    needsWoodSelection: data.needsWoodSelection === 'true' || data.needsWoodSelection === true,
    needsFabricSelection: data.needsFabricSelection === 'true' || data.needsFabricSelection === true,
    createdBy: managerId,
    status: "PENDING_CHARACTERIZATION",
  });
  await product.save();
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

  product.baseProducts = data.baseProducts;
  product.estimatedWorkTime = data.estimatedWorkTime;
  if (data.woodOptions) product.woodOptions = data.woodOptions;
  if (data.fabricOptions) product.fabricOptions = data.fabricOptions;
  if (typeof data.needsWoodSelection === "boolean") product.needsWoodSelection = data.needsWoodSelection;
  if (typeof data.needsFabricSelection === "boolean") product.needsFabricSelection = data.needsFabricSelection;
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
  if (imagePath) updates.image = imagePath;
  const product = await CatalogProduct.findByIdAndUpdate(productId, updates, { new: true });
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