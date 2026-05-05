// client/src/utils/ChatSocketClient.js
import { io } from "socket.io-client";

class ChatSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = this.isConnected.bind(this);
  }

  connect(token) {
    if (this.socket && this.socket.connected) {
      console.log("Socket already connected.");
      return;
    }

    // נסה להתחבר דרך auth.token תחילה
    this.socket = io("ws://localhost:5001", {
      auth: {
        token: token,
      },
      // גם לשלוח ב-query למקרה ש-auth headers לא עובדים ב-middleware של הסרבר מסיבה כלשהי
      query: { token: token }, 
      transports: ['websocket'], // העדף websocket
      forceNew: true, // לוודא שיוצר חיבור חדש
    });

    console.log("Attempting to connect to chat socket...");
  }

  disconnect() {
    if (this.socket) {
      console.log("Disconnecting chat socket.");
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }

  // אירועי חיבור וניתוק
  onConnect(callback) {
    this.socket?.on("connect", callback);
  }

  onDisconnect(callback) {
    this.socket?.on("disconnect", callback);
  }

  onConnectError(callback) {
    this.socket?.on("connect_error", callback);
  }

  // שליחת הודעות
  sendMessage({ receiverId, content, orderId }) {
    if (this.socket && this.socket.connected) {
      console.log("Emitting sendMessage:", { receiverId, content, orderId });
      this.socket.emit("sendMessage", { receiverId, content, orderId });
    } else {
      console.error("Socket not connected, cannot send message.");
    }
  }

  // קליטת הודעות חדשות
  onNewMessage(callback) {
    this.socket?.on("receiveMessage", callback); // השרת שולח "receiveMessage"
  }
  
  // סימון הודעות כנקראו
  markAsRead({ senderId, receiverId }) {
    if (this.socket && this.socket.connected) {
      console.log("Emitting markAsRead:", { senderId, receiverId });
      this.socket.emit("markAsRead", { senderId, receiverId });
    } else {
      console.error("Socket not connected, cannot mark messages as read.");
    }
  }

  // אירוע כאשר הודעות מסומנות כנקראו על ידי הצד השני
  onMessagesRead(callback) {
    this.socket?.on("messagesRead", callback);
  }

  // אירוע עדכון רשימת צ'אטים פעילים
  onActiveChatsUpdated(callback) {
    this.socket?.on("activeChatsUpdated", callback);
  }
}

export const chatSocketClient = new ChatSocketClient();