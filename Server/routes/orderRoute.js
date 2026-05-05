// server/routes/orderRoute.js

import express from "express";
import protect from "../middlewares/authenticate.js"; // ייצוג ל-authenticate.js
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import {
  createOrderController,
  assignCarpenter,
  assignBestCarpenter,
  getOrderById,
  getAllOrders,
  getOrdersByStatus,
  markOrderAsPaid
} from "../controllers/orderController.js";

const router = express.Router();

router.route('/')
  .post(protect, authorizeRoles(['SALES', 'MANAGER']), createOrderController)
  // השינוי: הסרנו את authorizeRoles מה-GET הראשי
  .get(protect, getAllOrders); 

router.route('/:id')
  // נשאר authorizeRoles מאחר וזה לרוב עובד היטב בראוטים ספציפיים
  .get(protect, authorizeRoles(['SALES', 'CARPENTER', 'MANAGER', 'DRIVER', 'WAREHOUSE']), getOrderById);

router.route('/status/:status')
  // נשאר authorizeRoles, שכן הוא פועל היטב ברוב המקרים
  .get(protect, authorizeRoles(['SALES', 'CARPENTER', 'MANAGER', 'DRIVER', 'WAREHOUSE']), getOrdersByStatus);

router.route('/:id/assign-carpenter')
  .put(protect, authorizeRoles(['MANAGER']), assignCarpenter)
  .patch(protect, authorizeRoles(['MANAGER']), assignCarpenter);

router.route('/:id/assign-best-carpenter')
  .post(protect, authorizeRoles(['MANAGER']), assignBestCarpenter)
  .patch(protect, authorizeRoles(['MANAGER']), assignBestCarpenter);

router.route('/:id/mark-as-paid')
  .patch(protect, authorizeRoles(['SALES', 'MANAGER']), markOrderAsPaid);

export default router;