import express from "express";
import authenticate from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import {
  createDeliveryRuns,
  getMyRoute,
  markStopCompleted
} from "../controllers/deliveryController.js";

const router = express.Router();

router.use(authenticate);

router.post("/dispatch", authorizeRoles("MANAGER"), createDeliveryRuns);
router.get("/my-route", authorizeRoles("DRIVER"), getMyRoute);
router.post("/complete-stop", authorizeRoles("DRIVER"), markStopCompleted);

export default router;