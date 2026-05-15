/** כמות חומר ליחידת מוצר אחת (מטר בד, ידית, מ"ר פורמייקה) */
export const materialQtyPerProductUnit = (product, kind) => {
  const key = {
    fabric: "fabricQuantityPerUnit",
    formica: "formicaQuantityPerUnit",
    handle: "handleQuantityPerUnit",
  }[kind];
  const qty = Number(product?.[key] || 0);
  return qty > 0 ? qty : 1;
};

/** תוספת מחיר חומר למוצר בודד = priceDelta × כמות החומר ליחידה */
export const parseMaterialPriceDelta = (value) => {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const materialDeltaForProductUnit = (priceDelta, product, kind) => {
  const d = parseMaterialPriceDelta(priceDelta);
  if (d <= 0) return 0;
  return d * materialQtyPerProductUnit(product, kind);
};
