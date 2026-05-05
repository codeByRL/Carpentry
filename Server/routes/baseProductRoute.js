// routes/baseProductRoute.js
import express from 'express';
import { listMaterials, getMaterialById } from '../controllers/baseProductController.js';
const router = express.Router();

router.get('/', listMaterials); // GET /api/base-products?isMaterial=true&type=wood
router.get('/:id', getMaterialById); // GET /api/base-products/:id

export default router;