import { parseMaterialPriceDelta } from './handlePriceLabel.jsx';

/** כמות חומר ליחידת מוצר אחת (מטר בד, ידית, מ"ר פורמייקה) */
export const materialQtyPerProductUnit = (product, kind) => {
  const key = {
    fabric: 'fabricQuantityPerUnit',
    formica: 'formicaQuantityPerUnit',
    handle: 'handleQuantityPerUnit',
  }[kind];
  const qty = Number(product?.[key] || 0);
  return qty > 0 ? qty : 1;
};

/** תוספת מחיר חומר למוצר בודד = priceDelta × כמות החומר ליחידה */
export const materialDeltaForProductUnit = (priceDelta, product, kind) => {
  const d = parseMaterialPriceDelta(priceDelta);
  if (d <= 0) return 0;
  return d * materialQtyPerProductUnit(product, kind);
};
