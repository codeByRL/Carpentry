/** מחזיר את הודעת השגיאה הראשונה ממפת שדות או מחרוזת בודדת. */
export const firstFormError = (
  errors,
  fallback = 'לא ניתן לשלוח את הטופס — יש למלא את כל שדות החובה'
) => {
  if (typeof errors === 'string' && errors.trim()) return errors.trim();
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).find((v) => typeof v === 'string' && v.trim());
    if (first) return first;
  }
  return fallback;
};
