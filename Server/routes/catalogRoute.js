import express from "express";
import {
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
  upload,
} from "../controllers/catalogController.js";

const router = express.Router();

// ── נתיבים ספציפיים קודם (לפני /:productId) ──────────────────────────

// שליפת מוצרים פעילים
router.get("/active", getActiveCatalog);

// שליפת מוצרים לפי סטטוס
router.get("/status/:status", getByStatus);

// שליפת כל הנגרים
router.get("/carpenters", getCarpenters);

// יצירת תמונת AI
router.post("/generate-image", generateAIImage);

// שיוך נגר למוצר
router.post("/assign-carpenter", assignCarpenter);

// ── נתיבים כלליים (CRUD סטנדרטי) ────────────────────────────────────

// יצירת מוצר חדש
router.post("/", upload.single("image"), createProduct);

// עריכת מוצר
router.put("/:productId", upload.single("image"), editProduct);

// אפיון מוצר על ידי נגר
router.patch("/:productId/characterize", characterize);

// אישור מוצר על ידי מנהל
router.patch("/:productId/approve", approve);

// החלפת נגר
router.patch("/:productId/reassign", reassignCarpenterCtrl);

// מחיקת מוצר
router.delete("/:productId", removeProduct);

export default router;