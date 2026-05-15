/** יום עבודה אחד לנגר על הזמנה = 4 שעות (לא יום משרה מלא). */
export const HOURS_PER_WORK_DAY = 4;
export const WORK_DAYS_PER_WEEK = 5;
export const HOURS_PER_WORK_WEEK = HOURS_PER_WORK_DAY * WORK_DAYS_PER_WEEK;

export const weeksToHours = (weeks) => Number(weeks || 0) * HOURS_PER_WORK_WEEK;
export const hoursToWeeks = (hours) => Number(hours || 0) / HOURS_PER_WORK_WEEK;
