/**
 * צבעי ריבועי סטטיסטיקה בדשבורדים — פלטה אחידה (חום עץ, קריאות עם טקסט לבן).
 * אינדקס 0–3 לרוב הדשבורדים; אינדקס 4 לנגר (5 ריבועים).
 */
export const DASHBOARD_STAT_COLORS = ['#5D4037', '#6D4C41', '#8D6E63', '#A1887F', '#795548'];

export const dashboardStatColor = (index) =>
  DASHBOARD_STAT_COLORS[Math.min(index, DASHBOARD_STAT_COLORS.length - 1)];
