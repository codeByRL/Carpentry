import multer from "multer";
import path from "path";
import {
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
} from "../services/catalogService.js";
import CatalogProduct from "../models/CatalogProduct.js";

// ─── Multer ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.UPLOADS_DIR || "uploads";
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `product_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// ─── יצירת מוצר ───────────────────────────────────────────────
const createProduct = async (req, res) => {
  try {
    const imagePath = req.file ? `/${process.env.UPLOADS_DIR || "uploads"}/${req.file.filename}` : null;
    const product = await createNewProduct(req.body, req.user.id, imagePath);
    res.status(201).json({ message: "המוצר נוצר", product });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── יצירת תמונה עם AI ────────────────────────────────────────
const generateAIImage = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: "חסר פרומפט" });
    const imageUrl = await generateImageWithAI(prompt);
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── שיוך נגר (הוספתי כאן לוגים !) ─────────────────────────────────
const assignCarpenter = async (req, res) => {
  try {
    const { productId, carpenterId } = req.body;
    
    // לוג לבדיקת הנתונים שמגיעים מהפרונט
    console.log('--- Debug Assign Carpenter ---');
    console.log('Product ID:', productId);
    console.log('Carpenter ID:', carpenterId);

    const product = await assignCarpenterForCharacterization(productId, carpenterId);
    res.json({ message: "נגר שויך", product });
  } catch (error) {
    // לוג לבדיקת השגיאה המדויקת שזורק ה-Service
    console.error('Assign Carpenter Error:', error.message);
    res.status(400).json({ message: error.message });
  }
};

// ─── שינוי נגר ────────────────────────────────────────────────
const reassignCarpenterCtrl = async (req, res) => {
  try {
    const product = await reassignCarpenter(req.params.productId, req.body.carpenterId);
    res.json({ message: "נגר הוחלף", product });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── אפיון נגר ────────────────────────────────────────────────
const characterize = async (req, res) => {
  try {
    const product = await characterizeProduct(req.params.productId, req.body);
    res.json({ message: "המוצר אופיין", product });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── אישור מנהל ───────────────────────────────────────────────
const approve = async (req, res) => {
  try {
    const product = await approveProduct(req.params.productId, req.body.price);
    res.json({ message: "המוצר אושר", product });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── עריכת מוצר ───────────────────────────────────────────────
const editProduct = async (req, res) => {
  try {
    const imagePath = req.file ? `/${process.env.UPLOADS_DIR || "uploads"}/${req.file.filename}` : null;
    const product = await updateProduct(req.params.productId, req.body, imagePath);
    res.json({ message: "המוצר עודכן", product });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── מחיקת מוצר ───────────────────────────────────────────────
const removeProduct = async (req, res) => {
  try {
    await deleteProduct(req.params.productId);
    res.json({ message: "המוצר נמחק" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── שליפת לפי סטטוס ──────────────────────────────────────────
const getByStatus = async (req, res) => {
  try {
    const products = await getProductsByStatus(req.params.status);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── מוצרים פעילים ────────────────────────────────────────────
const getActiveCatalog = async (req, res) => {
  try {
    const products = await CatalogProduct.find({ status: "ACTIVE" })
      .populate("baseProducts.product");
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── כל הנגרים ────────────────────────────────────────────────
const getCarpenters = async (req, res) => {
  try {
    const carpenters = await getAllCarpenters();
    res.json(carpenters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  upload,
  createProduct,
  generateAIImage,
  assignCarpenter,
  reassignCarpenterCtrl,
  characterize,
  approve,
  editProduct,
  removeProduct,
  getByStatus,
  getActiveCatalog,
  getCarpenters,
};