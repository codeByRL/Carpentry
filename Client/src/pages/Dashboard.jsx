import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Paper, Button, CircularProgress,
  Alert, LinearProgress, Tab, Tabs,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import InventoryIcon from '@mui/icons-material/Inventory';
import ChatIcon from '@mui/icons-material/Chat';

import { fetchAllOrders } from '../store/slices/ordersSlice';
import { fetchEmployees } from '../store/slices/employeesSlice';
import { fetchNotifications, markNotificationRead } from '../store/slices/notificationsSlice';
import { fetchCatalogByStatus } from '../store/slices/catalogSlice';
import { fetchActiveChatPartners } from '../store/slices/chatSlice';
import PageHeader from '../components/PageHeader.jsx';
import { dashboardStatColor } from '../utils/dashboardStatPalette.js';

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

const STAT_ICONS  = [
  <ShoppingCartIcon  sx={{ fontSize: 26 }} />,
  <PeopleIcon        sx={{ fontSize: 26 }} />,
  <InventoryIcon     sx={{ fontSize: 26 }} />,
  <ChatIcon sx={{ fontSize: 26 }} />,
];

const C = { primary: '#D2691E', border: '#E8C9B0', dark: '#3E2723' };

/** לשוניות תחת הכרטיס הגדול (כמו נגר / מחסן) */
const MANAGER_MAIN_TAB_KEYS = ['ORDERS', 'COMPLETED', 'ALERTS', 'CARPENTERS'];
/** סנכרון ריבוע סטטיסטיקה → לשונית (אינדקס 2 = ממתינים לאישור → ניווט לקטלוג בלבד) */
const STAT_INDEX_TO_TAB = ['ORDERS', 'CARPENTERS', null, 'ALERTS'];

