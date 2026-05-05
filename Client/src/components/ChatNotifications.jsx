// client/src/components/ChatNotifications.jsx
import React, { useEffect, useCallback } from "react";
import { Badge, IconButton } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications } from '../store/slices/notificationsSlice';

const ChatNotifications = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(s => s.auth);
  
  const notifications = useSelector(s => s.notifications.notifications || []);
  const chatNotifications = notifications.filter(n => n.type === 'CHAT' && !n.isRead);
  const totalUnreadChatCount = chatNotifications.length;

  const fetchNotificationsPeriodically = useCallback(() => {
    if (user?._id) {
      dispatch(fetchNotifications());
    }
  }, [user?._id, dispatch]);

  useEffect(() => {
    fetchNotificationsPeriodically();
    const interval = setInterval(fetchNotificationsPeriodically, 15000);
    return () => clearInterval(interval);
  }, [fetchNotificationsPeriodically]);

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