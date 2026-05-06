import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Paper, Button, CircularProgress,
  Alert, LinearProgress
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import InventoryIcon from '@mui/icons-material/Inventory';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ChatIcon from '@mui/icons-material/Chat';

import { fetchAllOrders } from '../store/slices/ordersSlice';
import { fetchEmployees } from '../store/slices/employeesSlice';
import { fetchNotifications, markNotificationRead } from '../store/slices/notificationsSlice';
import { fetchCatalogByStatus } from '../store/slices/catalogSlice';
import { fetchActiveChatPartners } from '../store/slices/chatSlice';

const STATUS_LABEL = {
  QUOTATION_PENDING:   { label: 'בהצעת מחיר',   color: '#FFD700' },
  ORDERED:             { label: 'הזמנה חדשה',   color: '#D2691E' },
  WAITING_FOR_WAREHOUSE:{ label: 'ממתין למחסן', color: '#A0522D' },
  WAITING_FOR_PICKING: { label: 'ממתין לליקוט', color: '#A0522D' },
  WAITING_FOR_SUPPLY:  { label: 'ממתין לאספקה', color: '#8B0000' },
  READY_FOR_SHIPPING:  { label: 'מוכן למשלוח',  color: '#5D4037' },
  IN_PROGRESS:         { label: 'בעבודה',        color: '#6D4C41' },
  DONE:                { label: 'הושלם',         color: '#9E9E9E' },
};

const STAT_COLORS = ['#D2691E', '#A0522D', '#8B4513', '#5D4037'];
const STAT_ICONS  = [
  <ShoppingCartIcon  sx={{ fontSize: 26 }} />,
  <PeopleIcon        sx={{ fontSize: 26 }} />,
  <InventoryIcon     sx={{ fontSize: 26 }} />,
  <ChatIcon sx={{ fontSize: 26 }} />,
];

const CARD_COLORS = [
  { bg: '#FBF0E9', border: '#E8C9B0', icon: '#D2691E', title: '#7B3F1A' },
  { bg: '#F5EDE8', border: '#DDB89A', icon: '#A0522D', title: '#6B3520' },
  { bg: '#EEF0E8', border: '#C8CBA8', icon: '#6B7A3A', title: '#4A5228' },
];

