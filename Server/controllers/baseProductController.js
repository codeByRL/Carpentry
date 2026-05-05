// controllers/baseProductController.js
import BaseProduct from "../models/BaseProduct.js";

const ALLOWED_TYPES = ['wood', 'fabric'];

export const listMaterials = async (req, res) => {
  try {
    const { isMaterial, type, page = '1', limit = '100', sort = 'name' } = req.query;

    const filter = {};
    if (isMaterial !== undefined) filter.isMaterial = isMaterial === 'true';
    if (type && ALLOWED_TYPES.includes(type)) filter.materialType = type;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.max(1, Math.min(200, parseInt(limit, 10) || 100)); // limit מקסימלי 200

    const items = await BaseProduct.find(filter)
      .select("_id name code image description priceDelta quantity materialType")
      .sort(sort)
      .skip((pageNum - 1) * lim)
      .limit(lim)
      .lean();

    res.json(items);
  } catch (err) {
    console.error("listMaterials error:", err);
    res.status(500).json({ message: "שגיאה בשרת" });
  }
};

export const getMaterialById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await BaseProduct.findById(id)
      .select("_id name code image description priceDelta quantity materialType")
      .lean();
    if (!item) return res.status(404).json({ message: "חומר לא נמצא" });
    res.json(item);
  } catch (err) {
    console.error("getMaterialById error:", err);
    res.status(500).json({ message: "שגיאה בשרת" });
  }
};