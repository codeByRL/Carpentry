import express from "express";
import authenticate from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import {
  getDashboardData,
  getAllEmployees,
  createEmployee,
  deleteEmployee,
  updateEmployee,
  uploadContract
} from "../controllers/managerAnalyticsController.js";

const router = express.Router();

router.get("/dashboard", authorizeRoles("MANAGER"), getDashboardData);
router.get("/employees", authorizeRoles("MANAGER"), getAllEmployees);
router.post("/employees", authorizeRoles("MANAGER"), uploadContract.single("contractFile"), createEmployee);
router.patch("/employees/:id", authorizeRoles("MANAGER"), uploadContract.single("contractFile"), updateEmployee);
router.delete("/employees/:id", authorizeRoles("MANAGER"), deleteEmployee);

export default router;