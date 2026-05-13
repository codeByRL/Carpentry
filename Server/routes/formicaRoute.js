import express from "express";
import {
  listFormicaModels,
  getFormicaModel,
  createFormicaModel,
  updateFormicaModel,
  deleteFormicaModel,
  uploadFormicaImage,
} from "../controllers/formicaController.js";

const router = express.Router();

router.get("/", listFormicaModels);
router.get("/:id", getFormicaModel);
router.post("/", uploadFormicaImage.single("image"), createFormicaModel);
router.put("/:id", uploadFormicaImage.single("image"), updateFormicaModel);
router.delete("/:id", deleteFormicaModel);

export default router;
