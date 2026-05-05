import Notification from "../models/Notification.js";
import Order from "../models/Order.js";
import User from "../models/User.js"; // ייבוא לטובת בדיקות עתידיות / הרחבה

/**
 * יצירת התראה כללית (בשימוש ע"י checkCarpenterAlerts)
 * @param {ObjectId} userId - ה-ID של המשתמש שאליו מיועדת ההתראה.
 * @param {string} message - תוכן ההודעה.
 * @param {string} type - סוג ההתראה (INFO, URGENT, WARNING).
 * @param {ObjectId} [orderId=null] - ה-ID של ההזמנה אם רלוונטי.
 * @returns {Promise<Document>} אובייקט ההתראה שנוצר.
 */
export const createNotification = async (userId, message, type = "INFO", orderId = null) => {
  const notification = new Notification({
    user: userId,
    order: orderId,
    message,
    type
  });

  await notification.save();
  return notification;
};

/**
 * יצירת התראת צ'אט ספציפית
 * @param {ObjectId} recipientId - ה-ID של המשתמש שאליו מיועדת התראת הצ'אט (המקבל).
 * @param {ObjectId} senderId - ה-ID של המשתמש ששלח את ההודעה (השולח).
 * @param {string} message - תוכן ההודעה/התראה.
 * @param {string} link - לינק שמצביע לדף הצ'אט הספציפי.
 * @returns {Promise<Document>} אובייקט התראת הצ'אט שנוצר.
 */
export const createChatNotification = async (recipientId, senderId, message, link) => {
  const notification = new Notification({
    user: recipientId,
    sender: senderId,
    message,
    type: "CHAT",
    link,
    isRead: false,
  });

  await notification.save();
  return notification;
};

/**
 * בדיקת התראות לנגרים - פונקציה תזמון
 * (בהתבסס על ההזמנות בסטטוס IN_PROGRESS)
 * @returns {Promise<void>}
 */
export const checkCarpenterAlerts = async () => {
  const orders = await Order.find({ status: "IN_PROGRESS" })
    .populate("catalogProduct")
    .populate("assignedCarpenter");

  for (const order of orders) {
    if (!order.assignedCarpenter || !order.catalogProduct) {
        console.warn(`הזמנה ${order._id} חסרה נגר או פרטי מוצר. מדלג על בדיקת התראה.`);
        continue;
    }

    const now = new Date();
    const deliveryDate = new Date(order.estimatedDeliveryDate);
    const workTime = order.catalogProduct.estimatedWorkTime;
    const startWorkDate = new Date(deliveryDate);
    startWorkDate.setHours(startWorkDate.getHours() - workTime);

    const hoursUntilStart = (startWorkDate - now) / (1000 * 60 * 60);

    if (hoursUntilStart <= 24 && hoursUntilStart > 0) {
      // קריאה לפונקציית createNotification המעודכנת
      await createNotification(
        order.assignedCarpenter._id,
        `התראה: צריך להתחיל לעבוד על הזמנה ${order._id} תוך 24 שעות`,
        "URGENT",
        order._id
      );
    }
  }
};

/**
 * קבלת התראות למשתמש
 * @param {ObjectId} userId - ה-ID של המשתמש.
 * @returns {Promise<Array<Document>>} רשימת התראות.
 */
export const getUserNotifications = async (userId) => {
  return Notification.find({ user: userId, isRead: false })
    .populate("order")
    .populate("sender", "fullName avatar") // אכלוס פרטי שולח עבור התראות צ'אט
    .sort({ createdAt: -1 });
};

/**
 * סימון התראה בודדת כנקראה
 * @param {ObjectId} notificationId - ה-ID של ההתראה לסימון.
 * @returns {Promise<Document>} ההתראה המעודכנת.
 */
export const markAsRead = async (notificationId) => {
  return Notification.findByIdAndUpdate(
    notificationId,
    { isRead: true },
    { new: true }
  );
};

/**
 * סימון כל התראות הצ'אט מפרטנר מסוים כנקראו
 * @param {ObjectId} userId - ה-ID של המשתמש הנמען.
 * @param {ObjectId} partnerId - ה-ID של השותף (השולח) בצ'אט.
 * @returns {Promise<UpdateWriteOpResult>} תוצאת פעולת העדכון.
 */
export const markChatNotificationsFromPartnerAsRead = async (userId, partnerId) => {
    return Notification.updateMany(
        { user: userId, sender: partnerId, type: "CHAT", isRead: false },
        { isRead: true }
    );
};