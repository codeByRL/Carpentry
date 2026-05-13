// controllers/baseProductController.js
import BaseProduct from "../models/BaseProduct.js";

const ALLOWED_TYPES = ["wood", "fabric", "formica", "handle"];
const TRUTHY_VALUES = new Set(["true", "1", "yes"]);

export const listMaterials = async (req, res) => {
  try {
    const {
      isMaterial,
      type,
      materialType,
      page = "1",
      limit = "100",
      sort = "name",
    } = req.query;

    const filter = {};
    const andConditions = [];
    if (isMaterial !== undefined) {
      const normalized = String(isMaterial).toLowerCase();
      const wantsMaterial = TRUTHY_VALUES.has(normalized);
      // תואם גם נתונים היסטוריים שבהם הערך נשמר כמחרוזת.
      const materialFlagCondition = wantsMaterial
        ? { isMaterial: { $in: [true, "true"] } }
        : { isMaterial: { $nin: [true, "true"] } };
      andConditions.push(materialFlagCondition);
    }

    const requestedType = String(type || materialType || "").toLowerCase();
    if (requestedType && ALLOWED_TYPES.includes(requestedType)) {
      const typeMatches = [{ materialType: requestedType }, { type: requestedType }];
      if (requestedType === "fabric") {
        typeMatches.push({
          $and: [
            { isMaterial: { $in: [true, "true"] } },
            { materialType: null },
            { code: /^FAB-/i },
          ],
        });
        typeMatches.push({
          $and: [
            { isMaterial: { $in: [true, "true"] } },
            { materialType: null },
            { image: { $nin: [null, ""] } },
          ],
        });
      }
      if (requestedType === "formica") {
        typeMatches.push({
          $and: [
            { isMaterial: { $in: [true, "true"] } },
            { code: /^FOR-/i },
          ],
        });
      }
      if (requestedType === "handle") {
        typeMatches.push({
          $and: [
            { isMaterial: { $in: [true, "true"] } },
            { code: /^HND-/i },
          ],
        });
      }
      // תואם גם records ישנים שנשמרו עם שדה "type" במקום "materialType".
      const typeCondition = { $or: typeMatches };
      andConditions.push(typeCondition);

      // תאימות לאחור: אם ביקשו חומרים מסוג מסוים, נקבל גם רשומות ישנות שבהן
      // סומן הסוג אבל שדה isMaterial לא נשמר נכון.
      if (isMaterial !== undefined && TRUTHY_VALUES.has(String(isMaterial).toLowerCase())) {
        filter.$or = [{ $and: andConditions }, typeCondition];
      } else {
        filter.$and = andConditions;
      }
    } else if (andConditions.length) {
      filter.$and = andConditions;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.max(1, Math.min(200, parseInt(limit, 10) || 100)); // limit מקסימלי 200

    const items = await BaseProduct.find(filter)
      .select("_id name code image description priceDelta quantity materialType supplier formicaModelId")
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
      .select("_id name code image description priceDelta quantity materialType supplier formicaModelId")
      .lean();
    if (!item) return res.status(404).json({ message: "חומר לא נמצא" });
    res.json(item);
  } catch (err) {
    console.error("getMaterialById error:", err);
    res.status(500).json({ message: "שגיאה בשרת" });
  }
};