const SectionHeader = ({ emoji, title, btnLabel, onClick, titleColor = '#3E2723' }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
    <Typography sx={{ fontWeight: 700, fontSize: 14, color: titleColor }}>
      {emoji} {title}
    </Typography>
    {btnLabel && (
      <Button size="small" sx={{ fontSize: 11.5, color: '#D2691E', minWidth: 0 }} onClick={onClick}>
        {btnLabel}
      </Button>
    )}
  </Box>
);

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user } = useSelector(s => s.auth);
  const { orders, loading: ordersLoading } = useSelector(s => s.orders);
  const { employees, loading: empLoading } = useSelector(s => s.employees);
  const { notifications, unreadCount } = useSelector(s => s.notifications);
  const { products } = useSelector(s => s.catalog);
  
  // 🟢 תיקון שליפת הנתונים מהצ'אט
  const chatState = useSelector(s => s.chat);
  
  // ניסיון לחשב מכל מקור אפשרי ב-State
  // ספירה ממקור אחד בלבד (השרת) — בלי כפילות מ־unreadMessagesCount ב־Redux
  const totalUnreadChatCount =
    chatState?.activeChatPartners?.reduce((acc, p) => acc + (Number(p.unreadCount) || 0), 0) || 0;

  useEffect(() => {
    dispatch(fetchAllOrders());
    dispatch(fetchEmployees());
    dispatch(fetchNotifications());
    dispatch(fetchCatalogByStatus('WAITING_ADMIN_APPROVAL'));
    dispatch(fetchActiveChatPartners());
  }, [dispatch]);

  const activeOrders = orders.filter(o => o.status !== 'DONE');
  const newOrders = orders.filter(o => o.status === 'ORDERED');
  const carpenters = employees.filter(e => e.role === 'CARPENTER');
  const pendingApproval = products.filter(p => p.status === 'WAITING_ADMIN_APPROVAL');

  const stats = [
    {
      title: 'הזמנות פעילות',
      value: activeOrders.length,
      sub: `${newOrders.length} חדשות`,
      onClick: () => navigate('/manager/orders')
    },
    {
      title: 'נגרים',
      value: carpenters.length,
      sub: `${carpenters.filter(c => c.currentWorkloadHours > 0).length} בעבודה`,
      onClick: () => navigate('/employees')
    },
    {
      title: 'ממתינים לאישור',
      value: pendingApproval.length,
      sub: 'מוצרים מאפיון',
      onClick: () => navigate('/catalog')
    },
    {
      title: 'התראות',
      value: unreadCount + totalUnreadChatCount,
      sub: totalUnreadChatCount > 0 ? `${totalUnreadChatCount} הודעות צ'אט` : 'אין הודעות חדשות',
      onClick: () => navigate('/chat')
    },
  ];

  if (ordersLoading || empLoading || chatState?.chatLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress sx={{ color: '#D2691E' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', mx: 'auto', boxSizing: 'border-box' }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 21, fontWeight: 700, color: '#3E2723' }}>
          שלום, {user?.fullName || user?.username || 'מנהל'} 👋
        </Typography>
      </Box>

      {/* שורה 1: כרטיסי סטטיסטיקה */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {stats.map((stat, i) => (
          <Grid size={{ xs: 6, md: 3 }} key={i}>
            <Box onClick={stat.onClick} sx={{
              bgcolor: STAT_COLORS[i], borderRadius: 3, p: 2.5, height: 140, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              transition: '0.15s ease', '&:hover': { transform: 'translateY(-2px)', opacity: 0.92 },
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{stat.title}</Typography>
                <Box sx={{ color: 'rgba(255,255,255,0.7)' }}>{STAT_ICONS[i]}</Box>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 34, fontWeight: 700, color: 'white', lineHeight: 1 }}>{stat.value}</Typography>
                <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', mt: 0.4 }}>{stat.sub}</Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {/* עמודה 1: הזמנות */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ borderRadius: 3, p: 2.5, border: `1px solid ${CARD_COLORS[0].border}`, bgcolor: CARD_COLORS[0].bg, height: 380, display: 'flex', flexDirection: 'column' }}>
            <SectionHeader emoji="📦" title="הזמנות אחרונות" btnLabel="הכל" onClick={() => navigate('/manager/orders')} titleColor={CARD_COLORS[0].title} />
            <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
              {activeOrders.slice(0, 10).map(order => (
                <Box key={order.id || order._id} sx={{ display: 'flex', justifyContent: 'space-between', py: 1.2, borderBottom: `1px solid ${CARD_COLORS[0].border}` }}>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{order.customer?.name || 'לקוח'}</Typography>
                    <Typography sx={{ fontSize: 11, color: '#A1887F' }}>{new Date(order.orderDate).toLocaleDateString('he-IL')}</Typography>
                  </Box>
                  <Box sx={{ fontSize: 11, px: 1, py: 0.3, borderRadius: 10, bgcolor: 'white', color: STATUS_LABEL[order.status]?.color, fontWeight: 600 }}>
                    {STATUS_LABEL[order.status]?.label || order.status}
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* עמודה 2: התראות + מלבן צ'אט בולט */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ borderRadius: 3, p: 2.5, border: `1px solid ${CARD_COLORS[1].border}`, bgcolor: CARD_COLORS[1].bg, height: 380, display: 'flex', flexDirection: 'column' }}>
            <SectionHeader emoji="🔔" title="התראות" titleColor={CARD_COLORS[1].title} />
            
            <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
              
              {/* 🚨 המלבן הכתום - יופיע אם יש הודעות שלא נקראו */}
              {totalUnreadChatCount > 0 && (
                <Box 
                  onClick={() => navigate('/chat')}
                  sx={{
                    mb: 2, p: 2, borderRadius: 2, 
                    bgcolor: '#D2691E', color: 'white',
                    display: 'flex', alignItems: 'center', gap: 2,
                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(210, 105, 30, 0.3)',
                    animation: 'pulse 2s infinite'
                  }}
                >
                  <ChatIcon />
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>הודעות צ'אט חדשות!</Typography>
                    <Typography sx={{ fontSize: 12, opacity: 0.9 }}>יש לך {totalUnreadChatCount} הודעות שמחכות לך</Typography>
                  </Box>
                </Box>
              )}

              {/* רשימת התראות רגילה */}
              {notifications.filter(n => !n.isRead && n.type !== 'CHAT').length === 0 && totalUnreadChatCount === 0 ? (
                <Alert severity="info">אין התראות חדשות</Alert>
              ) : (
                notifications.filter(n => !n.isRead && n.type !== 'CHAT').map(n => (
                  <Box key={n.id || n._id} sx={{ display: 'flex', justifyContent: 'space-between', py: 1.2, borderBottom: `1px solid ${CARD_COLORS[1].border}` }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>{n.message}</Typography>
                      <Typography sx={{ fontSize: 10, color: '#A1887F' }}>{new Date(n.createdAt).toLocaleString('he-IL')}</Typography>
                    </Box>
                    <Button size="small" sx={{ minWidth: 0, color: '#D2691E' }} onClick={() => dispatch(markNotificationRead(n.id || n._id))}>✓</Button>
                  </Box>
                ))
              )}
            </Box>
          </Paper>
        </Grid>

        {/* עמודה 3: עומס נגרים */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ borderRadius: 3, p: 2.5, border: `1px solid ${CARD_COLORS[2].border}`, bgcolor: CARD_COLORS[2].bg, height: 380, display: 'flex', flexDirection: 'column' }}>
            <SectionHeader emoji="🪚" title="עומס נגרים" btnLabel="הכל" onClick={() => navigate('/employees')} titleColor={CARD_COLORS[2].title} />
            <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
              {carpenters.map(c => (
                <Box key={c.id || c._id} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{c.fullName}</Typography>
                    <Typography sx={{ fontSize: 11 }}>{c.currentWorkloadHours || 0} ש'</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={Math.min((c.currentWorkloadHours || 0) * 2.5, 100)} sx={{ height: 6, borderRadius: 2 }} />
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* CSS לאנימציה של המלבן הכתום */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </Box>
  );
};

export default Dashboard;