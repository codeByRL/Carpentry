import express from "express";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import {
  getAllWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "../controllers/warehousesController.js";

const router = express.Router();

// אין צורך ב-router.use(authenticate) כי זה מוגדר ב-app.js עבור כל הנתיב הזה

router.get("/", getAllWarehouses);
router.post("/", authorizeRoles("MANAGER"), createWarehouse);
router.patch("/:id", authorizeRoles("MANAGER"), updateWarehouse);
router.delete("/:id", authorizeRoles("MANAGER"), deleteWarehouse);

export default router;