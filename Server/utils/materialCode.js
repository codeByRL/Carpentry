import BaseProduct from "../models/BaseProduct.js";
import FormicaModel from "../models/FormicaModel.js";

/** קידומות קוד אחידות לכל נקודות יצירת חומר במערכת */
export const prefixForMaterialType = (materialType) => {
  switch (String(materialType || "").toLowerCase()) {
    case "fabric":
      return "FAB";
    case "formica":
      return "FOR";
    case "handle":
      return "HND";
    default:
      return "MAT";
  }
};

const maxSequenceForPrefix = (codes, prefix) => {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");
  return codes.reduce((max, raw) => {
    const matched = String(raw || "").match(pattern);
    const num = matched ? Number(matched[1]) : 0;
    return num > max ? num : max;
  }, 0);
};

/**
 * מחזיר קוד חדש בפורם PREFIX-0001 (4 ספרות).
 * לפורמייקה סורק גם BaseProduct וגם FormicaModel כדי למנוע כפילויות.
 */
export const nextMaterialCode = async (materialTypeOrPrefix) => {
  const prefix =
    ["FAB", "FOR", "HND", "MAT"].includes(String(materialTypeOrPrefix || "").toUpperCase())
      ? String(materialTypeOrPrefix).toUpperCase()
      : prefixForMaterialType(materialTypeOrPrefix);

  const regex = new RegExp(`^${prefix}-\\d+$`, "i");
  const baseCodes = await BaseProduct.find({ code: regex }).select("code").lean();

  let extraCodes = [];
  if (prefix === "FOR") {
    extraCodes = await FormicaModel.find({ code: regex }).select("code").lean();
  }

  const allCodes = [
    ...baseCodes.map((row) => row.code),
    ...extraCodes.map((row) => row.code),
  ];
  const nextNum = maxSequenceForPrefix(allCodes, prefix) + 1;
  return `${prefix}-${String(nextNum).padStart(4, "0")}`;
};
