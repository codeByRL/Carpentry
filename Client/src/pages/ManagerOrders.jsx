// src/pages/ManagerOrders.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, CircularProgress, Alert, Avatar, Grid,
  InputAdornment, ToggleButton, ToggleButtonGroup, Tooltip, Divider
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { fetchAllOrders } from '../store/slices/ordersSlice';

const STATUS_LABELS = {
  QUOTATION_PENDING: { label: 'בהצעת מחיר', color: 'warning' },
  ORDERED: { label: 'הזמנה חדשה', color: 'default' },
  WAITING_FOR_WAREHOUSE: { label: 'ממתין למחסן', color: 'info' },
  WAITING_FOR_PICKING: { label: 'ממתין לליקוט', color: 'primary' },
  WAITING_FOR_SUPPLY: { label: 'ממתין לאספקה', color: 'warning' },
  READY_FOR_SHIPPING: { label: 'מוכן למשלוח', color: 'secondary' },
  IN_PROGRESS: { label: 'בביצוע', color: 'success' },
  DONE: { label: 'הושלם', color: 'success' },
};

const ManagerOrders = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { orders, loading, error } = useSelector(state => state.orders);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [emptyText, setEmptyText] = useState('אין הזמנות להצגה');

  useEffect(() => {
    dispatch(fetchAllOrders());
  }, [dispatch]);

  useEffect(() => {
    const initial = location.state?.initialStatusFilter;
    const msg = location.state?.emptyText;
    if (initial) setStatusFilter(initial);
    if (msg) setEmptyText(msg);
  }, [location.state]);

  const now = new Date();

  const activeOrders = orders.filter(order => order.status !== 'DONE');

  const pausedByIssueCount = activeOrders.filter(o => o.carpenterPaused).length;

  const filtered = activeOrders.filter(order => {
    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'CARPENTER_PAUSED' ? order.carpenterPaused : order.status === statusFilter);
    const matchSearch =
      order.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      order.customer?.phone1?.includes(search) ||
      order._id?.includes(search);
    return matchStatus && matchSearch;
  });

  const isDeliveryUrgent = (order) => {
    if (!order.estimatedDeliveryDate || order.status === 'DONE') return false;
    const diffDays = (new Date(order.estimatedDeliveryDate) - now) / (1000 * 60 * 60 * 24);
    return diffDays <= 2;
  };

  const handleView = (order) => {
    setSelectedOrder(order);
    setViewOpen(true);
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', color: '#5D4037' }}>
        📋 הזמנות פעילות
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ─── חיפוש ───────────────────────── */}
      <TextField
        placeholder="חיפוש לפי שם לקוח / טלפון / מזהה הזמנה..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
      />

      {/* ─── פילטר סטטוס ─────────────────── */}
      <Box sx={{ mb: 3, overflowX: 'auto' }}>
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, val) => val && setStatusFilter(val)}
          size="small"
        >
          <ToggleButton value="ALL">הכל ({activeOrders.length})</ToggleButton>
          <ToggleButton value="CARPENTER_PAUSED">
            <Chip
              label={pausedByIssueCount}
              size="small"
              color="error"
              sx={{ mr: 0.5, height: 18, fontSize: 11 }}
            />
            מושהות בשל תקלה
          </ToggleButton>
          {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => {
            const count = activeOrders.filter(o => o.status === key).length;
            return (
              <ToggleButton key={key} value={key}>
                <Chip label={count} size="small" color={color} sx={{ mr: 0.5, height: 18, fontSize: 11 }} />
                {label}
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>
      </Box>

      {/* ─── טבלה ────────────────────────── */}
      {filtered.length === 0 ? (
        <Alert severity="info">{emptyText}</Alert>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            borderRadius: 3,
            boxShadow: 2,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            maxWidth: '100%',
          }}
        >
          <Table size="small" sx={{ minWidth: 920 }}>
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>לקוח</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>טלפון</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>מוצרים</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>נגר משויך</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>סטטוס</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>מחיר כולל מע"מ</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>תאריך הזמנה</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>אספקה משוערת</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>פעולות</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(order => (
                <TableRow
                  key={order._id}
                  hover
                  sx={{
                    bgcolor: isDeliveryUrgent(order) ? '#FFEBEE' : 'inherit',
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isDeliveryUrgent(order) && (
                        <Tooltip title="אספקה משוערת קרובה (עד יומיים)">
                          <WarningAmberIcon color="error" fontSize="small" />
                        </Tooltip>
                      )}
                      <Avatar sx={{ width: 30, height: 30, bgcolor: '#5D4037', fontSize: 13 }}>
                        {order.customer?.name?.[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {order.customer?.name}
                        </Typography>
                        {order.customer?.invoiceName && (
                          <Typography variant="caption" color="text.secondary">
                            {order.customer.invoiceName}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{order.customer?.phone1}</Typography>
                    {order.customer?.phone2 && (
                      <Typography variant="caption" color="text.secondary">
                        {order.customer.phone2}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    {order.items?.map((item, i) => (
                      <Chip
                        key={i}
                        label={`${item.catalogProduct?.name || 'מוצר'} x${item.quantity}`}
                        size="small"
                        sx={{ m: 0.3 }}
                      />
                    ))}
                  </TableCell>

                  <TableCell>
                    {order.assignedCarpenter ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 26, height: 26, bgcolor: '#795548', fontSize: 12 }}>
                          {order.assignedCarpenter?.fullName?.[0]}
                        </Avatar>
                        <Typography variant="body2">
                          {order.assignedCarpenter?.fullName}
                        </Typography>
                      </Box>
                    ) : (
                      <Chip label="לא שויך" size="small" color="default" />
                    )}
                  </TableCell>

                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                      <Chip
                        label={STATUS_LABELS[order.status]?.label || order.status}
                        color={STATUS_LABELS[order.status]?.color || 'default'}
                        size="small"
                      />
                      {order.carpenterPaused && (
                        <Chip label="מושהה בשל תקלה" size="small" color="error" variant="outlined" />
                      )}
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Typography sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                      ₪{order.priceWithVAT?.toFixed(2) || '—'}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    {order.orderDate
                      ? new Date(order.orderDate).toLocaleDateString('he-IL')
                      : '—'}
                  </TableCell>

                  <TableCell>
                    <Typography sx={{ color: isDeliveryUrgent(order) ? '#C62828' : 'inherit', fontWeight: isDeliveryUrgent(order) ? 700 : 400 }}>
                      {order.estimatedDeliveryDate
                        ? new Date(order.estimatedDeliveryDate).toLocaleDateString('he-IL')
                        : '—'}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleView(order)}
                    >
                      פרטים
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ─── Dialog פרטי הזמנה ─────────────── */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
          פרטי הזמנה — {selectedOrder?.customer?.name}
          {selectedOrder && (
            <Chip
              label={STATUS_LABELS[selectedOrder.status]?.label}
              color={STATUS_LABELS[selectedOrder.status]?.color}
              size="small"
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>

        <DialogContent sx={{ mt: 2 }}>
          {selectedOrder && (
            <Grid container spacing={3}>
              {selectedOrder.carpenterPaused && (
                <Grid item xs={12}>
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                      העבודה מושהית אצל הנגר בשל תקלה
                    </Typography>
                    <Typography variant="body2">
                      {selectedOrder.carpenterPauseReason?.trim()
                        ? `סיבה: ${selectedOrder.carpenterPauseReason}`
                        : 'לא צוינה סיבה'}
                    </Typography>
                  </Alert>
                </Grid>
              )}

              {/* פרטי לקוח */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>👤 פרטי לקוח</Typography>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="body2"><b>שם:</b> {selectedOrder.customer?.name}</Typography>
                  <Typography variant="body2"><b>טלפון 1:</b> {selectedOrder.customer?.phone1}</Typography>
                  {selectedOrder.customer?.phone2 && (
                    <Typography variant="body2"><b>טלפון 2:</b> {selectedOrder.customer.phone2}</Typography>
                  )}
                  <Typography variant="body2"><b>כתובת:</b> {selectedOrder.customer?.deliveryAddress}</Typography>
                  {selectedOrder.customer?.invoiceName && (
                    <Typography variant="body2"><b>שם לחשבונית:</b> {selectedOrder.customer.invoiceName}</Typography>
                  )}
                </Paper>
              </Grid>

              {/* מחיר ותאריכים */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>💰 מחיר ותאריכים</Typography>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="body2"><b>מחיר לפני מע"מ:</b> ₪{selectedOrder.totalPrice?.toFixed(2)}</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#2e7d32', mt: 0.5 }}>
                    <b>סה"כ כולל מע"מ:</b> ₪{selectedOrder.priceWithVAT?.toFixed(2)}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2">
                    <b>תאריך הזמנה:</b> {new Date(selectedOrder.orderDate).toLocaleDateString('he-IL')}
                  </Typography>
                  <Typography variant="body2">
                    <b>אספקה משוערת:</b>{' '}
                    {selectedOrder.estimatedDeliveryDate
                      ? new Date(selectedOrder.estimatedDeliveryDate).toLocaleDateString('he-IL')
                      : 'טרם נקבע'}
                  </Typography>
                </Paper>
              </Grid>

              {/* נגר משויך */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>🪚 נגר משויך</Typography>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  {selectedOrder.assignedCarpenter ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ bgcolor: '#5D4037' }}>
                        {selectedOrder.assignedCarpenter?.fullName?.[0]}
                      </Avatar>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {selectedOrder.assignedCarpenter?.fullName}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">לא שויך נגר עדיין</Typography>
                  )}
                </Paper>
              </Grid>

              {/* מוצרים */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>🪑 מוצרים</Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                      <TableRow>
                        <TableCell>מוצר</TableCell>
                        <TableCell>כמות</TableCell>
                        <TableCell>עץ</TableCell>
                        <TableCell>בד</TableCell>
                        <TableCell>הערות</TableCell>
                        <TableCell>מחיר ליחידה</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedOrder.items?.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{item.catalogProduct?.name || '—'}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.selectedCustomization?.wood?.description || '—'}</TableCell>
                          <TableCell>{item.selectedCustomization?.fabric?.description || '—'}</TableCell>
                          <TableCell>{item.selectedCustomization?.notes || '—'}</TableCell>
                          <TableCell>₪{item.itemPrice?.toFixed(2) || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* חומרים נדרשים */}
              {selectedOrder.requiredMaterials?.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>📦 חומרים נדרשים</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                          <TableCell>חומר</TableCell>
                          <TableCell>כמות</TableCell>
                          <TableCell>סטטוס ליקוט</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedOrder.requiredMaterials.map((mat, i) => (
                          <TableRow key={i}>
                            <TableCell>{mat.baseProduct?.name || '—'}</TableCell>
                            <TableCell>{mat.quantity}</TableCell>
                            <TableCell>
                              <Chip
                                label={mat.isPicked ? 'נלקט ✓' : 'ממתין'}
                                color={mat.isPicked ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              )}

            </Grid>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>סגור</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManagerOrders;