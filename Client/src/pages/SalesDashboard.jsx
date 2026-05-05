import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Paper, Button, CircularProgress,
  Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PaidIcon from '@mui/icons-material/Paid';
import ChatIcon from '@mui/icons-material/Chat';

import { fetchOrdersForSales, markOrderAsPaid, createOrder } from '../store/slices/ordersSlice';
import { fetchNotifications, markNotificationRead } from '../store/slices/notificationsSlice';
import { fetchActiveChatPartners } from '../store/slices/chatSlice';

// === קבועים ===
const STATUS_LABEL = {
  QUOTATION_PENDING:     { label: 'בהצעת מחיר',    color: '#FFD700' },
  ORDERED:               { label: 'הזמנה חדשה',    color: '#D2691E' },
  WAITING_FOR_WAREHOUSE: { label: 'ממתין למחסן',   color: '#A0522D' },
  WAITING_FOR_PICKING:   { label: 'ממתין לליקוט',  color: '#8B0000' },
  WAITING_FOR_SUPPLY:    { label: 'ממתין לאספקה',  color: '#CC5E00' },
  READY_FOR_SHIPPING:    { label: 'מוכן למשלוח',   color: '#5D4037' },
  IN_PROGRESS:           { label: 'בעבודה',         color: '#6D4C41' },
  DONE:                  { label: 'הושלם',          color: '#9E9E9F' },
};

const STAT_COLORS = ['#D2691E', '#6B3520', '#A0522D', '#2E7D32'];
const STAT_ICONS = [
  <ShoppingCartIcon sx={{ fontSize: 26 }} />,
  <AssignmentIcon   sx={{ fontSize: 26 }} />,
  <PaidIcon         sx={{ fontSize: 26 }} />,
  <ChatIcon         sx={{ fontSize: 26 }} />,
];

