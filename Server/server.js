// server.js
import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initChatSocket } from "./chatSocket.js"; // קובץ חדש שניצור

const PORT = process.env.PORT || 5000;

connectDB();

const server = http.createServer(app);

// אתחול Socket.IO (מגדיר את ה‑io ומשתמש ב-server)
initChatSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});