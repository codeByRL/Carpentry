// server/routes/orderRoute.js

import express from "express";
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
  .post(authorizeRoles('SALES', 'MANAGER'), createOrderController)
  // השינוי: הסרנו את authorizeRoles מה-GET הראשי
  .get(getAllOrders); 

router.route('/:id')
  // נשאר authorizeRoles מאחר וזה לרוב עובד היטב בראוטים ספציפיים
  .get(authorizeRoles('SALES', 'CARPENTER', 'MANAGER', 'DRIVER', 'WAREHOUSE'), getOrderById);

router.route('/status/:status')
  // נשאר authorizeRoles, שכן הוא פועל היטב ברוב המקרים
  .get(authorizeRoles('SALES', 'CARPENTER', 'MANAGER', 'DRIVER', 'WAREHOUSE'), getOrdersByStatus);

router.route('/:id/assign-carpenter')
  .put(authorizeRoles('MANAGER'), assignCarpenter)
  .patch(authorizeRoles('MANAGER'), assignCarpenter);

router.route('/:id/assign-best-carpenter')
  .post(authorizeRoles('MANAGER'), assignBestCarpenter)
  .patch(authorizeRoles('MANAGER'), assignBestCarpenter);

router.route('/:id/mark-as-paid')
  .patch(authorizeRoles('SALES', 'MANAGER'), markOrderAsPaid);

export default router;