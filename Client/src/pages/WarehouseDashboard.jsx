import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';

// MUI Icons
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ChatIcon from '@mui/icons-material/Chat';
import PrintIcon from '@mui/icons-material/Print';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SendIcon from '@mui/icons-material/Send';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';

// MUI Components
import {
  Box, Typography, Grid, Paper, Tabs, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Checkbox,
  Button, Chip, Divider, CircularProgress, Alert, TextField,
  InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, FormControlLabel, Switch, MenuItem, Select,
  FormControl, InputLabel, Snackbar, Collapse, IconButton,
} from '@mui/material';

// Redux - Warehouse
import {
  fetchAllOrders, fetchPurchaseList, fetchAllBaseProducts,
  fetchOrdersWithNewProducts, pickMaterialAction, markReadyForShipping,
  createBaseProductAction, clearCreateStatus,
  updateBaseProductAction, markSupplierSentAction, markSupplierArrivedAction,
} from '../store/slices/warehouseSlice';

// ⚠️ עדכני את הנתיבים הבאים לפי הפרויקט שלך:
import { fetchNotifications, markNotificationRead } from '../store/slices/notificationsSlice';
import { fetchActiveChatPartners } from '../store/slices/chatSlice';
import { useOrderLiveRefresh } from '../hooks/useOrderLiveRefresh';
import { useFeedbackSnackbar } from '../hooks/useFeedbackSnackbar';
import PageHeader from '../components/PageHeader.jsx';
import { dashboardStatColor } from '../utils/dashboardStatPalette.js';

// ─── קבועים ──────────────────────────────────────────────
const C = {
  primary: '#D2691E', dark: '#3E2723', medium: '#A0522D',
  light: '#FBF0E9', border: '#E8C9B0',
};

const STATUS_META = {
  QUOTATION_PENDING:   { label: 'בהצעת מחיר',   color: '#FFD700' },
  ORDERED:               { label: 'הזמנה חדשה',   color: '#D2691E' },
  WAITING_FOR_WAREHOUSE: { label: 'ממתין למחסן',  color: '#E65100' },
  WAITING_FOR_PICKING:   { label: 'ממתין לליקוט', color: '#A0522D' },
  WAITING_FOR_SUPPLY:    { label: 'ממתין לאספקה', color: '#8B0000' },
  READY_FOR_SHIPPING:    { label: 'מוכן למשלוח',  color: '#2E7D32' },
  IN_PROGRESS:           { label: 'בעבודה',        color: '#6D4C41' },
  DONE:                  { label: 'הושלם',         color: '#9E9E9E' },
};

const PURCHASE_STATUS = {
  PENDING:          { label: 'ממתין',     bg: '#FFF8F3', color: '#8D6E63', border: '#E8D5C8' },
  SENT_TO_SUPPLIER: { label: 'נשלח לספק', bg: '#EFEBE9', color: '#5D4037', border: '#D7CCC8' },
  ARRIVED:          { label: 'הגיע ✓',    bg: '#E8F5E9', color: '#4E342E', border: '#C8E6C9' },
};

const EMPTY_FORM = {
  name: '', code: '', unit: '', quantity: 0, minStock: 5,
  reorderQuantity: 20, shelfLocation: '', supplier: '',
  isMaterial: false, materialType: null, priceDelta: 0,
  description: '',
};

