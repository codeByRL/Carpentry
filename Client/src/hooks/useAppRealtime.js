import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { chatSocketClient } from "../utils/ChatSocketClient";
import {
  addMessage,
  setActiveChatPartners,
  markMessagesAsReadLocally,
} from "../store/slices/chatSlice";
import { bumpOrdersTick, setSocketConnected } from "../store/slices/realtimeSlice";
import { authService } from "../services/authService";

/** חיבור Socket.io אחד — צ'אט בזמן אמת + אירועי הזמנות */
export function useAppRealtime() {
  const dispatch = useDispatch();
  const token = useSelector((s) => s.auth.token) || authService.getToken();
  const user = useSelector((s) => s.auth.user) || authService.getCurrentUser();
  const userId = user?.id || user?._id;

  useEffect(() => {
    if (!token || !userId) {
      chatSocketClient.disconnect();
      dispatch(setSocketConnected(false));
      return undefined;
    }

    chatSocketClient.connect(token);

    const onConnect = () => dispatch(setSocketConnected(true));
    const onDisconnect = () => dispatch(setSocketConnected(false));

    const onMessage = (message) => {
      const senderId = message?.sender?._id || message?.sender;
      const receiverId = message?.receiver?._id || message?.receiver;
      const partnerId =
        String(senderId) === String(userId) ? receiverId : senderId;
      if (!partnerId) return;
      dispatch(addMessage({ ...message, partnerId }));
    };

    const onActiveChats = (chats) => {
      if (Array.isArray(chats)) dispatch(setActiveChatPartners(chats));
    };

    const onRead = ({ senderId }) => {
      if (senderId) dispatch(markMessagesAsReadLocally({ senderId }));
    };

    const onOrderUpdated = () => dispatch(bumpOrdersTick());

    chatSocketClient.onConnect(onConnect);
    chatSocketClient.onDisconnect(onDisconnect);
    chatSocketClient.onNewMessage(onMessage);
    chatSocketClient.onActiveChatsUpdated(onActiveChats);
    chatSocketClient.onMessagesRead(onRead);
    chatSocketClient.onOrderUpdated(onOrderUpdated);

    return () => {
      chatSocketClient.offConnect(onConnect);
      chatSocketClient.offDisconnect(onDisconnect);
      chatSocketClient.offNewMessage(onMessage);
      chatSocketClient.offActiveChatsUpdated(onActiveChats);
      chatSocketClient.offMessagesRead(onRead);
      chatSocketClient.offOrderUpdated(onOrderUpdated);
      chatSocketClient.disconnect();
      dispatch(setSocketConnected(false));
    };
  }, [token, userId, dispatch]);
}