const CARD_COLORS = [
  { bg: '#FBF0E9', border: '#E8C9B0', title: '#7B3F1A' },
  { bg: '#F5EDE8', border: '#DDB89A', title: '#6B3520' },
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

// === דשבורד ===
const SalesDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user }                                          = useSelector(s => s.auth);
  const { orders, loading: ordersLoading, submitLoading } = useSelector(s => s.orders);
  const { notifications }                                 = useSelector(s => s.notifications);
  const chatState                                         = useSelector(s => s.chat);

  // ─── חישוב צ'אט בדיוק כמו מחסנאי ───
  const totalUnreadChatCount = (
    (chatState?.unreadMessagesCount
      ? Object.values(chatState.unreadMessagesCount).reduce((a, b) => a + (b || 0), 0)
      : 0) ||
    (chatState?.activeChatPartners?.reduce((acc, p) => acc + (p.unreadCount || 0), 0) || 0)
  );

  const unreadNotif = (notifications || []).filter(n => !n.isRead && n.type !== 'CHAT').length;

  const [openNewOrderDialog, setOpenNewOrderDialog] = useState(false);
  const [newOrderData, setNewOrderData] = useState({
    customerName: '', customerPhone1: '', customerPhone2: '',
    deliveryAddress: '', invoiceName: '', items: []
  });
  const [orderFormErrors, setOrderFormErrors] = useState({});

  useEffect(() => {
    dispatch(fetchActiveChatPartners());
    dispatch(fetchNotifications());
    dispatch(fetchOrdersForSales());
  }, [dispatch]);

  // === פילטור הזמנות ===
  const quotationPendingOrders = orders.filter(o => o.status === 'QUOTATION_PENDING' && !o.isPaid);
  const activeOrders           = orders.filter(o => o.status !== 'DONE' && o.status !== 'QUOTATION_PENDING' && !o.isPaid);
  const collectionPendingOrders = orders.filter(o => o.status !== 'DONE' && !o.isPaid && o.status !== 'QUOTATION_PENDING');

  // === סטטיסטיקות ===
  const stats = [
    {
      title: 'בהצעת מחיר',
      value: quotationPendingOrders.length,
      sub: `${quotationPendingOrders.length} ממתינים לאישור`,
      onClick: () => navigate('/sales-orders', { state: { filterStatus: 'QUOTATION_PENDING' } }),
    },
    {
      title: 'הזמנות פעילות',
      value: activeOrders.length,
      sub: `${activeOrders.filter(o => o.status === 'ORDERED').length} במערכת`,
      onClick: () => navigate('/sales-orders', { state: { filterActive: true } }),
    },
    {
      title: 'בגבייה',
      value: collectionPendingOrders.length,
      sub: `${collectionPendingOrders.length} טרם שולמו`,
      onClick: () => navigate('/sales-orders', { state: { filterPaid: false } }),
    },
    {
      title: "צ'אט והתראות",
      value: unreadNotif + totalUnreadChatCount,
      sub: totalUnreadChatCount > 0 ? `${totalUnreadChatCount} הודעות צ'אט` : 'אין חדש',
      onClick: () => navigate('/chat'),
    },
  ];

  const handleMarkAsPaid = async (orderId) => {
    if (window.confirm('האם אתה בטוח שברצונך לסמן הזמנה זו כשולמה?')) {
      await dispatch(markOrderAsPaid(orderId));
      dispatch(fetchOrdersForSales());
    }
  };

  const handleNewOrderChange = (field) => (e) => {
    setNewOrderData({ ...newOrderData, [field]: e.target.value });
    if (orderFormErrors[field]) setOrderFormErrors({ ...orderFormErrors, [field]: '' });
  };

  const validateNewOrderForm = () => {
    const errors = {};
    if (!newOrderData.customerName.trim())    errors.customerName    = 'שם לקוח הוא שדה חובה';
    if (!newOrderData.customerPhone1.trim())  errors.customerPhone1  = 'טלפון הוא שדה חובה';
    if (!newOrderData.deliveryAddress.trim()) errors.deliveryAddress = 'כתובת היא שדה חובה';
    setOrderFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateNewOrder = async () => {
    if (!validateNewOrderForm()) return;
    const result = await dispatch(createOrder({ ...newOrderData, status: 'QUOTATION_PENDING', items: [] }));
    if (!result.error) {
      setOpenNewOrderDialog(false);
      setNewOrderData({ customerName: '', customerPhone1: '', customerPhone2: '', deliveryAddress: '', invoiceName: '', items: [] });
      dispatch(fetchOrdersForSales());
    }
  };

  if (ordersLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress sx={{ color: '#D2691E' }} />
    </Box>
  );

  return (
    <Box sx={{ width: '100%', boxSizing: 'border-box' }}>

      {/* כותרת */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: 21, fontWeight: 700, color: '#3E2723' }}>
            שלום, {user?.fullName || user?.username || 'סוכן מכירות'} 👋
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: '#A1887F', mt: 0.3 }}>
            {new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Typography>
        </Box>
        <Button
          variant="contained"
          sx={{ bgcolor: '#D2691E', '&:hover': { bgcolor: '#A0522D' } }}
          onClick={() => setOpenNewOrderDialog(true)}
        >
          + הזמנה חדשה
        </Button>
      </Box>

      {/* כרטיסי סטטיסטיקה */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map((stat, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Box onClick={stat.onClick} sx={{
              bgcolor: STAT_COLORS[i], borderRadius: 3, p: 2.5, height: 140,
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              justifyContent: 'space-between', transition: 'transform 0.15s ease',
              '&:hover': { transform: 'translateY(-2px)', opacity: 0.92 },
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                  {stat.title}
                </Typography>
                <Box sx={{ color: 'rgba(255,255,255,0.7)' }}>{STAT_ICONS[i]}</Box>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 34, fontWeight: 700, color: 'white', lineHeight: 1 }}>
                  {stat.value}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', mt: 0.4 }}>
                  {stat.sub}
                </Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* שורה 2: הזמנות בגבייה + התראות */}
      <Grid container spacing={2}>

        {/* הזמנות בגבייה */}
        <Grid item xs={12} md={8}>
          <Paper sx={{
            borderRadius: 3, p: 2.5, boxShadow: 'none',
            border: `1px solid ${CARD_COLORS[0].border}`,
            bgcolor: CARD_COLORS[0].bg, height: 400,
            display: 'flex', flexDirection: 'column',
          }}>
            <SectionHeader
              emoji="💰" title="הזמנות בגבייה" btnLabel="הכל"
              onClick={() => navigate('/sales-orders', { state: { filterPaid: false } })}
              titleColor={CARD_COLORS[0].title}
            />
            <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
              {collectionPendingOrders.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2, fontSize: 12 }}>אין הזמנות בגבייה כרגע.</Alert>
              ) : collectionPendingOrders.slice(0, 8).map(order => (
                <Box key={order._id} sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  py: 1.2, borderBottom: `1px solid ${CARD_COLORS[0].border}`,
                }}>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{order.customer?.name || '-'}</Typography>
                    <Typography sx={{ fontSize: 11, color: '#A1887F' }}>
                      {new Date(order.orderDate).toLocaleDateString('he-IL')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{
                      fontSize: 11, px: 1.2, py: 0.3, borderRadius: 10,
                      bgcolor: 'white', color: STATUS_LABEL[order.status]?.color, fontWeight: 600,
                    }}>
                      {STATUS_LABEL[order.status]?.label}
                    </Typography>
                    <IconButton size="small" sx={{ color: '#2E7D32' }} onClick={() => handleMarkAsPaid(order._id)}>
                      <PaidIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* התראות — בדיוק כמו מחסנאי */}
        <Grid item xs={12} md={4}>
          <Paper sx={{
            borderRadius: 3, p: 2.5, boxShadow: 'none',
            border: `1px solid ${CARD_COLORS[1].border}`,
            bgcolor: CARD_COLORS[1].bg, height: 400,
            display: 'flex', flexDirection: 'column',
          }}>
            <SectionHeader emoji="🔔" title="התראות אחרונות" titleColor={CARD_COLORS[1].title} />
            <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>

              {/* ─── כרטיס צ'אט — בדיוק כמו מחסנאי ─── */}
              {totalUnreadChatCount > 0 && (
                <Box
                  onClick={() => navigate('/chat')}
                  sx={{
                    mb: 2, p: 2, borderRadius: 2,
                    bgcolor: '#D2691E', color: 'white',
                    display: 'flex', alignItems: 'center', gap: 2,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(210,105,30,0.3)',
                    animation: 'pulse 2s infinite',
                  }}
                >
                  <ChatIcon />
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                      הודעות צ'אט חדשות!
                    </Typography>
                    <Typography sx={{ fontSize: 12, opacity: 0.9 }}>
                      יש לך {totalUnreadChatCount} הודעות שמחכות לך
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* ─── התראות רגילות ─── */}
              {unreadNotif === 0 && totalUnreadChatCount === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2, fontSize: 12 }}>אין התראות חדשות</Alert>
              ) : (
                (notifications || [])
                  .filter(n => !n.isRead && n.type !== 'CHAT')
                  .map(n => (
                    <Box key={n._id || n.id} sx={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      py: 1.2, borderBottom: `1px solid ${CARD_COLORS[1].border}`,
                    }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: 12.5 }}>{n.message || n.text}</Typography>
                        <Typography sx={{ fontSize: 10, color: '#A1887F' }}>
                          {new Date(n.createdAt).toLocaleString('he-IL')}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        sx={{ color: '#D2691E' }}
                        onClick={() => dispatch(markNotificationRead(n._id || n.id))}
                      >
                        ✓
                      </IconButton>
                    </Box>
                  ))
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* דיאלוג הזמנה חדשה */}
      <Dialog open={openNewOrderDialog} onClose={() => setOpenNewOrderDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 'bold' }}>➕ יצירת הזמנה חדשה</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="שם לקוח *" fullWidth value={newOrderData.customerName}
              onChange={handleNewOrderChange('customerName')}
              error={!!orderFormErrors.customerName} helperText={orderFormErrors.customerName} />
            <TextField label="טלפון ראשי *" fullWidth value={newOrderData.customerPhone1}
              onChange={handleNewOrderChange('customerPhone1')}
              error={!!orderFormErrors.customerPhone1} helperText={orderFormErrors.customerPhone1} />
            <TextField label="טלפון נוסף" fullWidth value={newOrderData.customerPhone2}
              onChange={handleNewOrderChange('customerPhone2')} />
            <TextField label="כתובת משלוח *" fullWidth value={newOrderData.deliveryAddress}
              onChange={handleNewOrderChange('deliveryAddress')}
              error={!!orderFormErrors.deliveryAddress} helperText={orderFormErrors.deliveryAddress} />
            <TextField label="שם לחשבונית" fullWidth value={newOrderData.invoiceName}
              onChange={handleNewOrderChange('invoiceName')} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenNewOrderDialog(false)}>ביטול</Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#2E7D32' }}
            onClick={handleCreateNewOrder}
            disabled={submitLoading}
          >
            צור הצעת מחיר
          </Button>
        </DialogActions>
      </Dialog>

      <style>{`
        @keyframes pulse {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
      `}</style>
    </Box>
  );
};

export default SalesDashboard;