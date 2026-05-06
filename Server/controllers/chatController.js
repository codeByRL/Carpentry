import * as chatService from '../services/chatService.js';
import User from '../models/User.js';
import { markChatNotificationsFromPartnerAsRead } from '../services/notificationService.js';

const sendMsg = async (req, res, next) => {
  try {
    const { receiverId, content, orderId } = req.body;
    const message = await chatService.sendMessage(req.user.id, receiverId, content, orderId);
    res.status(201).json(message);
  } catch (error) {
    console.error("Error in sendMsg:", error);
    next(error);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user.id || req.user._id;
    const history = await chatService.getChatHistory(userId, partnerId);
    await chatService.markChatAsRead(userId, partnerId);
    await markChatNotificationsFromPartnerAsRead(userId, partnerId);
    res.json(history);
  } catch (error) {
    console.error("Error in getHistory:", error);
    next(error);
  }
};

const getMyChats = async (req, res, next) => {
  try {
    const chats = await chatService.getActiveChats(req.user.id);
    res.json(chats);
  } catch (error) {
    console.error("Error in getMyChats:", error);
    next(error);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const { query, role } = req.query;
    let filter = {};

    // הוספת חיפוש לפי שאילתה בשם המלא
    if (query) {
      filter.fullName = { $regex: query, $options: 'i' };
    }

    // סינון לפי תפקיד - אם נשלח תפקיד מהפרונט, נחפש לפיו. 
    // אם לא נשלח, הקוד פשוט יחזיר את כל המשתמשים (ללא הבדל תפקיד המשתמש המחפש)
    if (role) {
      filter.role = role;
    }

    // וודא שלא נכלול את המשתמש הנוכחי בתוצאות החיפוש
    filter._id = { $ne: req.user.id };

    // ביצוע החיפוש במסד הנתונים - גישה חופשית לכולם כמו למנהל
    const users = await User.find(filter)
      .select("_id fullName role")
      .limit(50); // הגדלתי מעט את המגבלה כדי שיהיה נוח למצוא אנשים

    res.json(users);
  } catch (error) {
    console.error("Error in searchUsers:", error);
    next(error);
  }
};

export { sendMsg, getHistory, getMyChats, searchUsers };