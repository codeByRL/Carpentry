import Order from "../models/Order.js";
import User from "../models/User.js";
import mongoose from "mongoose";

/**
 * 📈 גרף קווים: הכנסות ועומס עבודה ב-6 חודשים אחרונים
 * 
 * מה זה מחזיר?
 * [
 *   { _id: { year: 2026, month: 1 }, totalRevenue: 45000, totalOrders: 12, totalWorkHours: 320 },
 *   { _id: { year: 2026, month: 2 }, totalRevenue: 52000, totalOrders: 15, totalWorkHours: 380 },
 *   ...
 * ]
 * 
 * איך להציג ב-React?
 * <LineChart data={monthlyStats}>
 *   <Line dataKey="totalRevenue" stroke="blue" name="הכנסות" />
 *   <Line dataKey="totalWorkHours" stroke="green" name="שעות עבודה" />
 * </LineChart>
 */
const getMonthlyStats = async () => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  return await Order.aggregate([
    // שלב 1: סינון - רק הזמנות מ-6 חודשים אחרונים
    { $match: { orderDate: { $gte: sixMonthsAgo } } },
    
    // שלב 2: קיבוץ לפי חודש
    {
      $group: {
        _id: { 
          year: { $year: "$orderDate" }, 
          month: { $month: "$orderDate" } 
        },
        totalRevenue: { $sum: "$price" },              // סכום כל המחירים
        totalOrders: { $sum: 1 },                      // ספירת הזמנות
        totalWorkHours: { $sum: "$estimatedWorkHoursTotal" } // סכום שעות עבודה
      }
    },
    
    // שלב 3: מיון כרונולוגי
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);
};

/**
 * ⏱️ טבלת ביצועים: מהירות טיפול של כל מחסנאי
 * 
 * מה זה מחזיר?
 * [
 *   { fullName: "יוסי כהן", avgProcessingTime: 45.3, totalOrdersHandled: 23 },
 *   { fullName: "דנה לוי", avgProcessingTime: 38.7, totalOrdersHandled: 31 },
 *   ...
 * ]
 * 
 * avgProcessingTime = כמה דקות בממוצע לוקח למחסנאי להכין הזמנה (מרגע שראה עד שסיים ליקוט)
 * 
 * איך להציג ב-React?
 * <BarChart data={warehousePerformance}>
 *   <Bar dataKey="avgProcessingTime" fill="#8884d8" />
 * </BarChart>
 * או פשוט טבלה עם צבעים (ירוק למהירים, אדום לאיטיים)
 */
const getWarehousePerformance = async () => {
  return await Order.aggregate([
    // שלב 1: רק הזמנות שיש להן חותמות זמן מלאות
    { 
      $match: { 
        seenByWarehouseAt: { $exists: true },
        readyForShippingAt: { $exists: true }
      } 
    },
    
    // שלב 2: חישוב זמן טיפול בדקות
    {
      $project: {
        warehouseHandledBy: 1,
        processingTimeMin: {
          $divide: [
            { $subtract: ["$readyForShippingAt", "$seenByWarehouseAt"] },
            1000 * 60 // המרה ממילישניות לדקות
          ]
        }
      }
    },
    
    // שלב 3: קיבוץ לפי מחסנאי
    {
      $group: {
        _id: "$warehouseHandledBy",
        avgProcessingTime: { $avg: "$processingTimeMin" },  // ממוצע זמן
        totalOrdersHandled: { $sum: 1 }                     // כמה הזמנות טיפל
      }
    },
    
    // שלב 4: חיבור לטבלת Users כדי לקבל שם מלא
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userInfo"
      }
    },
    { $unwind: "$userInfo" },
    
    // שלב 5: עיצוב התוצאה הסופית
    {
      $project: {
        fullName: "$userInfo.fullName",
        avgProcessingTime: { $round: ["$avgProcessingTime", 2] }, // עיגול ל-2 ספרות
        totalOrdersHandled: 1
      }
    }
  ]);
};

/**
 * 👷 מפת נגרים: עומס עבודה נוכחי
 * 
 * מה זה מחזיר?
 * [
 *   { fullName: "משה אבוקסיס", currentWorkloadHours: 120, seniority: 5 },
 *   { fullName: "רונית שמש", currentWorkloadHours: 85, seniority: 3 },
 *   ...
 * ]
 * 
 * איך להציג ב-React?
 * רשימה עם צבעים:
 * - אדום: מעל 100 שעות (עמוס מדי)
 * - צהוב: 50-100 שעות (עמוס)
 * - ירוק: מתחת ל-50 שעות (פנוי)
 */
const getCarpentersWorkload = async () => {
  return await User.find({ role: "CARPENTER" })
    .select("fullName currentWorkloadHours seniority")
    .sort({ currentWorkloadHours: -1 }); // הכי עמוסים קודם
};

/**
 * 🥧 גרף עוגה: התפלגות סטטוסים של הזמנות
 * 
 * מה זה מחזיר?
 * [
 *   { _id: "ORDERED", count: 5 },
 *   { _id: "WAITING_FOR_SUPPLY", count: 12 },
 *   { _id: "IN_PROGRESS", count: 8 },
 *   { _id: "DONE", count: 45 }
 * ]
 * 
 * איך להציג ב-React?
 * <PieChart>
 *   <Pie data={orderStatusDistribution} dataKey="count" nameKey="_id" />
 * </PieChart>
 */
const getOrderStatusDistribution = async () => {
  return await Order.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    }
  ]);
};

export {
  getMonthlyStats,
  getWarehousePerformance,
  getCarpentersWorkload,
  getOrderStatusDistribution
};