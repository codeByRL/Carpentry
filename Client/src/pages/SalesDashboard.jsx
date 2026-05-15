import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Grid, Paper, Button, CircularProgress,
  Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Tabs, Tab, Autocomplete
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PaidIcon from '@mui/icons-material/Paid';
import ChatIcon from '@mui/icons-material/Chat';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

import { fetchOrdersForSales, markOrderAsPaid, confirmQuotationOrder, createOrder, clearSubmitError } from '../store/slices/ordersSlice';
import { useFeedbackSnackbar } from '../hooks/useFeedbackSnackbar';
import { firstFormError } from '../utils/formFeedback';
import { fetchNotifications, markNotificationRead } from '../store/slices/notificationsSlice';
import { fetchActiveChatPartners } from '../store/slices/chatSlice';
import API from '../services/api';
import PageHeader from '../components/PageHeader.jsx';
import { dashboardStatColor } from '../utils/dashboardStatPalette.js';

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
const PRODUCT_TYPES = ['מיטה', 'ארון', 'שידה', 'ספה', 'שולחן', 'כסא'];
const VAT_RATE = 0.18;
// תאריך אספקה משוער = שעות העבודה שהנגר איפיין מומרות לימי הכנה (4 ש' = יום) + 7 ימי מרווח להובלה.
const WORK_HOURS_PER_PREPARATION_DAY = 4;
const ADDITIONAL_DELIVERY_DAYS_AFTER_PREPARATION = 7;
const MAX_ITEM_QUANTITY = 100;

const normalizePhone = (value = '') => value.replace(/[^\d]/g, '').replace(/^972/, '0');
const isValidPhone = (value = '') => /^0\d{8,9}$/.test(normalizePhone(value));
const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value || '').trim());
const isValidIsraeliId = (value = '') => {
  const digits = (value || '').replace(/[^\d]/g, '').padStart(9, '0');
  if (!/^\d{9}$/.test(digits)) return false;
  const check = digits
    .split('')
    .map(Number)
    .reduce((sum, d, i) => {
      const x = d * ((i % 2) + 1);
      return sum + (x > 9 ? x - 9 : x);
    }, 0);
  return check % 10 === 0;
};

// בחירת בד מוצגת אך ורק אם המוצר הוגדר מפורשות כדורש בחירת בד באפיון/בעריכת המנהל.
const productRequiresFabricSelection = (_item, product) => product?.needsFabricSelection === true;
const productRequiresFormicaSelection = (_item, product) => product?.needsFormicaSelection === true;
const productRequiresHandleSelection = (_item, product) => product?.needsHandleSelection === true;

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

