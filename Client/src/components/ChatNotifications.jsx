// client/src/components/ChatNotifications.jsx
import React, { useEffect, useCallback } from "react";
import { Badge, IconButton } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications } from '../store/slices/notificationsSlice';
import { fetchActiveChatPartners } from '../store/slices/chatSlice';

const ChatNotifications = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(s => s.auth);
  const chatState = useSelector(s => s.chat);

  const totalUnreadChatCount =
    chatState?.activeChatPartners?.reduce((acc, p) => acc + (Number(p.unreadCount) || 0), 0) || 0;

  const uid = user?.id || user?._id;

  const refresh = useCallback(() => {
    if (!uid) return;
    dispatch(fetchNotifications());
    dispatch(fetchActiveChatPartners());
  }, [uid, dispatch]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <IconButton
      onClick={() => navigate('/chat')}
      color="inherit"
      aria-label="התראות צ'אט"
    >
      <Badge
        badgeContent={totalUnreadChatCount}
        color="error"
        max={99}
      >
        <ChatIcon />
      </Badge>
    </IconButton>
  );
};

export default ChatNotifications;
