import express from "express";
import {
  getMyOrders,
  markReceived,
  markDone,
  getNotifications,
  readNotification,
  getProductsForCharacterization,
  submitCharacterization,
  getCompletedOrders,
  pauseOrderWork,
  resumeOrderWork,
  createNewBaseProductByCarpenter
} from "../controllers/carpenterController.js";
import authenticate from "../middlewares/authenticate.js";
import {authorizeRoles} from "../middlewares/authorizeRoles.js";

const router = express.Router();

// אימות והרשאות
router.use(authenticate);
router.use(authorizeRoles("CARPENTER"));

// ניהול הזמנות
router.get("/my-orders", getMyOrders); // הזמנות פעילות
router.get("/completed-orders", getCompletedOrders); // היסטוריה
router.patch("/orders/:orderId/received", markReceived); // סימון קבלת משלוח
router.patch("/orders/:orderId/done", markDone); // סימון השלמת עבודה
router.patch("/orders/:orderId/pause", pauseOrderWork); // השהיית עבודה בשל תקלה
router.patch("/orders/:orderId/resume", resumeOrderWork); // חידוש עבודה

// התראות
router.get("/notifications", getNotifications);
router.patch("/notifications/:notificationId/read", readNotification);

// אפיון מוצרים חדשים
router.get("/products-for-characterization", getProductsForCharacterization);
router.post("/characterize/:productId", submitCharacterization);
router.post("/base-products", createNewBaseProductByCarpenter);

export default router;