// ─── כרטיס סטטיסטיקה ─────────────────────────────────────
const StatCard = ({ title, value, sub, color, icon, onClick }) => (
  <Box onClick={onClick} sx={{
    bgcolor: color, borderRadius: 3, p: 2.5, height: 130,
    cursor: onClick ? 'pointer' : 'default',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    transition: '0.15s',
    '&:hover': onClick ? { transform: 'translateY(-2px)', opacity: 0.92 } : {},
  }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
        {title}
      </Typography>
      <Box sx={{ color: 'rgba(255,255,255,0.7)' }}>{icon}</Box>
    </Box>
    <Box>
      <Typography sx={{ fontSize: 32, fontWeight: 700, color: 'white', lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', mt: 0.4 }}>
        {sub}
      </Typography>
    </Box>
  </Box>
);

/** מזהה מוצר בסיס אחיד (ObjectId / מחרוזת / אובייקט מאוכלס) */
const materialProductIdString = (ref) => {
  if (ref == null) return '';
  if (typeof ref === 'string' || typeof ref === 'number') return String(ref);
  if (typeof ref === 'object') {
    if (ref.$oid != null) return String(ref.$oid);
    const id = ref._id ?? ref.id;
    if (id != null && typeof id === 'object' && id.$oid != null) return String(id.$oid);
    if (id != null) return String(id);
  }
  try {
    const s = String(ref);
    return s === '[object Object]' ? '' : s;
  } catch {
    return '';
  }
};

/** תצוגת תור מחסן: בליקוט אין "חסרים" — מונע תקיעות מול שאריות ב-state */
const orderForWarehouseCard = (o) => {
  if (!o) return o;
  if (o.status === 'WAITING_FOR_PICKING') {
    return { ...o, unavailableMaterials: [] };
  }
  return o;
};

// ─── כרטיס הזמנה ─────────────────────────────────────────
const OrderCard = ({ order, onPick, onReady, newProductIds, forcePrintButton = false }) => {
  const allPicked = order.requiredMaterials?.every(m => m.isPicked);
  const cardTone =
    order.status === 'WAITING_FOR_SUPPLY' ? 'supply'
    : order.status === 'WAITING_FOR_PICKING' ? 'pick'
    : order.status === 'WAITING_FOR_WAREHOUSE' ? 'pending'
    : 'default';

  const tonePaper = {
    supply: { border: '1px solid #FFCDD2', bgcolor: '#FFF5F5' },
    pick: { border: '1px solid #A5D6A7', bgcolor: '#E8F5E9' },
    pending: { border: '1px solid #FFE082', bgcolor: '#FFFDE7' },
    default: { border: '1px solid #E0E0E0', bgcolor: 'white' },
  }[cardTone];

  return (
    <Paper sx={{
      p: 3, borderRadius: 3, mb: 2,
      ...tonePaper,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
            הזמנה #{order._id?.slice(-5)} — {order.customer?.name}
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#A1887F' }}>
            נגר: {order.assignedCarpenter?.fullName || '—'} | {order.customer?.deliveryAddress}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={STATUS_META[order.status]?.label || order.status}
            size="small"
            sx={{ bgcolor: STATUS_META[order.status]?.color, color: 'white', fontWeight: 600 }}
          />
          {(allPicked || forcePrintButton) && (
            <Button
              variant="contained" size="small"
              startIcon={<PrintIcon />}
              onClick={() => onReady(order)}
              sx={{ bgcolor: '#2E7D32', fontSize: 12 }}
            >
              הדפס תווית משלוח
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={1.5}>
        {order.requiredMaterials?.map((mat, i) => {
          const productId = materialProductIdString(mat.product);
          /** חסר במלאי רק בהזמנות ממתין לאספקה, והשורה תואמת לרשימת החסרים */
          const isMissing =
            order.status === 'WAITING_FOR_SUPPLY' &&
            !!productId &&
            (order.unavailableMaterials || []).some(
              (u) => materialProductIdString(u.product) === productId
            );
          /** מוצר חדש: עדיפות לשדה isNew מהמסמך המאוכלס; רשימת newProductIds מהדשבורד עלולה להיות לא מעודכנת ולחסום צ'קבוקס בטעות */
          const newFlagFromDoc = mat.product?.isNew;
          const isNewProduct =
            newFlagFromDoc === true ||
            (newFlagFromDoc !== false && productId && newProductIds.includes(productId));
          const needsWarehouseAck = order.status === 'WAITING_FOR_WAREHOUSE';
          const cannotPickMissing =
            order.status === 'WAITING_FOR_SUPPLY' && isMissing;
          const pickDisabled =
            !productId || mat.isPicked || cannotPickMissing || isNewProduct || needsWarehouseAck;

          return (
            <Grid size={{ xs: 12, sm: 4 }} key={productId || `mat-${i}`}>
              <Box sx={{
                p: 1.5, borderRadius: 2,
                bgcolor: mat.isPicked ? '#F1F8E9'
                  : isNewProduct ? '#FFF3E0'
                  : isMissing    ? '#FFEBEE'
                  : '#F5F5F5',
                display: 'flex', alignItems: 'center', gap: 1,
                border: isNewProduct ? '1px solid #FFB74D' : 'none',
              }}>
                <Checkbox
                  checked={!!mat.isPicked}
                  disabled={pickDisabled}
                  onChange={() => {
                    if (!productId || pickDisabled) return;
                    onPick(order._id, productId);
                  }}
                  size="small"
                  sx={{
                    flexShrink: 0,
                    p: 0.5,
                    color: C.primary,
                    '&.Mui-checked': { color: '#2E7D32' },
                  }}
                  slotProps={{ input: { 'aria-label': `ליקוט ${mat.product?.name || productId}` } }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{
                    fontSize: 12.5, fontWeight: 500,
                    textDecoration: mat.isPicked ? 'line-through' : 'none',
                    color: mat.isPicked ? '#9E9E9E' : 'inherit',
                  }}>
                    {mat.product?.name || 'חומר'} × {mat.quantity}
                  </Typography>
                  {order.status === 'WAITING_FOR_PICKING' && (
                    <Typography sx={{ fontSize: 11, color: '#6D4C41', mt: 0.2 }}>
                      מיקום מדף: {mat.product?.shelfLocation || 'לא הוגדר'}
                    </Typography>
                  )}
                  {isNewProduct && (
                    <Chip
                      icon={<NewReleasesIcon sx={{ fontSize: 12 }} />}
                      label="מוצר חדש! יש לבצע אספקה ראשונית"
                      size="small"
                      sx={{ bgcolor: '#FFE0B2', color: '#E65100', fontSize: 10, height: 20, mt: 0.3 }}
                    />
                  )}
                  {isMissing && !isNewProduct && (
                    <Chip
                      label="חסר במלאי" size="small"
                      sx={{ bgcolor: '#FFCDD2', color: '#C62828', fontSize: 10, height: 18 }}
                    />
                  )}
                </Box>
                {mat.isPicked && <CheckCircleIcon sx={{ fontSize: 16, color: '#2E7D32' }} />}
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
};

// ─── כרטיס ספק ברכש מרוכז ────────────────────────────────
const SupplierPurchaseCard = ({ supplierName, items, onMarkSent, onMarkArrived, loadingSupplier }) => {
  const [expanded, setExpanded] = useState(true);

  const statuses = items.map(i => i.status || 'PENDING');
  const supplierStatus = statuses.every(s => s === 'ARRIVED')
    ? 'ARRIVED'
    : statuses.every(s => s === 'SENT_TO_SUPPLIER' || s === 'ARRIVED')
    ? 'SENT_TO_SUPPLIER'
    : 'PENDING';

  const st = PURCHASE_STATUS[supplierStatus];
  const isLoading = loadingSupplier === supplierName;
  const totalItems = items.reduce((acc, i) => acc + (i.totalQuantityNeeded || 0), 0);

  return (
    <Paper sx={{ mb: 2, borderRadius: 3, border: `1px solid ${st.border}`, overflow: 'hidden' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2.5, py: 1.8, bgcolor: st.bg,
        borderBottom: expanded ? `1px solid ${st.border}` : 'none',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <StorefrontIcon sx={{ color: st.color, fontSize: 22 }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#3E2723' }}>{supplierName}</Typography>
            <Typography sx={{ fontSize: 11, color: '#A1887F' }}>
              {items.length} פריטים | סה"כ {totalItems} יחידות
            </Typography>
          </Box>
          <Chip
            label={st.label} size="small"
            sx={{ bgcolor: 'white', color: st.color, border: `1px solid ${st.border}`, fontWeight: 600, fontSize: 11 }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {supplierStatus === 'PENDING' && (
            <Button
              size="small" variant="contained"
              startIcon={isLoading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <SendIcon sx={{ fontSize: 14 }} />}
              disabled={isLoading}
              onClick={() => onMarkSent(supplierName)}
              sx={{ bgcolor: C.primary, fontSize: 12, fontWeight: 600, borderRadius: 2, '&:hover': { bgcolor: C.medium } }}
            >
              הרשימה נשלחה לטיפול הספק
            </Button>
          )}
          {supplierStatus === 'SENT_TO_SUPPLIER' && (
            <Button
              size="small" variant="contained"
              startIcon={isLoading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <LocalShippingOutlinedIcon sx={{ fontSize: 14 }} />}
              disabled={isLoading}
              onClick={() => onMarkArrived(supplierName)}
              sx={{ bgcolor: '#5D4037', fontSize: 12, fontWeight: 600, borderRadius: 2, '&:hover': { bgcolor: '#3E2723' } }}
            >
              סמן כהגיע
            </Button>
          )}
          {supplierStatus === 'ARRIVED' && (
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: 14, color: '#4E342E' }} />}
              label="הושלם" size="small"
              sx={{ bgcolor: '#E8F5E9', color: '#4E342E', fontWeight: 600, border: '1px solid #C8E6C9' }}
            />
          )}
          <IconButton size="small" onClick={() => setExpanded(p => !p)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#FBF8F5' }}>
              <TableCell sx={{ fontWeight: 600, fontSize: 12, color: '#5D4037' }}>מוצר</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, fontSize: 12, color: '#5D4037' }}>יחידה</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, fontSize: 12, color: '#A0522D' }}>להזמנות</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, fontSize: 12, color: '#6D4C41' }}>למלאי</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, fontSize: 12, color: '#3E2723' }}>סה"כ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, i) => (
              <TableRow key={item._id || i} hover sx={{ '&:last-child td': { border: 0 } }}>
                <TableCell sx={{ fontSize: 13, fontWeight: 500 }}>
                  {item.product?.name || item.name || '—'}
                </TableCell>
                <TableCell align="center" sx={{ fontSize: 12, color: '#A1887F' }}>
                  {item.product?.unit || '—'}
                </TableCell>
                <TableCell align="center">
                  <Chip label={item.forOrders} size="small"
                    sx={{ bgcolor: '#FFF8F0', color: '#A0522D', fontWeight: 700, fontSize: 11, minWidth: 36, border: '1px solid #E8C9B0' }} />
                </TableCell>
                <TableCell align="center">
                  <Chip label={item.forStock} size="small"
                    sx={{ bgcolor: '#EFEBE9', color: '#5D4037', fontWeight: 700, fontSize: 11, minWidth: 36, border: '1px solid #D7CCC8' }} />
                </TableCell>
                <TableCell align="center">
                  <Chip label={item.totalQuantityNeeded} size="small"
                    sx={{ bgcolor: C.primary, color: 'white', fontWeight: 700, fontSize: 12, minWidth: 40 }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Collapse>
    </Paper>
  );
};

// ─── דיאלוג הוספת מוצר בסיס ──────────────────────────────
const AddBaseProductDialog = ({ open, onClose, showError, showSuccess }) => {
  const dispatch = useDispatch();
  const { createLoading, createError, createSuccess } = useSelector(s => s.warehouse);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (createSuccess) {
      setForm(EMPTY_FORM);
      onClose();
      dispatch(clearCreateStatus());
      if (showSuccess) showSuccess('מוצר הבסיס נוסף למחסן בהצלחה');
    }
  }, [createSuccess, dispatch, onClose, showSuccess]);

  useEffect(() => {
    if (createError && showError) showError(createError);
  }, [createError, showError]);

  const handleChange = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = () => {
    if (!form.name?.trim()) {
      showError?.('יש להזין שם מוצר');
      return;
    }
    if (!form.unit?.trim()) {
      showError?.('יש להזין יחידת מידה');
      return;
    }
    dispatch(createBaseProductAction({
      ...form,
      quantity:        Number(form.quantity),
      minStock:        Number(form.minStock),
      reorderQuantity: Number(form.reorderQuantity),
      priceDelta:      Number(form.priceDelta),
      materialType:    form.isMaterial && form.materialType ? form.materialType : undefined,
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: C.dark }}>➕ הוספת מוצר בסיס חדש למחסן</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="שם המוצר *" value={form.name} onChange={handleChange('name')} />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField fullWidth size="small" label="יחידת מידה *" value={form.unit} onChange={handleChange('unit')} placeholder='מ"ר, יח׳, מ"ל' />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField fullWidth size="small" label="כמות ראשונית" type="number" value={form.quantity} onChange={handleChange('quantity')} />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField fullWidth size="small" label="מינימום מלאי" type="number" value={form.minStock} onChange={handleChange('minStock')} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField fullWidth size="small" label="מיקום מדף" value={form.shelfLocation} onChange={handleChange('shelfLocation')} placeholder="A1, B3..." />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField fullWidth size="small" label="ספק" value={form.supplier} onChange={handleChange('supplier')} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="תיאור" multiline rows={2} value={form.description} onChange={handleChange('description')} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={<Switch checked={form.isMaterial} onChange={handleChange('isMaterial')} sx={{ '& .MuiSwitch-thumb': { bgcolor: C.primary } }} />}
              label="משמש כחומר לבחירה (עץ/בד)"
            />
          </Grid>
          {form.isMaterial && (
            <>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>סוג חומר</InputLabel>
                  <Select value={form.materialType || ''} onChange={handleChange('materialType')} label="סוג חומר">
                    <MenuItem value="wood">עץ</MenuItem>
                    <MenuItem value="fabric">בד</MenuItem>
                    <MenuItem value="handle">ידית</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth size="small" label="תוספת מחיר (₪)" type="number" value={form.priceDelta} onChange={handleChange('priceDelta')} />
              </Grid>
            </>
          )}
          {createError && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="error">{createError}</Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ color: '#9E9E9E' }}>ביטול</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={createLoading || !form.name || !form.unit} sx={{ bgcolor: C.primary }}>
          {createLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'הוסף מוצר'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── דיאלוג עריכת מוצר בסיס ──────────────────────────────
const EditBaseProductDialog = ({ open, product, onClose, onSaved, showError, showSuccess }) => {
  const dispatch = useDispatch();
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (product) {
      setForm({
        name:            product.name            || '',
        code:            product.code            || '',
        unit:            product.unit            || '',
        quantity:        product.quantity        ?? 0,
        minStock:        product.minStock        ?? 5,
        reorderQuantity: product.reorderQuantity ?? 20,
        shelfLocation:   product.shelfLocation   || '',
        supplier:        product.supplier        || '',
        isMaterial:      product.isMaterial      || false,
        materialType:    product.materialType    || null,
        priceDelta:      product.priceDelta      ?? 0,
        description:     product.description     || '',
      });
      setError('');
    }
  }, [product]);

  const handleChange = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) {
      showError?.('יש להזין שם מוצר');
      return;
    }
    if (!form.unit?.trim()) {
      showError?.('יש להזין יחידת מידה');
      return;
    }
    if (product?.isNew && (!String(form.supplier || '').trim() || Number(form.quantity) < 0)) {
      const msg = 'למוצר חדש חובה להזין ספק וכמות התחלתית תקינה לפני אישור';
      setError(msg);
      showError?.(msg);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await dispatch(updateBaseProductAction({
        baseProductId: product._id,
        data: {
          ...form,
          quantity:        Number(form.quantity),
          minStock:        Number(form.minStock),
          reorderQuantity: Number(form.reorderQuantity),
          priceDelta:      Number(form.priceDelta),
          materialType:    form.isMaterial && form.materialType ? form.materialType : undefined,
          confirmNewProduct: !!product?.isNew,
        },
      })).unwrap();
      showSuccess?.('המוצר עודכן בהצלחה');
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err || 'שגיאה בעדכון המוצר';
      setError(msg);
      showError?.(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: C.dark, display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditIcon sx={{ color: C.primary }} />
        {product.isNew ? 'אישור מוצר חדש והכנסה למלאי' : `עריכת מוצר: ${product.name}`}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 8 }}>
            <TextField fullWidth size="small" label="שם המוצר *" value={form.name} onChange={handleChange('name')} />
          </Grid>
          <Grid size={{ xs: 4 }} />
          <Grid size={{ xs: 4 }}>
            <TextField fullWidth size="small" label="יחידת מידה *" value={form.unit} onChange={handleChange('unit')} />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField
              fullWidth
              size="small"
              label={product?.isNew ? "כמות להזמנה ראשונית" : "כמות במלאי"}
              type="number"
              value={form.quantity}
              onChange={handleChange('quantity')}
            />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField fullWidth size="small" label="מינימום מלאי" type="number" value={form.minStock} onChange={handleChange('minStock')} />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField fullWidth size="small" label="כמות הזמנה חוזרת" type="number" value={form.reorderQuantity} onChange={handleChange('reorderQuantity')} />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField fullWidth size="small" label="מיקום מדף" value={form.shelfLocation} onChange={handleChange('shelfLocation')} placeholder="A1, B3..." />
          </Grid>
          <Grid size={{ xs: 4 }}>
            <TextField fullWidth size="small" label="ספק" value={form.supplier} onChange={handleChange('supplier')} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="תיאור" multiline rows={3} value={form.description} onChange={handleChange('description')} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={<Switch checked={form.isMaterial} onChange={handleChange('isMaterial')} sx={{ '& .MuiSwitch-thumb': { bgcolor: C.primary } }} />}
              label="משמש כחומר לבחירה (עץ/בד)"
            />
          </Grid>
          {form.isMaterial && (
            <>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>סוג חומר</InputLabel>
                  <Select value={form.materialType || ''} onChange={handleChange('materialType')} label="סוג חומר">
                    <MenuItem value="wood">עץ</MenuItem>
                    <MenuItem value="fabric">בד</MenuItem>
                    <MenuItem value="handle">ידית</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth size="small" label="תוספת מחיר (₪)" type="number" value={form.priceDelta} onChange={handleChange('priceDelta')} />
              </Grid>
            </>
          )}
          {error && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="error">{error}</Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ color: '#9E9E9E' }}>ביטול</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving || !form.name || !form.unit} sx={{ bgcolor: C.primary }}>
          {saving
            ? <CircularProgress size={20} sx={{ color: 'white' }} />
            : (product?.isNew ? 'אשר והכנס לרכש' : 'שמור שינויים')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── דשבורד ראשי ─────────────────────────────────────────
const WarehouseDashboard = () => {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { showSuccess, showError, FeedbackSnackbar } = useFeedbackSnackbar();

  const [tab, setTab]                         = useState(0);
  const [search, setSearch]                   = useState('');
  const [addDialogOpen, setAddDialogOpen]     = useState(false);
  const [editProduct, setEditProduct]         = useState(null);
  const [loadingSupplier, setLoadingSupplier] = useState(null);

  useEffect(() => {
    if (location.state?.tab !== undefined) {
      setTab(location.state.tab);
    }
  }, [location.state]);

  const { user } = useSelector(s => s.auth);
  const { orders, baseProducts, purchaseList, ordersWithNewProducts, loading } = useSelector(s => s.warehouse);
  const { notifications } = useSelector(s => s.notifications);
  const chatState = useSelector(s => s.chat);

  const totalUnreadChatCount =
    chatState?.activeChatPartners?.reduce((acc, p) => acc + (Number(p.unreadCount) || 0), 0) || 0;

  const newProductIds = (baseProducts || []).filter(p => p.isNew).map(p => p._id?.toString());

  useEffect(() => {
    dispatch(fetchActiveChatPartners());
    dispatch(fetchNotifications());
    dispatch(fetchAllOrders());
    dispatch(fetchPurchaseList());
    dispatch(fetchAllBaseProducts());
    dispatch(fetchOrdersWithNewProducts());
  }, [dispatch]);

  const refreshWarehouseData = useCallback(() => {
    dispatch(fetchAllOrders());
    dispatch(fetchPurchaseList());
    dispatch(fetchOrdersWithNewProducts());
  }, [dispatch]);

  useOrderLiveRefresh(refreshWarehouseData);

  const handlePick = async (orderId, materialId) => {
    try {
      const updatedOrder = await dispatch(
        pickMaterialAction({ orderId, materialId, warehouseUserId: user?.id || user?._id })
      ).unwrap();
      dispatch(fetchAllOrders());
      const allPicked = (updatedOrder?.requiredMaterials || []).every((m) => !!m.isPicked);
      if (allPicked) {
        printShippingLabel(updatedOrder);
        showSuccess("כל החומרים נלקטו — נפתחה תווית להדפסה");
      }
    } catch (e) {
      const msg = typeof e === "string" ? e : e?.message || "שגיאה בסימון ליקוט";
      showError(msg);
    }
  };

  const printShippingLabel = (order) => {
    const carpenterName = order?.assignedCarpenter?.fullName || 'לא משויך';
    const carpenterAddress = order?.assignedCarpenter?.address || 'לא הוגדרה כתובת לנגר';
    const carpenterPhone = order?.assignedCarpenter?.phone || '—';
    const customerName = order?.customer?.name || '—';
    const customerAddress = order?.customer?.deliveryAddress || '—';
    const customerPhone = order?.customer?.phone1 || '—';
    const orderCode = order?._id ? `#${order._id.slice(-6)}` : '—';
    const printDate = new Date().toLocaleString('he-IL');

    const labelHtml = `
      <html dir="rtl" lang="he">
        <head>
          <title>תווית משלוח ${orderCode}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #222; }
            .label { border: 2px dashed #444; border-radius: 8px; padding: 16px; max-width: 560px; }
            .title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
            .meta { font-size: 12px; color: #666; margin-bottom: 12px; }
            .section { margin-top: 10px; }
            .section-title { font-weight: 700; margin-bottom: 4px; }
            .line { margin: 2px 0; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="title">תווית משלוח להזמנה ${orderCode}</div>
            <div class="meta">הודפס בתאריך: ${printDate}</div>

            <div class="section">
              <div class="section-title">מסלול הובלה</div>
              <div class="line">מוצא: מחסן ראשי</div>
              <div class="line">יעד: נגר — ${carpenterName}</div>
              <div class="line">כתובת יעד: ${carpenterAddress}</div>
            </div>

            <div class="section">
              <div class="section-title">פרטי לקוח</div>
              <div class="line">לקוח: ${customerName}</div>
              <div class="line">כתובת לקוח: ${customerAddress}</div>
              <div class="line">טלפון לקוח: ${customerPhone}</div>
            </div>

            <div class="section">
              <div class="section-title">נגר משויך</div>
              <div class="line">שם: ${carpenterName}</div>
              <div class="line">כתובת: ${carpenterAddress}</div>
              <div class="line">טלפון: ${carpenterPhone}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=720,height=900');
    if (!printWindow) {
      showError("הדפדפן חסם חלון הדפסה. אפשרי חלונות קופצים ונסי שוב.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(labelHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleReady = (order) => {
    if (!order?._id) return;
    printShippingLabel(order);
    dispatch(markReadyForShipping(order._id));
  };

  const handleMarkSent = async (supplierName) => {
    setLoadingSupplier(supplierName);
    try {
      await dispatch(markSupplierSentAction(supplierName)).unwrap();
      await dispatch(fetchPurchaseList({ silent: true })).unwrap();
      showSuccess(`הרשימה נשלחה לספק "${supplierName}"`);
    } catch {
      showError("שגיאה בשליחה לספק");
    } finally {
      setLoadingSupplier(null);
    }
  };

  const handleMarkArrived = async (supplierName) => {
    setLoadingSupplier(supplierName);
    try {
      await dispatch(markSupplierArrivedAction(supplierName)).unwrap();
      await dispatch(fetchPurchaseList({ silent: true })).unwrap();
      showSuccess(`סחורה מ"${supplierName}" עודכנה במלאי`);
      dispatch(fetchAllBaseProducts());
      dispatch(fetchAllOrders());
      dispatch(fetchOrdersWithNewProducts());
    } catch {
      showError("שגיאה בעדכון הגעה");
    } finally {
      setLoadingSupplier(null);
    }
  };

  const purchaseBySupplier = (purchaseList || []).reduce((acc, item) => {
    const key = item.supplierName || item.product?.supplier || 'ללא ספק';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const supplierNames = Object.keys(purchaseBySupplier).sort((a, b) => {
    if (a === 'ללא ספק') return 1;
    if (b === 'ללא ספק') return -1;
    return a.localeCompare(b, 'he');
  });

  const pickingOrders = (orders || []).filter(o => o.status === 'WAITING_FOR_PICKING');
  const supplyOrders  = (orders || []).filter(o => o.status === 'WAITING_FOR_SUPPLY');
  const pendingWarehouseOrders = (orders || []).filter(o => o.status === 'WAITING_FOR_WAREHOUSE');

  const warehouseQueueStatuses = ['WAITING_FOR_SUPPLY', 'WAITING_FOR_PICKING', 'WAITING_FOR_WAREHOUSE'];
  const allWarehouseQueueOrders = (orders || [])
    .filter(o => warehouseQueueStatuses.includes(o.status))
    .sort((a, b) => {
      const rank = (s) => (s === 'WAITING_FOR_SUPPLY' ? 0 : s === 'WAITING_FOR_PICKING' ? 1 : 2);
      const d = rank(a.status) - rank(b.status);
      if (d !== 0) return d;
      return new Date(b.orderDate || 0) - new Date(a.orderDate || 0);
    });

  /** אחריות מחסן נגמרת כשהחבילה יוצאת לנגר — לא מציגים שלב נגר→לקוח או הזמנות שכבר נמסרו לנגר */
  const readyOrders = (orders || []).filter(
    (o) =>
      o.status === 'READY_FOR_SHIPPING' &&
      !o.carpenterCompletedAt &&
      !o.driverMarkedDeliveredToCarpenterAt &&
      !o.receivedByCarpenter
  );
  const unreadNotif   = (notifications || []).filter(n => !n.isRead && n.type !== 'CHAT').length;

  const filteredStock = (baseProducts || []).filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.shelfLocation?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    {
      title: 'הזמנות הממתינות לליקוט', value: pickingOrders.length,
      sub: pendingWarehouseOrders.length > 0
        ? `${pendingWarehouseOrders.length} הזמנות ישנות ללא סיווג — בטאב "כל ההזמנות"`
        : 'מוכנות לאיסוף (הכל במלאי)',
      icon: <HourglassEmptyIcon sx={{ fontSize: 24 }} />,
      onClick: () => setTab(0),
    },
    {
      title: 'הזמנות הממתינות לאספקה', value: supplyOrders.length,
      sub: 'חסרים במלאי',
      icon: <WarningAmberIcon sx={{ fontSize: 24 }} />,
      onClick: () => setTab(1),
    },
    {
      title: 'ממתינות למוביל', value: readyOrders.length,
      sub: 'מוכנות לאיסוף — עדיין לא אצל הנגר',
      icon: <LocalShippingIcon sx={{ fontSize: 24 }} />,
      onClick: () => setTab(4),
    },
    {
      title: "צ'אט והתראות",
      value: unreadNotif + totalUnreadChatCount,
      sub: totalUnreadChatCount > 0 ? `${totalUnreadChatCount} הודעות צ'אט` : 'אין חדש',
      icon: <ChatIcon sx={{ fontSize: 24 }} />,
      onClick: () => setTab(6),
    },
  ];

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
      <CircularProgress color="secondary" />
    </Box>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', mx: 'auto', boxSizing: 'border-box', minWidth: 0 }}>
      <PageHeader
        title="לוח מחוונים"
        description={`שלום, ${user?.fullName || user?.username || 'מחסנאי'} — תורים, ליקוט, אספקה, הובלות ומלאי.\n${new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
      />

      {(ordersWithNewProducts || []).length > 0 && (
        <Alert
          severity="warning" icon={<NewReleasesIcon />}
          sx={{ mb: 2, fontWeight: 600, cursor: 'pointer' }}
          onClick={() => setTab(5)}
        >
          יש {ordersWithNewProducts.length} הזמנות עם מוצרי בסיס חדשים שדורשים אספקה ראשונית — לחץ לצפייה במלאי
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3, justifyContent: 'center' }}>
        {stats.map((s, i) => (
          <Grid size={{ xs: 6, md: 3 }} key={i}>
            <StatCard {...s} color={dashboardStatColor(i)} />
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ borderRadius: 3, border: `1px solid ${C.border}` }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            borderBottom: `1px solid ${C.border}`,
            '& .MuiTab-root': { fontSize: 13, fontWeight: 600 },
            '& .Mui-selected': { color: C.primary },
            '& .MuiTabs-indicator': { bgcolor: C.primary },
          }}
        >
          <Tab label={`📦 הזמנות הממתינות לליקוט (${pickingOrders.length})`} />
          <Tab label={`⚠️ הזמנות הממתינות לאספקה (${supplyOrders.length})`} />
          <Tab label={`📋 כל ההזמנות (${allWarehouseQueueOrders.length})`} />
          <Tab label={`🛒 רכש מרוכז${supplierNames.length > 0 ? ` (${supplierNames.length})` : ''}`} />
          <Tab label={`🚚 ממתינות למוביל (${readyOrders.length})`} />
          <Tab
            label={`📊 מלאי${
              newProductIds.length > 0
                ? ` (${newProductIds.length} ${
                    newProductIds.length === 1 ? "חדש טעון אספקה" : "חדשים טעוני אספקה"
                  })`
                : ""
            }`}
          />
          <Tab label={`💬 צ'אט${totalUnreadChatCount > 0 ? ` (${totalUnreadChatCount})` : ''}`} />
        </Tabs>

        <Box sx={{ p: 2.5 }}>

          {tab === 0 && (
            <Box>
              {pickingOrders.length === 0
                ? <Alert severity="success">אין הזמנות הממתינות לליקוט 🎉</Alert>
                : pickingOrders.map(o => (
                    <OrderCard key={o._id} order={orderForWarehouseCard(o)} onPick={handlePick} onReady={handleReady} newProductIds={newProductIds} />
                  ))
              }
            </Box>
          )}

          {tab === 1 && (
            <Box>
              {supplyOrders.length === 0
                ? <Alert severity="info">אין חוסרים כרגע ✅</Alert>
                : supplyOrders.map(o => (
                    <OrderCard key={o._id} order={orderForWarehouseCard(o)} onPick={handlePick} onReady={handleReady} newProductIds={newProductIds} />
                  ))
              }
            </Box>
          )}

          {tab === 2 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                רקע ירוק — כל החומרים זמינים לליקוט. רקע אדום — חסר במלאי (הזמנות הממתינות לאספקה).
                {pendingWarehouseOrders.length > 0 && (
                  <> רקע צהוב — סטטוס ישן &quot;ממתין למחסן&quot; (לפני סיווג אוטומטי).</>
                )}
              </Alert>
              {allWarehouseQueueOrders.length === 0
                ? <Alert severity="success">אין הזמנות בתור המחסן 🎉</Alert>
                : allWarehouseQueueOrders.map(o => (
                    <OrderCard key={o._id} order={orderForWarehouseCard(o)} onPick={handlePick} onReady={handleReady} newProductIds={newProductIds} />
                  ))
              }
            </Box>
          )}

          {tab === 3 && (
            <Box>
              {supplierNames.length > 0 && (
                <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FFF8F3', border: `1px solid ${C.border}`, minWidth: 120 }}>
                    <Typography sx={{ fontSize: 11, color: '#A1887F' }}>ספקים פעילים</Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#6D4C41' }}>{supplierNames.length}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FBF0E9', border: `1px solid ${C.border}`, minWidth: 120 }}>
                    <Typography sx={{ fontSize: 11, color: '#A1887F' }}>סה"כ פריטים</Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 700, color: C.primary }}>{(purchaseList || []).length}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#EFEBE9', border: '1px solid #D7CCC8', minWidth: 120 }}>
                    <Typography sx={{ fontSize: 11, color: '#A1887F' }}>נשלח לטיפול הספק</Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#5D4037' }}>
                      {supplierNames.filter(name => purchaseBySupplier[name].every(i => i.status === 'SENT_TO_SUPPLIER' || i.status === 'ARRIVED')).length}
                    </Typography>
                  </Box>
                </Box>
              )}
              {supplierNames.length === 0
                ? <Alert severity="success">אין פריטים לרכישה כרגע 🎉</Alert>
                : supplierNames.map(supplierName => (
                    <SupplierPurchaseCard
                      key={supplierName}
                      supplierName={supplierName}
                      items={purchaseBySupplier[supplierName]}
                      onMarkSent={handleMarkSent}
                      onMarkArrived={handleMarkArrived}
                      loadingSupplier={loadingSupplier}
                    />
                  ))
              }
            </Box>
          )}

          {tab === 4 && (
            <Box>
              {readyOrders.length === 0
                ? <Alert severity="success">אין כרגע הזמנות שממתינות למוביל 🎉</Alert>
                : readyOrders.map(o => (
                    <OrderCard
                      key={o._id}
                      order={orderForWarehouseCard(o)}
                      onPick={handlePick}
                      onReady={handleReady}
                      newProductIds={newProductIds}
                      forcePrintButton
                    />
                  ))
              }
            </Box>
          )}

          {tab === 5 && (
            <Box>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="חפש מוצר או מיקום מדף..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start"><SearchIcon /></InputAdornment>
                      ),
                    },
                  }}
                  sx={{ width: 300 }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="outlined" size="small" color="primary" onClick={() => setAddDialogOpen(true)}>
                    הוסף מוצר בסיס
                  </Button>
                  <Typography sx={{ fontSize: 12, color: '#A1887F' }}>
                  מציג {filteredStock.length} מוצרים
                  {newProductIds.length > 0 && (
                    <Chip label={`${newProductIds.length} חדשים`} size="small"
                      sx={{ ml: 1, bgcolor: '#FFE0B2', color: '#E65100', fontSize: 10 }} />
                  )}
                </Typography>
                </Box>
              </Box>

              <TableContainer
                component={Paper}
                sx={{ borderRadius: 3, overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}
              >
                <Table size="small" sx={{ minWidth: 900 }}>
                  <TableHead sx={{ bgcolor: '#EEEEEE' }}>
                    <TableRow>
                      <TableCell><b>מוצר בסיס</b></TableCell>
                      <TableCell align="center"><b>ספק</b></TableCell>
                      <TableCell align="center"><b>מיקום מדף</b></TableCell>
                      <TableCell align="center"><b>במלאי</b></TableCell>
                      <TableCell align="center"><b>משוריין</b></TableCell>
                      <TableCell align="center"><b>זמין</b></TableCell>
                      <TableCell align="center"><b>סטטוס</b></TableCell>
                      <TableCell align="center"><b>פעולה</b></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredStock.map(product => {
                      const available = product.quantity - (product.reservedQuantity || 0);
                      const isLow     = available <= product.minStock;
                      const isNew     = product.isNew;

                      return (
                        <TableRow
                          key={product._id} hover
                          sx={{ bgcolor: isNew ? '#FFF8E1' : 'inherit', cursor: 'pointer' }}
                          onClick={() => setEditProduct(product)}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box>
                                <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{product.name}</Typography>
                                <Typography sx={{ fontSize: 11, color: '#A1887F' }}>
                                  {product.code || product._id?.slice(-6)}
                                </Typography>
                              </Box>
                              {isNew && (
                                <Chip label="חדש" size="small"
                                  sx={{ bgcolor: '#FFE0B2', color: '#E65100', fontWeight: 700, fontSize: 10 }} />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Typography sx={{ fontSize: 12, color: '#5D4037' }}>{product.supplier || '—'}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <LocationOnIcon fontSize="small" sx={{ color: C.primary }} />
                              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{product.shelfLocation || '—'}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">{product.quantity} {product.unit}</TableCell>
                          <TableCell align="center" sx={{ color: '#A1887F' }}>{product.reservedQuantity || 0}</TableCell>
                          <TableCell align="center">
                            <Typography sx={{ fontWeight: 700, color: isLow ? '#D32F2F' : '#2E7D32' }}>
                              {available} {product.unit}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={isNew ? 'אספקה ראשונית' : isLow ? 'מלאי נמוך' : 'תקין'}
                              size="small"
                              color={isNew ? 'warning' : isLow ? 'error' : 'success'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center" onClick={e => e.stopPropagation()}>
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              <Button
                                size="small" variant="outlined"
                                startIcon={<EditIcon sx={{ fontSize: 13 }} />}
                                onClick={() => setEditProduct(product)}
                                sx={{ fontSize: 11, color: C.primary, borderColor: C.primary }}
                              >
                                עריכה
                              </Button>
                              {isNew && (
                                <Button
                                  size="small" variant="outlined"
                                  onClick={() => setEditProduct(product)}
                                  sx={{ fontSize: 11, color: '#E65100', borderColor: '#E65100' }}
                                >
                                  עדכן מוצר במלאי
                                </Button>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {tab === 6 && (
            <Box>
              {totalUnreadChatCount > 0 && (
                <Box
                  onClick={() => navigate('/chat')}
                  sx={{
                    mb: 2, p: 2, borderRadius: 2,
                    bgcolor: C.primary, color: 'white',
                    display: 'flex', alignItems: 'center', gap: 2,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(210,105,30,0.3)',
                    animation: 'pulse 2s infinite',
                  }}
                >
                  <ChatIcon />
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>הודעות צ'אט חדשות!</Typography>
                    <Typography sx={{ fontSize: 12, opacity: 0.9 }}>
                      יש לך {totalUnreadChatCount} הודעות שמחכות לך
                    </Typography>
                  </Box>
                </Box>
              )}

              {(notifications || []).filter(n => !n.isRead && n.type !== 'CHAT').length === 0 && totalUnreadChatCount === 0
                ? <Alert severity="info">אין התראות חדשות</Alert>
                : (notifications || [])
                    .filter(n => !n.isRead && n.type !== 'CHAT')
                    .map(n => (
                      <Box
                        key={n._id || n.id}
                        sx={{ display: 'flex', justifyContent: 'space-between', py: 1.2, borderBottom: `1px solid ${C.border}` }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>{n.message || n.text}</Typography>
                          <Typography sx={{ fontSize: 10, color: '#A1887F' }}>
                            {new Date(n.createdAt).toLocaleString('he-IL')}
                          </Typography>
                        </Box>
                        <Button
                          size="small" sx={{ minWidth: 0, color: C.primary }}
                          onClick={() => dispatch(markNotificationRead(n._id || n.id))}
                        >
                          ✓
                        </Button>
                      </Box>
                    ))
              }
            </Box>
          )}

        </Box>
      </Paper>

      <AddBaseProductDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        showError={showError}
        showSuccess={showSuccess}
      />

      <EditBaseProductDialog
        open={!!editProduct}
        product={editProduct}
        onClose={() => setEditProduct(null)}
        showError={showError}
        showSuccess={showSuccess}
        onSaved={() => {
          dispatch(fetchPurchaseList());
          dispatch(fetchAllBaseProducts());
        }}
      />

      <FeedbackSnackbar />

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

export default WarehouseDashboard;