const SectionHeader = ({ emoji, title, btnLabel, onClick, titleColor = '#3E2723' }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
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
  const [mainTab, setMainTab] = useState('ORDERS');

  const { user } = useSelector(s => s.auth);
  const { orders, loading: ordersLoading } = useSelector(s => s.orders);
  const { employees, loading: empLoading } = useSelector(s => s.employees);
  const { notifications } = useSelector(s => s.notifications);
  const unreadNotifCount = notifications.filter(n => !n.isRead && n.type !== 'CHAT').length;
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

  useEffect(() => {
    if (mainTab === 'CARPENTERS') {
      dispatch(fetchEmployees());
    }
  }, [dispatch, mainTab]);

  // כל ההזמנות שקיימות במערכת ועדיין לא נמסרו ללקוח (DONE = «סופק ללקוח»).
  // כולל QUOTATION_PENDING, ORDERED, WAITING_FOR_WAREHOUSE/PICKING/SUPPLY,
  // READY_FOR_SHIPPING ו-IN_PROGRESS. ממוין מהחדשה לישנה כדי שהדחופות יופיעו למעלה.
  const activeOrders = orders
    .filter(o => o.status !== 'DONE')
    .slice()
    .sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0));
  const completedOrders = orders
    .filter(o => o.status === 'DONE')
    .slice()
    .sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0));
  const newOrders = orders.filter(o => o.status === 'ORDERED');
  const carpenters = employees.filter(e => e.role === 'CARPENTER');
  const pendingApproval = products.filter(p => p.status === 'WAITING_ADMIN_APPROVAL');

  const stats = [
    {
      title: 'הזמנות פעילות',
      value: activeOrders.length,
      sub: `${newOrders.length} חדשות`,
      onClick: () => setMainTab('ORDERS'),
    },
    {
      title: 'נגרים',
      value: carpenters.length,
      sub: `${carpenters.filter(c => c.currentWorkloadHours > 0).length} בעבודה`,
      onClick: () => setMainTab('CARPENTERS'),
    },
    {
      title: 'ממתינים לאישור',
      value: pendingApproval.length,
      sub: 'חזרו מאיפיון וממתינים לאישור',
      onClick: () => navigate('/catalog'),
    },
    {
      title: 'התראות',
      value: unreadNotifCount + totalUnreadChatCount,
      sub: totalUnreadChatCount > 0 ? `${totalUnreadChatCount} הודעות צ'אט` : 'אין הודעות חדשות',
      onClick: () => setMainTab('ALERTS'),
    },
  ];

  if (ordersLoading || empLoading || chatState?.chatLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', mx: 'auto', boxSizing: 'border-box', minWidth: 0 }}>
      <PageHeader
        title="לוח מחוונים"
        description={`שלום, ${user?.fullName || user?.username || 'מנהל'} — הזמנות, צוות, קטלוג והתראות במקום אחד.\n${new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
      />

      {/* שורה 1: כרטיסי סטטיסטיקה */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {stats.map((stat, i) => (
          <Grid size={{ xs: 6, md: 3 }} key={i}>
            <Box onClick={stat.onClick} sx={{
              bgcolor: dashboardStatColor(i), borderRadius: 3, p: 2.5, height: 140, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              transition: '0.15s ease', '&:hover': { transform: 'translateY(-2px)', opacity: 0.92 },
              outline: STAT_INDEX_TO_TAB[i] && mainTab === STAT_INDEX_TO_TAB[i]
                ? '2px solid rgba(255,255,255,0.85)'
                : 'none',
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

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
          mb: 2,
        }}
      >
        <Tabs
          value={MANAGER_MAIN_TAB_KEYS.includes(mainTab) ? mainTab : false}
          onChange={(_, v) => setMainTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            borderBottom: `1px solid ${C.border}`,
            bgcolor: '#FFFBF8',
            '& .MuiTab-root': { fontSize: 13, fontWeight: 600, minHeight: 48 },
            '& .Mui-selected': { color: C.primary },
            '& .MuiTabs-indicator': { bgcolor: C.primary },
          }}
        >
          <Tab label={`הזמנות (${activeOrders.length})`} value="ORDERS" />
          <Tab label={`סופקו ללקוח (${completedOrders.length})`} value="COMPLETED" />
          <Tab
            label={
              unreadNotifCount + totalUnreadChatCount > 0
                ? `התראות (${unreadNotifCount + totalUnreadChatCount})`
                : 'התראות'
            }
            value="ALERTS"
          />
          <Tab label={`עומס נגרים (${carpenters.length})`} value="CARPENTERS" />
        </Tabs>

        <Box sx={{ p: { xs: 1.5, sm: 2.5 }, minHeight: { xs: 280, sm: 360 } }}>
          {mainTab === 'ORDERS' && (
            <Box>
              <SectionHeader
                emoji="📦"
                title="הזמנות"
                btnLabel="הכל"
                onClick={() => navigate('/manager/orders')}
                titleColor="#7B3F1A"
              />
              <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
                {activeOrders.length === 0 ? (
                  <Alert severity="info">אין הזמנות פעילות</Alert>
                ) : (
                  activeOrders.map(order => (
                    <Box
                      key={order.id || order._id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        py: 1.2,
                        borderBottom: '1px solid #E8C9B0',
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{order.customer?.name || 'לקוח'}</Typography>
                        <Typography sx={{ fontSize: 11, color: '#A1887F' }}>
                          {new Date(order.orderDate).toLocaleDateString('he-IL')}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          fontSize: 11,
                          px: 1,
                          py: 0.3,
                          borderRadius: 10,
                          bgcolor: 'white',
                          color: STATUS_LABEL[order.status]?.color,
                          fontWeight: 600,
                        }}
                      >
                        {STATUS_LABEL[order.status]?.label || order.status}
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          )}

          {mainTab === 'ALERTS' && (
            <Box>
              <SectionHeader emoji="🔔" title="התראות" titleColor="#6B3520" />
              <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
                {totalUnreadChatCount > 0 && (
                  <Box
                    onClick={() => navigate('/chat')}
                    sx={{
                      mb: 2,
                      p: 2,
                      borderRadius: 2,
                      bgcolor: '#D2691E',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(210, 105, 30, 0.3)',
                      animation: 'pulse 2s infinite',
                    }}
                  >
                    <ChatIcon />
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>הודעות צ&apos;אט חדשות!</Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.9 }}>
                        יש לך {totalUnreadChatCount} הודעות שמחכות לך
                      </Typography>
                    </Box>
                  </Box>
                )}
                {notifications.filter(n => !n.isRead && n.type !== 'CHAT').length === 0 &&
                totalUnreadChatCount === 0 ? (
                  <Alert severity="info">אין התראות חדשות</Alert>
                ) : (
                  notifications
                    .filter(n => !n.isRead && n.type !== 'CHAT')
                    .map(n => (
                      <Box
                        key={n.id || n._id}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          py: 1.2,
                          borderBottom: '1px solid #DDB89A',
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>{n.message}</Typography>
                          <Typography sx={{ fontSize: 10, color: '#A1887F' }}>
                            {new Date(n.createdAt).toLocaleString('he-IL')}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          sx={{ minWidth: 0, color: '#D2691E' }}
                          onClick={() => dispatch(markNotificationRead(n.id || n._id))}
                        >
                          ✓
                        </Button>
                      </Box>
                    ))
                )}
              </Box>
            </Box>
          )}

          {mainTab === 'COMPLETED' && (
            <Box>
              <SectionHeader
                emoji="✅"
                title="הזמנות שסופקו ללקוח"
                btnLabel="הכל"
                onClick={() =>
                  navigate('/manager/orders', {
                    state: {
                      initialOrdersTab: 'COMPLETED',
                      emptyText: 'אין הזמנות שסופקו ללקוח',
                    },
                  })
                }
                titleColor="#2E7D32"
              />
              <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
                {completedOrders.length === 0 ? (
                  <Alert severity="info">אין הזמנות שסופקו ללקוח</Alert>
                ) : (
                  completedOrders.map(order => (
                    <Box
                      key={order.id || order._id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        py: 1.2,
                        borderBottom: '1px solid #E8C9B0',
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{order.customer?.name || 'לקוח'}</Typography>
                        <Typography sx={{ fontSize: 11, color: '#A1887F' }}>
                          {order.orderDate ? new Date(order.orderDate).toLocaleDateString('he-IL') : '—'}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          fontSize: 11,
                          px: 1,
                          py: 0.3,
                          borderRadius: 10,
                          bgcolor: '#E8F5E9',
                          color: '#2E7D32',
                          fontWeight: 600,
                        }}
                      >
                        סופק ללקוח
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          )}

          {mainTab === 'CARPENTERS' && (
            <Box>
              <SectionHeader
                emoji="🪚"
                title="עומס נגרים"
                btnLabel="הכל"
                onClick={() => navigate('/employees')}
                titleColor="#4A5228"
              />
              <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
                {carpenters.length === 0 ? (
                  <Alert severity="info">אין נגרים במערכת</Alert>
                ) : (
                  carpenters.map(c => (
                    <Box key={c.id || c._id} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{c.fullName}</Typography>
                        <Typography sx={{ fontSize: 11 }}>{c.currentWorkloadHours || 0} ש&apos;</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min((c.currentWorkloadHours || 0) * 2.5, 100)}
                        sx={{ height: 6, borderRadius: 2 }}
                      />
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Paper>

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