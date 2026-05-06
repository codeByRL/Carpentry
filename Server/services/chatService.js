// backend/services/chatService.js
import Message from "../models/Message.js";
import User from "../models/User.js";
import { createChatNotification } from "./notificationService.js"; // 🆕 ייבוא

/**
 * שליחת הודעה
 */
const sendMessage = async (senderId, receiverId, content, orderId = null) => {
  const message = new Message({
    sender: senderId,
    receiver: receiverId,
    content,
    order: orderId
  });
  await message.save();

  // 🆕 ניסיון פשוט ליצירת התראה – ללא תלות ב fullName
  try {
    await createChatNotification(
      receiverId,
      senderId,
      "💬 יש לך הודעה חדשה בצ'אט",
      `/chat/${senderId}`
    );
    console.log("✅ התראת צ'אט נשמרה בבדיקה");
  } catch (err) {
    console.warn("⚠️ שגיאה ביצירת התראה:", err.message);
  }

  return message;
};

/**
 * קבלת היסטוריית שיחה בין שני משתמשים
 */
const getChatHistory = async (user1, user2) => {
  return Message.find({
    $or: [
      { sender: user1, receiver: user2 },
      { sender: user2, receiver: user1 }
    ]
  }).sort({ createdAt: 1 });
};

/**
 * קבלת רשימת "שיחות אחרונות" למנהל/מחסנאי
 * מחזיר רשימת משתמשים ששלחו הודעות וסטטוס קריאה
 */
const getActiveChats = async (userId) => {
  const currentUserId = userId.toString();
  // מוצא את כל ההודעות שקשורות למשתמש
  const messages = await Message.find({
    $or: [{ sender: userId }, { receiver: userId }]
  }).sort({ createdAt: -1 });

  const chatPartners = new Map();

  messages.forEach(msg => {
    const partnerId = msg.sender.toString() === currentUserId 
      ? msg.receiver.toString() 
      : msg.sender.toString();

    // הודעות "לעצמי" לא אמורות להיחשב כצ'אט פעיל ולא כ-unread.
    if (partnerId === currentUserId) return;
    
    if (!chatPartners.has(partnerId)) {
      chatPartners.set(partnerId, {
        lastMessage: msg.content,
        lastUpdate: msg.createdAt,
        unreadCount: (msg.receiver.toString() === currentUserId && !msg.isRead) ? 1 : 0,
        partnerId
      });
    } else if (msg.receiver.toString() === currentUserId && !msg.isRead) {
      chatPartners.get(partnerId).unreadCount++;
    }
  });

  // הוספת שמות המשתמשים
  const results = [];
  for (let [id, data] of chatPartners) {
    const user = await User.findById(id).select("fullName role");
    if (!user) continue;
    results.push({ ...data, partnerName: user.fullName, partnerRole: user.role });
  }

  return results;
};

/**
 * סימון כל ההודעות ממישהו כנקראו
 */
const markChatAsRead = async (userId, partnerId) => {
  return Message.updateMany(
    { sender: partnerId, receiver: userId, isRead: false },
    { isRead: true }
  );
};

export { sendMessage, getChatHistory, getActiveChats, markChatAsRead };