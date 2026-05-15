/** ולידציה אחידה לבדים / פורמייקות / ידיות */
export const validateMaterialForm = (
  { name, supplier, description, priceDelta },
  { imageFile, existingImage, requireImage = true } = {}
) => {
  if (!String(name || '').trim()) return 'יש להזין שם';
  if (!String(supplier || '').trim()) return 'יש להזין שם ספק';
  if (!String(description || '').trim()) return 'יש להזין תיאור';
  if (
    priceDelta === '' ||
    priceDelta == null ||
    Number.isNaN(Number(priceDelta))
  ) {
    return 'יש להזין תוספת מחיר (אפשר 0)';
  }
  if (requireImage && !imageFile && !existingImage) return 'יש להעלות תמונה';
  return null;
};
