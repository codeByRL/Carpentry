import { getIo } from "../chatSocket.js";

/** עדכון הזמנה / בריכת מובילים — לכל המחוברים */
export const broadcastOrderUpdated = (payload = {}) => {
  const io = getIo();
  if (!io) return;
  io.emit("order:updated", {
    at: Date.now(),
    ...payload,
  });
};
