import React from 'react';
import { Typography } from '@mui/material';

const MATERIAL_UNIT_LABEL = {
  fabric: 'מטר',
  formica: 'מ"ר',
  handle: 'ידית',
};

/** מנרמל priceDelta מהשרת (מספר, מחרוזת, וכו') */
export const parseMaterialPriceDelta = (value) => {
  if (value == null || value === '') return 0;
  if (typeof value === 'object' && value?.$numberDecimal != null) {
    const n = Number(value.$numberDecimal);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** טקסט תוספת מחיר ליחידת חומר (מטר / ידית / מ"ר) */
export const materialSurchargeText = (priceDelta, materialType = 'handle') => {
  const n = parseMaterialPriceDelta(priceDelta);
  if (n <= 0) return null;
  const unit = MATERIAL_UNIT_LABEL[materialType] || 'יחידה';
  return `תוספת ${n.toLocaleString('he-IL')} ש"ח ל${unit}`;
};

export const handleSurchargeText = (priceDelta) => materialSurchargeText(priceDelta, 'handle');

/** תוספת ליחידת מוצר (כולל כמות חומר למוצר) — לתצוגה בהזמנה */
const QTY_KEY = {
  fabric: 'fabricQuantityPerUnit',
  formica: 'formicaQuantityPerUnit',
  handle: 'handleQuantityPerUnit',
};

export const materialSurchargeForProductText = (priceDelta, product, materialType) => {
  const per = parseMaterialPriceDelta(priceDelta);
  if (per <= 0) return null;
  const qtyKey = QTY_KEY[materialType];
  const qty = qtyKey && Number(product?.[qtyKey] || 0) > 0 ? Number(product[qtyKey]) : 1;
  const unit = MATERIAL_UNIT_LABEL[materialType] || 'יחידה';
  const total = per * qty;
  if (qty <= 1) return `תוספת ${per.toLocaleString('he-IL')} ש"ח ל${unit}`;
  return `תוספת ${per.toLocaleString('he-IL')} ש"ח ל${unit} × ${qty} = ${total.toLocaleString('he-IL')} ש"ח למוצר`;
};

export const HandleSurchargeLabel = ({ priceDelta, materialType = 'handle', sx = {} }) => {
  const text = materialSurchargeText(priceDelta, materialType);
  if (!text) return null;
  return (
    <Typography
      component="span"
      sx={{ fontWeight: 700, display: 'block', fontSize: 13, color: 'secondary.dark', mt: 0.5, ...sx }}
    >
      {text}
    </Typography>
  );
};
