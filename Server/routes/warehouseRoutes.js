import express from "express";
import authenticate from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";

import {
  getOrderStatus,
  markOrderReadyForShipping,
  updateStockOnArrival,
  getPurchaseList,
  getLowStockAlerts,
  updateBaseProductStock,
  getAllBaseProducts,
  createBaseProduct,
  uploadBaseProductImage,
  updateBaseProduct,
  pickMaterial,
  getOrdersWithNewProducts,
  markBaseProductAsSupplied,
  markSupplierSent,
  markSupplierArrived,
} from "../controllers/warehouseController.js";

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("WAREHOUSE", "MANAGER"));

// ─── הזמנות ──────────────────────────────────────────────
router.get("/order/:orderId/status",              getOrderStatus);
router.post("/order/:orderId/ready-for-shipping", markOrderReadyForShipping);
router.patch("/order/:orderId/pick",              pickMaterial);

// ─── מלאי ────────────────────────────────────────────────
router.post("/stock/arrival",                     updateStockOnArrival);
router.get("/low-stock-alerts",                   getLowStockAlerts);

// ─── מוצרי בסיס ──────────────────────────────────────────
router.get("/base-products",                      getAllBaseProducts);
router.post("/base-products",                     uploadBaseProductImage.single("image"), createBaseProduct);
router.put("/base-products/:baseProductId", uploadBaseProductImage.single("image"), updateBaseProduct);
router.patch("/base-products/:baseProductId/stock",    updateBaseProductStock);
router.patch("/base-products/:baseProductId/supplied", markBaseProductAsSupplied);

// ─── רכש ─────────────────────────────────────────────────
router.get("/purchase-list",                      getPurchaseList);
router.patch("/purchase-list/supplier/:supplierName/sent",    markSupplierSent);
router.patch("/purchase-list/supplier/:supplierName/arrived", markSupplierArrived);

// ─── מוצרים חדשים ────────────────────────────────────────
router.get("/orders-with-new-products",           getOrdersWithNewProducts);

export default router;