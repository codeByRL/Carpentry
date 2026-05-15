import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_REACT_APP_API_URL ||
  "http://localhost:5001";

class ChatSocketClient {
  constructor() {
    this.socket = null;
    this._handlers = {
      connect: new Set(),
      disconnect: new Set(),
      connectError: new Set(),
      receiveMessage: new Set(),
      messagesRead: new Set(),
      activeChatsUpdated: new Set(),
      orderUpdated: new Set(),
    };
  }

  connect(token) {
    if (this.socket?.connected) return;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      query: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
    });

    this.socket.on("connect", () => this._handlers.connect.forEach((fn) => fn()));
    this.socket.on("disconnect", () => this._handlers.disconnect.forEach((fn) => fn()));
    this.socket.on("connect_error", (err) =>
      this._handlers.connectError.forEach((fn) => fn(err))
    );
    this.socket.on("receiveMessage", (msg) =>
      this._handlers.receiveMessage.forEach((fn) => fn(msg))
    );
    this.socket.on("messagesRead", (data) =>
      this._handlers.messagesRead.forEach((fn) => fn(data))
    );
    this.socket.on("activeChatsUpdated", (chats) =>
      this._handlers.activeChatsUpdated.forEach((fn) => fn(chats))
    );
    this.socket.on("order:updated", (data) =>
      this._handlers.orderUpdated.forEach((fn) => fn(data))
    );
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected() {
    return !!(this.socket && this.socket.connected);
  }

  _on(event, callback) {
    this._handlers[event]?.add(callback);
  }

  _off(event, callback) {
    this._handlers[event]?.delete(callback);
  }

  onConnect(callback) {
    this._on("connect", callback);
  }
  offConnect(callback) {
    this._off("connect", callback);
  }

  onDisconnect(callback) {
    this._on("disconnect", callback);
  }
  offDisconnect(callback) {
    this._off("disconnect", callback);
  }

  onConnectError(callback) {
    this._on("connectError", callback);
  }

  sendMessage({ receiverId, content, orderId }) {
    if (!this.socket?.connected) return false;
    this.socket.emit("sendMessage", { receiverId, content, orderId });
    return true;
  }

  onNewMessage(callback) {
    this._on("receiveMessage", callback);
  }
  offNewMessage(callback) {
    this._off("receiveMessage", callback);
  }

  markAsRead({ senderId, receiverId }) {
    if (!this.socket?.connected) return false;
    this.socket.emit("markAsRead", { senderId, receiverId });
    return true;
  }

  onMessagesRead(callback) {
    this._on("messagesRead", callback);
  }
  offMessagesRead(callback) {
    this._off("messagesRead", callback);
  }

  onActiveChatsUpdated(callback) {
    this._on("activeChatsUpdated", callback);
  }
  offActiveChatsUpdated(callback) {
    this._off("activeChatsUpdated", callback);
  }

  onOrderUpdated(callback) {
    this._on("orderUpdated", callback);
  }
  offOrderUpdated(callback) {
    this._off("orderUpdated", callback);
  }
}

export const chatSocketClient = new ChatSocketClient();