// === דשבורד ===
const SalesDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError, FeedbackSnackbar } = useFeedbackSnackbar();

  const { user }                                          = useSelector(s => s.auth);
  const { orders, loading: ordersLoading, submitLoading, submitError } = useSelector(s => s.orders);
  const { notifications }                                 = useSelector(s => s.notifications);
  const chatState                                         = useSelector(s => s.chat);

  // ─── חישוב צ'אט בדיוק כמו מחסנאי ───
  const totalUnreadChatCount =
    chatState?.activeChatPartners?.reduce((acc, p) => acc + (Number(p.unreadCount) || 0), 0) || 0;

  const unreadNotif = (notifications || []).filter(n => !n.isRead && n.type !== 'CHAT').length;

  const [openNewOrderDialog, setOpenNewOrderDialog] = useState(false);
  const [newOrderData, setNewOrderData] = useState({
    customerName: '', customerPhone1: '', customerPhone2: '',
    customerIdNumber: '', customerEmail: '',
    deliveryAddress: '', invoiceName: '',
    orderDate: new Date().toISOString().slice(0, 10),
    estimatedDeliveryDate: '',
    items: [{ productType: '', catalogProductId: '', quantity: 1, selectedFabric: '', selectedFormica: '', selectedHandle: '' }]
  });
  const [orderFormErrors, setOrderFormErrors] = useState({});
  const [activeCatalog, setActiveCatalog] = useState([]);
  const [fabricMaterials, setFabricMaterials] = useState([]);
  const [formicaModels, setFormicaModels] = useState([]);
  const [handleMaterials, setHandleMaterials] = useState([]);
  const [deliveryDateManuallyEdited, setDeliveryDateManuallyEdited] = useState(false);
  const [salesView, setSalesView] = useState('COLLECTION'); // COLLECTION | QUOTATION | PAID
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    dispatch(fetchActiveChatPartners());
    dispatch(fetchNotifications());
    dispatch(fetchOrdersForSales());
    API.get('/catalog/active')
      .then((res) => setActiveCatalog(res.data || []))
      .catch(() => setActiveCatalog([]));
    API.get('/base-products?isMaterial=true&type=fabric&limit=500')
      .then((r) => (Array.isArray(r.data) ? r.data : []))
      .then((fabrics) => setFabricMaterials(Array.isArray(fabrics) ? fabrics : []))
      .catch(() => setFabricMaterials([]));
    API.get('/formica?limit=500')
      .then((r) => setFormicaModels(Array.isArray(r.data) ? r.data : []))
      .catch(() => setFormicaModels([]));
    API.get('/base-products?isMaterial=true&type=handle&limit=500')
      .then((r) => (Array.isArray(r.data) ? r.data : []))
      .then((handles) => setHandleMaterials(Array.isArray(handles) ? handles : []))
      .catch(() => setHandleMaterials([]));
  }, [dispatch]);

  useEffect(() => {
    if (location.pathname === '/sales/new-order') {
      dispatch(clearSubmitError());
      setOrderFormErrors({});
      setOpenNewOrderDialog(true);
      navigate('/sales-dashboard', { replace: true });
    }
  }, [location.pathname, dispatch, navigate]);

  // === פילטור הזמנות (ממוין מהחדשה לישנה כדי שהדחופות יופיעו למעלה) ===
  const sortByDateDesc = (a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0);
  const quotationPendingOrders = orders
    .filter(o => o.status === 'QUOTATION_PENDING' && !o.isPaid)
    .slice()
    .sort(sortByDateDesc);
  const unpaidOrders = orders
    .filter(o => o.status !== 'DONE' && o.status !== 'QUOTATION_PENDING' && !o.isPaid)
    .slice()
    .sort(sortByDateDesc);
  const paidOrders = orders
    .filter(o => o.isPaid)
    .slice()
    .sort(sortByDateDesc);
  const collectionPendingOrders = unpaidOrders;

  // === סטטיסטיקות ===
  const stats = [
    {
      title: 'בהצעת מחיר',
      value: quotationPendingOrders.length,
      sub: `${quotationPendingOrders.length} ממתינים לאישור`,
      onClick: () => setSalesView('QUOTATION'),
    },
    {
      title: 'הזמנות פעילות',
      value: collectionPendingOrders.length,
      sub: `${collectionPendingOrders.length} טרם שולמו`,
      onClick: () => setSalesView('COLLECTION'),
    },
    {
      title: 'שולמו',
      value: paidOrders.length,
      sub: `${paidOrders.length} הזמנות שולמו`,
      onClick: () => setSalesView('PAID'),
    },
    {
      title: "צ'אט והתראות",
      value: unreadNotif + totalUnreadChatCount,
      sub: totalUnreadChatCount > 0 ? `${totalUnreadChatCount} הודעות צ'אט` : 'אין חדש',
      onClick: () => navigate('/chat'),
    },
  ];

  const viewMeta = {
    COLLECTION: { title: 'הזמנות', emoji: '💰', empty: 'אין הזמנות בגבייה כרגע.' },
    QUOTATION: { title: 'הצעות מחיר', emoji: '📝', empty: 'אין הזמנות בהצעת מחיר כרגע.' },
    PAID: { title: 'הזמנות ששולמו', emoji: '✅', empty: 'אין הזמנות ששולמו כרגע.' },
  };

  const displayedOrders =
    salesView === 'QUOTATION' ? quotationPendingOrders
    : salesView === 'PAID' ? paidOrders
    : collectionPendingOrders;

  const handleMarkAsPaid = async (orderId) => {
    if (window.confirm('האם אתה בטוח שברצונך לסמן הזמנה זו כשולמה?')) {
      const result = await dispatch(markOrderAsPaid(orderId));
      if (!result.error) {
        showSuccess('ההזמנה סומנה כשולמה');
        dispatch(fetchOrdersForSales());
      }
    }
  };

  const handleConfirmQuotation = async (orderId) => {
    if (window.confirm('להמיר הצעת מחיר להזמנה פעילה?')) {
      const result = await dispatch(confirmQuotationOrder(orderId));
      if (!result.error) {
        showSuccess('הצעת המחיר הומרה להזמנה פעילה');
        dispatch(fetchOrdersForSales());
      }
    }
  };

  const handleNewOrderChange = (field) => (e) => {
    setNewOrderData({ ...newOrderData, [field]: e.target.value });
    if (field === 'estimatedDeliveryDate') {
      setDeliveryDateManuallyEdited(true);
    }
    if (orderFormErrors[field]) setOrderFormErrors({ ...orderFormErrors, [field]: '' });
  };

  const handleOrderItemChange = (index, field, value) => {
    const nextItems = [...newOrderData.items];
    nextItems[index] = { ...nextItems[index], [field]: value };
    if (field === 'productType') {
      nextItems[index].catalogProductId = '';
      nextItems[index].selectedFabric = '';
      nextItems[index].selectedFormica = '';
      nextItems[index].selectedHandle = '';
    }
    if (field === 'catalogProductId') {
      nextItems[index].selectedFabric = '';
      nextItems[index].selectedFormica = '';
      nextItems[index].selectedHandle = '';
    }
    setNewOrderData({ ...newOrderData, items: nextItems });
  };

  const addOrderItemRow = () => {
    setNewOrderData((prev) => ({
      ...prev,
      items: [...prev.items, { productType: '', catalogProductId: '', quantity: 1, selectedFabric: '', selectedFormica: '', selectedHandle: '' }],
    }));
  };

  const removeOrderItemRow = (index) => {
    setNewOrderData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const getProductById = (id) =>
    id ? activeCatalog.find((p) => String(p._id) === String(id)) : undefined;

  const getFilteredModelsByType = (productType) => {
    if (!productType) return activeCatalog;
    // נסיב על שדה category — מקור האמת. נופלים חזרה ל־includes לשם תאימות לאחור עד שכל המוצרים מוגרים.
    return activeCatalog.filter((p) => {
      if (p?.category) return p.category === productType;
      return (p?.name || '').includes(productType);
    });
  };

  const getFabricOptionsForItem = () => {
    // כל סוגי הבד במערכת לבחירה
    return fabricMaterials;
  };

  const getUnitPrice = (item) => {
    const p = getProductById(item.catalogProductId);
    if (!p) return 0;
    let delta = 0;
    if (productRequiresFabricSelection(item, p) && item.selectedFabric) {
      const f = fabricMaterials.find((m) => m._id === item.selectedFabric);
      delta += Number(f?.priceDelta || 0);
    }
    if (productRequiresFormicaSelection(item, p) && item.selectedFormica) {
      const fm = formicaModels.find((m) => m._id === item.selectedFormica);
      delta += Number(fm?.priceDelta || 0);
    }
    if (productRequiresHandleSelection(item, p) && item.selectedHandle) {
      const h = handleMaterials.find((m) => m._id === item.selectedHandle);
      delta += Number(h?.priceDelta || 0);
    }
    return Number(p.price || 0) + delta;
  };

  const getLineTotal = (item) => getUnitPrice(item) * Number(item.quantity || 0);

  const subtotal = newOrderData.items.reduce((sum, item) => sum + getLineTotal(item), 0);
  const totalWithVat = Math.round(subtotal * (1 + VAT_RATE) * 100) / 100;

  const toDateInput = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // מחזיר את זמן ההכנה הארוך ביותר בקטלוג בקרב שורות ההזמנה (בשעות עבודה),
  // לפי מה שהנגר איפיין למוצר (estimatedWorkTime * כמות בשורה).
  const getMaxCarpenterPreparationHours = () => {
    return newOrderData.items.reduce((max, item) => {
      const product = getProductById(item.catalogProductId);
      const estimatedWork = Number(product?.estimatedWorkTime || 0);
      if (!estimatedWork) return max;
      const perLineHours = estimatedWork * Number(item.quantity || 1);
      return perLineHours > max ? perLineHours : max;
    }, 0);
  };

  const computeDefaultEstimatedDeliveryDate = () => {
    const baseDate = newOrderData.orderDate ? new Date(newOrderData.orderDate) : new Date();
    const maxHours = getMaxCarpenterPreparationHours();
    // 4 שעות עבודה = יום הכנה אחד; אחר כך מוסיפים 7 ימים מרווח להובלה.
    const preparationDays = Math.ceil(maxHours / WORK_HOURS_PER_PREPARATION_DAY);
    const totalDays = preparationDays + ADDITIONAL_DELIVERY_DAYS_AFTER_PREPARATION;
    const due = new Date(baseDate);
    due.setDate(due.getDate() + totalDays);
    return toDateInput(due);
  };

  /** תאריך אספקה לשליחה/ולידציה — לא נשען רק על ה־useEffect שממלא את השדה */
  const getResolvedEstimatedDeliveryDate = () =>
    (newOrderData.estimatedDeliveryDate && String(newOrderData.estimatedDeliveryDate).trim())
      ? newOrderData.estimatedDeliveryDate
      : computeDefaultEstimatedDeliveryDate();

  useEffect(() => {
    if (!deliveryDateManuallyEdited) {
      setNewOrderData((prev) => ({
        ...prev,
        estimatedDeliveryDate: computeDefaultEstimatedDeliveryDate(),
      }));
    }
  }, [newOrderData.items, newOrderData.orderDate, activeCatalog, deliveryDateManuallyEdited]);

  const validateNewOrderForm = () => {
    const errors = {};
    if (!newOrderData.customerName.trim()) errors.customerName = 'שם לקוח הוא שדה חובה';
    else if (newOrderData.customerName.trim().length < 2) errors.customerName = 'שם לקוח חייב להכיל לפחות 2 תווים';

    if (!newOrderData.customerPhone1.trim()) errors.customerPhone1 = 'טלפון הוא שדה חובה';
    else if (!isValidPhone(newOrderData.customerPhone1)) errors.customerPhone1 = 'טלפון ראשי לא תקין';

    if (newOrderData.customerPhone2?.trim() && !isValidPhone(newOrderData.customerPhone2)) {
      errors.customerPhone2 = 'טלפון נוסף לא תקין';
    }

    if (!newOrderData.customerIdNumber?.trim()) errors.customerIdNumber = 'תעודת זהות היא שדה חובה';
    else if (!isValidIsraeliId(newOrderData.customerIdNumber)) errors.customerIdNumber = 'תעודת זהות לא תקינה';

    if (!newOrderData.customerEmail?.trim()) errors.customerEmail = 'דוא״ל הוא שדה חובה';
    else if (!isValidEmail(newOrderData.customerEmail)) errors.customerEmail = 'כתובת דוא״ל לא תקינה';

    if (!newOrderData.invoiceName?.trim()) errors.invoiceName = 'שם לחשבונית הוא שדה חובה';
    else if (newOrderData.invoiceName.trim().length < 2) errors.invoiceName = 'שם לחשבונית קצר מדי';

    if (!newOrderData.deliveryAddress.trim()) errors.deliveryAddress = 'כתובת היא שדה חובה';
    else if (newOrderData.deliveryAddress.trim().length < 5) errors.deliveryAddress = 'כתובת חייבת להכיל לפחות 5 תווים';

    if (!newOrderData.orderDate) errors.orderDate = 'תאריך הזמנה הוא שדה חובה';
    const resolvedEst = getResolvedEstimatedDeliveryDate();
    if (!resolvedEst) errors.estimatedDeliveryDate = 'תאריך אספקה משוער הוא שדה חובה';
    if (newOrderData.orderDate && resolvedEst) {
      const orderDate = new Date(newOrderData.orderDate);
      const estimatedDeliveryDate = new Date(resolvedEst);
      if (estimatedDeliveryDate < orderDate) {
        errors.estimatedDeliveryDate = 'תאריך אספקה לא יכול להיות לפני תאריך ההזמנה';
      }
    }
    if (!newOrderData.items.length) errors.items = 'חובה להוסיף לפחות שורת מוצר אחת';
    const selectedProducts = new Set();
    newOrderData.items.forEach((item, idx) => {
      if (!item.catalogProductId) errors[`catalogProductId_${idx}`] = 'בחר דגם';
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_ITEM_QUANTITY) {
        errors[`quantity_${idx}`] = `כמות חייבת להיות מספר שלם בין 1 ל-${MAX_ITEM_QUANTITY}`;
      }
      if (item.catalogProductId) {
        if (selectedProducts.has(item.catalogProductId)) {
          errors[`catalogProductId_${idx}`] = 'לא ניתן לבחור את אותו דגם יותר מפעם אחת בהזמנה';
        } else {
          selectedProducts.add(item.catalogProductId);
        }
      }
      const p = getProductById(item.catalogProductId);
      if (productRequiresFabricSelection(item, p) && !item.selectedFabric) {
        errors[`selectedFabric_${idx}`] = 'חובה לבחור בד למוצר זה';
      } else if (
        productRequiresFabricSelection(item, p) &&
        item.selectedFabric &&
        !getFabricOptionsForItem().some((m) => m._id === item.selectedFabric)
      ) {
        errors[`selectedFabric_${idx}`] = 'בחירת הבד אינה תקפה למוצר זה';
      }
      if (productRequiresFormicaSelection(item, p) && !item.selectedFormica) {
        errors[`selectedFormica_${idx}`] = 'חובה לבחור פורמייקה למוצר זה';
      } else if (
        productRequiresFormicaSelection(item, p) &&
        item.selectedFormica &&
        !formicaModels.some((m) => m._id === item.selectedFormica)
      ) {
        errors[`selectedFormica_${idx}`] = 'בחירת הפורמייקה אינה תקפה למוצר זה';
      }
      if (productRequiresHandleSelection(item, p) && !item.selectedHandle) {
        errors[`selectedHandle_${idx}`] = 'חובה לבחור ידית למוצר זה';
      } else if (
        productRequiresHandleSelection(item, p) &&
        item.selectedHandle &&
        !handleMaterials.some((m) => m._id === item.selectedHandle)
      ) {
        errors[`selectedHandle_${idx}`] = 'בחירת הידית אינה תקפה למוצר זה';
      }
    });
    setOrderFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      showError(firstFormError(errors));
      return false;
    }
    return true;
  };

  const handleCreateNewOrder = async (status) => {
    if (!validateNewOrderForm()) {
      return;
    }
    const payload = {
      customerName: newOrderData.customerName.trim(),
      customerPhone1: normalizePhone(newOrderData.customerPhone1),
      customerPhone2: normalizePhone(newOrderData.customerPhone2),
      customerIdNumber: newOrderData.customerIdNumber.replace(/[^\d]/g, ''),
      customerEmail: newOrderData.customerEmail.trim(),
      deliveryAddress: newOrderData.deliveryAddress.trim(),
      invoiceName: newOrderData.invoiceName.trim(),
      orderDate: newOrderData.orderDate,
      estimatedDeliveryDate: getResolvedEstimatedDeliveryDate(),
      status,
      items: newOrderData.items.map((item) => {
        const p = getProductById(item.catalogProductId);
        const row = {
          catalogProductId: item.catalogProductId,
          productType: item.productType,
          quantity: Number(item.quantity),
        };
        if (productRequiresFabricSelection(item, p) && item.selectedFabric) {
          row.selectedFabric = item.selectedFabric;
        }
        if (productRequiresFormicaSelection(item, p) && item.selectedFormica) {
          row.selectedFormica = item.selectedFormica;
        }
        if (productRequiresHandleSelection(item, p) && item.selectedHandle) {
          row.selectedHandle = item.selectedHandle;
        }
        return row;
      }),
    };
    try {
      await dispatch(createOrder(payload)).unwrap();
      showSuccess(status === 'QUOTATION_PENDING' ? 'הצעת המחיר נשמרה בהצלחה' : 'ההזמנה נוצרה בהצלחה');
      setOpenNewOrderDialog(false);
      setNewOrderData({
        customerName: '', customerPhone1: '', customerPhone2: '',
        customerIdNumber: '', customerEmail: '',
        deliveryAddress: '', invoiceName: '',
        orderDate: new Date().toISOString().slice(0, 10),
        estimatedDeliveryDate: '',
        items: [{ productType: '', catalogProductId: '', quantity: 1, selectedFabric: '', selectedFormica: '', selectedHandle: '' }],
      });
      setDeliveryDateManuallyEdited(false);
      dispatch(fetchOrdersForSales());
    } catch (err) {
      showError(firstFormError(err?.message || submitError, 'שגיאה בשמירת ההזמנה'));
    }
  };

  if (ordersLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress color="secondary" />
    </Box>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', mx: 'auto', boxSizing: 'border-box', minWidth: 0 }}>

      <PageHeader
        title="לוח מחוונים"
        description={`שלום, ${user?.fullName || user?.username || 'סוכן מכירות'} — הצעות מחיר, הזמנות, לקוחות והתכתבות עם הצוות.\n${new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
      />

      {/* כרטיסי סטטיסטיקה */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map((stat, i) => (
          <Grid size={{ xs: 6, md: 3 }} key={i}>
            <Box onClick={stat.onClick} sx={{
              bgcolor: dashboardStatColor(i), borderRadius: 3, p: 2.5, height: 140,
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
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{
            borderRadius: 3, p: 2.5, boxShadow: 'none',
            border: `1px solid ${CARD_COLORS[0].border}`,
            bgcolor: CARD_COLORS[0].bg, height: 400,
            display: 'flex', flexDirection: 'column',
          }}>
            <SectionHeader
              emoji={viewMeta[salesView].emoji}
              title={viewMeta[salesView].title}
              titleColor={CARD_COLORS[0].title}
            />
            <Box sx={{ mb: 1.5 }}>
              <Tabs
                value={salesView}
                onChange={(_, val) => setSalesView(val)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  borderBottom: `1px solid ${CARD_COLORS[0].border}`,
                  '& .MuiTab-root': { fontSize: 12.5, fontWeight: 600, minHeight: 42 },
                  '& .Mui-selected': { color: '#D2691E' },
                  '& .MuiTabs-indicator': { bgcolor: '#D2691E' },
                }}
              >
                <Tab value="COLLECTION" label={`לא שולמו (${collectionPendingOrders.length})`} />
                <Tab value="PAID" label={`שולמו (${paidOrders.length})`} />
                <Tab value="QUOTATION" label={`הצעות מחיר (${quotationPendingOrders.length})`} />
              </Tabs>
            </Box>
            <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
              {displayedOrders.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2, fontSize: 12 }}>{viewMeta[salesView].empty}</Alert>
              ) : displayedOrders.map(order => (
                <Box key={order._id} sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  py: 1.2, borderBottom: `1px solid ${CARD_COLORS[0].border}`,
                  cursor: 'pointer',
                }}>
                  <Box onClick={() => setSelectedOrder(order)} sx={{ flex: 1 }}>
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
                    {salesView === 'QUOTATION' ? (
                      <Button
                        size="small"
                        variant="contained"
                        sx={{ bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' }, fontSize: 11 }}
                        onClick={() => handleConfirmQuotation(order._id)}
                      >
                        בצע הזמנה
                      </Button>
                    ) : order.isPaid ? (
                      <Typography sx={{ fontSize: 11, color: '#2E7D32', fontWeight: 700 }}>
                        שולם
                      </Typography>
                    ) : (
                      <IconButton size="small" sx={{ color: '#2E7D32' }} onClick={() => handleMarkAsPaid(order._id)}>
                        <PaidIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* התראות — בדיוק כמו מחסנאי */}
        <Grid size={{ xs: 12, md: 4 }}>
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
            {submitError && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {submitError}
              </Alert>
            )}
            <TextField label="שם לקוח *" fullWidth value={newOrderData.customerName}
              onChange={handleNewOrderChange('customerName')}
              error={!!orderFormErrors.customerName} helperText={orderFormErrors.customerName} />
            <TextField label="טלפון ראשי *" fullWidth value={newOrderData.customerPhone1}
              onChange={handleNewOrderChange('customerPhone1')}
              error={!!orderFormErrors.customerPhone1} helperText={orderFormErrors.customerPhone1} />
            <TextField label="טלפון נוסף" fullWidth value={newOrderData.customerPhone2}
              onChange={handleNewOrderChange('customerPhone2')}
              error={!!orderFormErrors.customerPhone2} helperText={orderFormErrors.customerPhone2} />
            <TextField label="ת.ז" fullWidth value={newOrderData.customerIdNumber}
              onChange={handleNewOrderChange('customerIdNumber')}
              error={!!orderFormErrors.customerIdNumber} helperText={orderFormErrors.customerIdNumber} />
            <TextField label='שם להפקת חשבונית' fullWidth value={newOrderData.invoiceName}
              onChange={handleNewOrderChange('invoiceName')}
              error={!!orderFormErrors.invoiceName} helperText={orderFormErrors.invoiceName} />
            <TextField label="דוא״ל" fullWidth value={newOrderData.customerEmail}
              onChange={handleNewOrderChange('customerEmail')}
              error={!!orderFormErrors.customerEmail} helperText={orderFormErrors.customerEmail} />
            <TextField label="כתובת משלוח *" fullWidth value={newOrderData.deliveryAddress}
              onChange={handleNewOrderChange('deliveryAddress')}
              error={!!orderFormErrors.deliveryAddress} helperText={orderFormErrors.deliveryAddress} />
            <TextField label="תאריך הזמנה *" type="date" fullWidth value={newOrderData.orderDate}
              onChange={handleNewOrderChange('orderDate')} InputLabelProps={{ shrink: true }}
              error={!!orderFormErrors.orderDate} helperText={orderFormErrors.orderDate} />
            <TextField
              label="תאריך אספקה משוער *"
              type="date"
              fullWidth
              value={newOrderData.estimatedDeliveryDate}
              onChange={handleNewOrderChange('estimatedDeliveryDate')}
              InputLabelProps={{ shrink: true }}
              error={!!orderFormErrors.estimatedDeliveryDate}
              helperText={
                orderFormErrors.estimatedDeliveryDate ||
                'משוקלל על פי חישוב אספקה למוצר ספציפי זה'
              }
            />
            <Typography sx={{ fontWeight: 700, mt: 1 }}>פרטי הזמנה</Typography>
            {newOrderData.items.map((item, idx) => {
              const filteredModels = getFilteredModelsByType(item.productType);
              const selectedProduct = getProductById(item.catalogProductId);
              const unitPrice = getUnitPrice(item);
              const lineTotal = getLineTotal(item);
              return (
                <Paper key={idx} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                    <TextField
                      select
                      label="סוג מוצר"
                      value={item.productType}
                      onChange={(e) => handleOrderItemChange(idx, 'productType', e.target.value)}
                      error={!!orderFormErrors[`productType_${idx}`]}
                      helperText={orderFormErrors[`productType_${idx}`] || ''}
                    >
                      {PRODUCT_TYPES.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      label="דגם"
                      value={item.catalogProductId}
                      onChange={(e) => handleOrderItemChange(idx, 'catalogProductId', e.target.value)}
                      error={!!orderFormErrors[`catalogProductId_${idx}`]}
                      helperText={orderFormErrors[`catalogProductId_${idx}`] || ''}
                    >
                      {filteredModels.map((model) => <MenuItem key={model._id} value={model._id}>{model.name}</MenuItem>)}
                    </TextField>
                    {productRequiresFabricSelection(item, selectedProduct) && (
                      <Autocomplete
                        options={getFabricOptionsForItem()}
                        getOptionLabel={(m) => `${m.name}${m.code ? ` (${m.code})` : ''}`}
                        value={fabricMaterials.find((m) => m._id === item.selectedFabric) || null}
                        onChange={(_, val) => handleOrderItemChange(idx, 'selectedFabric', val?._id || '')}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="בחירת בד *"
                            error={!!orderFormErrors[`selectedFabric_${idx}`]}
                            helperText={orderFormErrors[`selectedFabric_${idx}`] || ''}
                          />
                        )}
                        isOptionEqualToValue={(opt, val) => opt._id === val._id}
                      />
                    )}
                    {productRequiresFormicaSelection(item, selectedProduct) && (
                      <Autocomplete
                        options={formicaModels}
                        getOptionLabel={(m) => `${m.name}${m.code ? ` (${m.code})` : ''}`}
                        value={formicaModels.find((m) => m._id === item.selectedFormica) || null}
                        onChange={(_, val) => handleOrderItemChange(idx, 'selectedFormica', val?._id || '')}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="בחירת פורמייקה *"
                            error={!!orderFormErrors[`selectedFormica_${idx}`]}
                            helperText={orderFormErrors[`selectedFormica_${idx}`] || ''}
                          />
                        )}
                        isOptionEqualToValue={(opt, val) => opt._id === val._id}
                      />
                    )}
                    {productRequiresHandleSelection(item, selectedProduct) && (
                      <Autocomplete
                        options={handleMaterials}
                        getOptionLabel={(m) => `${m.name}${m.code ? ` (${m.code})` : ''}`}
                        value={handleMaterials.find((m) => m._id === item.selectedHandle) || null}
                        onChange={(_, val) => handleOrderItemChange(idx, 'selectedHandle', val?._id || '')}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="בחירת ידית *"
                            error={!!orderFormErrors[`selectedHandle_${idx}`]}
                            helperText={orderFormErrors[`selectedHandle_${idx}`] || ''}
                          />
                        )}
                        isOptionEqualToValue={(opt, val) => opt._id === val._id}
                      />
                    )}
                    <TextField
                      label="כמות"
                      type="number"
                      inputProps={{ min: 1 }}
                      value={item.quantity}
                      onChange={(e) => handleOrderItemChange(idx, 'quantity', e.target.value)}
                      error={!!orderFormErrors[`quantity_${idx}`]}
                      helperText={orderFormErrors[`quantity_${idx}`] || ''}
                    />
                    <TextField label="מחיר ליחידה" value={unitPrice ? `₪${unitPrice.toLocaleString()}` : '—'} InputProps={{ readOnly: true }} />
                    <TextField label="מחיר סופי לשורה" value={lineTotal ? `₪${lineTotal.toLocaleString()}` : '—'} InputProps={{ readOnly: true }} />
                    <TextField
                      label="אחריות עד לתאריך"
                      value={newOrderData.orderDate ? new Date(new Date(newOrderData.orderDate).setFullYear(new Date(newOrderData.orderDate).getFullYear() + 1)).toLocaleDateString('he-IL') : '—'}
                      InputProps={{ readOnly: true }}
                    />
                    {newOrderData.items.length > 1 && (
                      <Button color="error" startIcon={<DeleteIcon />} onClick={() => removeOrderItemRow(idx)}>
                        הסר שורה
                      </Button>
                    )}
                  </Box>
                </Paper>
              );
            })}
            <Button variant="outlined" startIcon={<AddIcon />} onClick={addOrderItemRow}>
              הוסף עוד מוצר
            </Button>
            {orderFormErrors.items && <Alert severity="error">{orderFormErrors.items}</Alert>}
            <TextField
              label='מחיר משוקלל כולל מע״מ'
              value={totalWithVat ? `₪${totalWithVat.toLocaleString()}` : '₪0'}
              InputProps={{ readOnly: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenNewOrderDialog(false)}>ביטול</Button>
          <Button
            variant="outlined"
            sx={{ borderColor: '#A0522D', color: '#A0522D' }}
            onClick={() => handleCreateNewOrder('QUOTATION_PENDING')}
            disabled={submitLoading}
          >
            שמור כהצעת מחיר
          </Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#2E7D32' }}
            onClick={() => handleCreateNewOrder('ORDERED')}
            disabled={submitLoading}
          >
            בצע הזמנה
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!selectedOrder} onClose={() => setSelectedOrder(null)} fullWidth maxWidth="sm">
        <DialogTitle>פרטי הזמנה</DialogTitle>
        <DialogContent dividers>
          {selectedOrder && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography><b>לקוח:</b> {selectedOrder.customer?.name || '-'}</Typography>
              <Typography><b>סטטוס:</b> {STATUS_LABEL[selectedOrder.status]?.label || selectedOrder.status}</Typography>
              <Typography><b>שולמה:</b> {selectedOrder.isPaid ? 'כן' : 'לא'}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedOrder(null)}>סגור</Button>
          {selectedOrder && !selectedOrder.isPaid && (
            <Button
              variant="contained"
              sx={{ bgcolor: '#2E7D32' }}
              onClick={async () => {
                await handleMarkAsPaid(selectedOrder._id);
                setSelectedOrder(null);
              }}
            >
              סמן כשולמה
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <style>{`
        @keyframes pulse {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
      `}</style>
      <FeedbackSnackbar />
    </Box>
  );
};

export default SalesDashboard;