// server/routes/chatRoute.js (מעודכן לגישה מלאה לכל התפקידים)

import express from "express";
const router = express.Router();

import authenticate from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import {
  sendMsg,
  getHistory,
  getMyChats,
  searchUsers 
} from "../controllers/chatController.js";

// כל נתיבי הצ'אט דורשים התחברות (Token תקף)
router.use(authenticate);

/**
 * שליחת הודעה
 * POST /api/chat/message
 */
router.post(
  "/message",
  sendMsg
);

/**
 * רשימת שיחות אחרונות
 * GET /api/chat/my-chats
 */
router.get(
  "/my-chats",
  getMyChats
);

/**
 * היסטוריית צ'אט מול משתמש ספציפי
 * GET /api/chat/history/:partnerId
 */
router.get(
  "/history/:partnerId",
  getHistory
);

/**
 * חיפוש משתמשים להתחלת שיחה חדשה
 * הסרתי את המגבלה של authorizeRoles כדי שגם SALES ו-DRIVER יוכלו לחפש ולהתחיל שיחות.
 * כל מי שמחובר (authenticate) רשאי כעת לבצע חיפוש בדיוק כמו מנהל.
 */
router.get(
  "/search-users",
  searchUsers
);

export default router;