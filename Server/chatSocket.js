import { Server } from "socket.io";
import jwt from "jsonwebtoken";
// ייבוא הסוד לאימות טוקנים, וודא שנתיב הייבוא נכון!
// אם generateToken ו-JWT_SECRET נמצאים באותו קובץ (למשל auth.service.js)
// אז וודא שזהו הייבוא הנכון.
// אם JWT_SECRET הוא פשוט משתנה סביבה כללי, אז השאר אותו כפי שהוא.
// לדוגמה, אם הקובץ הוא services/auth.service.js והוא מייצא את JWT_SECRET:
// import { JWT_SECRET } from "./services/auth.service.js"; 

// אם JWT_SECRET הוא רק משתנה סביבה ולא מייוצא מקובץ אחר:
const JWT_SECRET = process.env.JWT_SECRET || "very_secret_key";


import { markChatAsRead, getActiveChats as getActiveChatsService } from "./services/chatService.js";
import Message from "./models/Message.js";
import User from "./models/User.js";

let io;

export const initChatSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173", // URL ה-Frontend שלך
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Middleware לאימות JWT
  io.use(async (socket, next) => {
    // נסה מספר אפשרויות לקבלת הטוקן
    let token = null;
    
    // נסה לקבל מה-auth (מועדף)
    if (socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
    }
    
    // אם לא הצליח, נסה מה-query (למקרה של בעיות עם Auth Headers)
    if (!token && socket.handshake.query && socket.handshake.query.token) {
      token = socket.handshake.query.token;
    }
    
    console.log("Received token for authentication:", token ? "Token received" : "No token");
    
    if (!token) {
      return next(new Error("Authentication error: Token not provided."));
    }

    try {
      // השתמש באותו הסוד שבו יוצרים את הטוקנים
      console.log("Using JWT_SECRET for verification");
      
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log("Successfully verified token for user ID:", decoded.id);
      socket.user = decoded; // שמירת פרטי המשתמש על אובייקט ה-socket
      next();
    } catch (err) {
      console.error("Token verification failed:", err);
      if (err instanceof jwt.JsonWebTokenError) {
        console.error("JWT verification error:", err);
        return next(new Error("Authentication error: Invalid token."));
      }
      if (err.name === 'TokenExpiredError') {
        return next(new Error("Authentication error: Token expired."));
      }
      return next(new Error("Authentication error: Token verification failed due to unknown error."));
    }
  });

  io.on("connection", async (socket) => {
    console.log("A user connected:", socket.user.id);

    // הצטרפות לחדר אישי + עדכוני הזמנות/מובילים
    socket.join(socket.user.id);
    if (socket.user.role) {
      socket.join(`role:${socket.user.role}`);
    }
    socket.join("orders:live");

    // עדכון סטטוס המשתמש למחובר
    try {
      await User.findByIdAndUpdate(socket.user.id, { isOnline: true, lastOnline: new Date() });
      io.emit("user_status_changed", { userId: socket.user.id, isOnline: true });
    } catch (error) {
      console.error("Error updating user status to online:", error);
    }

    // שליחת הודעה
    socket.on("sendMessage", async ({ receiverId, content, orderId }) => {
      try {
        console.log("Received sendMessage event:", { senderId: socket.user.id, receiverId, content, orderId });
        
        const newMessage = new Message({
          sender: socket.user.id, // זהו ה-ID בלבד
          receiver: receiverId, // זהו ה-ID בלבד
          content,
          order: orderId,
          isRead: false,
        });
        await newMessage.save();

        // לפני שליחת ההודעה חזרה לקליינטים, נשלף את פרטי השולח והמקבל
        // כדי שהקליינט יוכל להציג את השם ולא רק את ה-ID
        const populatedMessage = await Message.findById(newMessage._id)
            .populate('sender', 'fullName username') // נשלף fullName ו-username
            .populate('receiver', 'fullName username'); // נשלף fullName ו-username

        // שליחה לשולח ולמקבל - כעת עם אובייקטים מלאים של שולח/מקבל
        io.to(socket.user.id).emit("receiveMessage", populatedMessage);
        if (socket.user.id !== receiverId) { // לא לשלוח פעמיים לאותו חדר אם השולח הוא המקבל
            io.to(receiverId).emit("receiveMessage", populatedMessage);
        }
        console.log("Message sent to sender and receiver:", populatedMessage._id);

        // עדכון צ'אטים פעילים לשני הצדדים - זה יגרום ל-activeChatsUpdated
        updateActiveChats(socket.user.id);
        updateActiveChats(receiverId);

      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("messageError", { message: "Failed to send message." });
      }
    });

    // סימון הודעות כנקראו
    socket.on("markAsRead", async ({ senderId, receiverId }) => {
      try {
        console.log("Received markAsRead event:", { senderId, receiverId });
        await markChatAsRead(receiverId, senderId); // receiverId כאן הוא המשתמש הנוכחי
        
        // עדכן את שני הצדדים שההודעות נקראו
        // ה-senderId כאן הוא הצד השני בשיחה (השותף)
        io.to(receiverId).emit("messagesRead", { senderId, receiverId });
        //io.to(senderId).emit("messagesRead", { senderId: receiverId, receiverId: senderId });
        console.log(`Messages from ${senderId} to ${receiverId} marked as read.`);
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    // ניתוק
    socket.on("disconnect", async () => {
      console.log("User disconnected:", socket.user.id);
      // עדכון סטטוס המשתמש למנותק
      try {
        await User.findByIdAndUpdate(socket.user.id, { isOnline: false, lastOnline: new Date() });
        io.emit("user_status_changed", { userId: socket.user.id, isOnline: false });
      } catch (error) {
        console.error("Error updating user status to offline:", error);
      }
    });
  });
};

// פונקציה לעדכון צ'אטים פעילים (לצורך רשימת הצ'אטים בצד)
const updateActiveChats = async (userId) => {
  try {
    const user = await User.findById(userId).select("role"); // ייתכן שנרצה גם fullName / username
    if (!user) {
      console.warn(`User with ID ${userId} not found for updating active chats.`);
      return;
    }
    
    // שימוש בפונקציית השירות לייבוא Active Chats
    const updatedChats = await getActiveChatsService(userId);
    
    console.log(`Updating active chats for user ${userId}:`, updatedChats.length);
    io.to(userId).emit("activeChatsUpdated", updatedChats);
  } catch (error) {
    console.error("Error updating active chats for user", userId, ":", error);
  }
};

// ייצוא מופע ה-io כדי שנוכל להשתמש בו במקומות אחרים בשרת
export const getIo = () => io;