// src/pages/ManagerNewOrders.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, TextField, CircularProgress, Alert, Avatar,
  Grid, Divider, LinearProgress
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import { fetchAllOrders, assignCarpenterToOrder, assignBestCarpenterToOrder } from '../store/slices/ordersSlice';
import { fetchEmployees } from '../store/slices/employeesSlice';

const ManagerNewOrders = () => {
  const dispatch = useDispatch();
  const { orders, loading, error } = useSelector(state => state.orders);
  const { employees } = useSelector(state => state.employees);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [carpenterId, setCarpenterId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);

  useEffect(() => {
    dispatch(fetchAllOrders());
    dispatch(fetchEmployees());
  }, [dispatch]);

  const carpenters = employees.filter(e => e.role === 'CARPENTER');
  const newOrders = orders.filter(o => !o.assignedCarpenter);

  const handleViewOpen = (order) => {
    setSelectedOrder(order);
    setViewOpen(true);
  };

  const handleAssignOpen = (order) => {
    setSelectedOrder(order);
    setCarpenterId('');
    setAssignError(null);
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!carpenterId) return;
    setAssigning(true);
    setAssignError(null);
    try {
      await dispatch(assignCarpenterToOrder({ orderId: selectedOrder._id, carpenterId })).unwrap();
      setAssignOpen(false);
      dispatch(fetchAllOrders({ status: 'ORDERED' }));
    } catch (err) {
      setAssignError(err || 'שגיאה בשיוך נגר');
    } finally {
      setAssigning(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!selectedOrder?._id) return;
    setAssigning(true);
    setAssignError(null);
    try {
      await dispatch(assignBestCarpenterToOrder(selectedOrder._id)).unwrap();
      setAssignOpen(false);
      dispatch(fetchAllOrders());
    } catch (err) {
      setAssignError(err || 'שגיאה בשיוך אוטומטי');
    } finally {
      setAssigning(false);
    }
  };

  const getWorkloadColor = (hours) => {
    if (hours > 35) return 'error';
    if (hours > 20) return 'warning';
    return 'success';
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', color: '#5D4037' }}>
        🆕 הזמנות חדשות — ללא שיוך נגר
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {newOrders.length === 0 ? (
        <Alert severity="success">אין הזמנות חדשות ממתינות לשיוך 🎉</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 2 }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>לקוח</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>טלפון</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>כתובת משלוח</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>מוצרים</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>מחיר כולל מע"מ</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>תאריך הזמנה</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>פעולות</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {newOrders.map(order => (
                <TableRow key={order._id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: '#5D4037', fontSize: 14 }}>
                        {order.customer?.name?.[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {order.customer?.name}
                        </Typography>
                        {order.customer?.invoiceName && (
                          <Typography variant="caption" color="text.secondary">
                            חשבונית: {order.customer.invoiceName}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{order.customer?.phone1}</Typography>
                    {order.customer?.phone2 && (
                      <Typography variant="caption" color="text.secondary">{order.customer.phone2}</Typography>
                    )}
                  </TableCell>
                  <TableCell>{order.customer?.deliveryAddress}</TableCell>
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
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handleViewOpen(order)}
                      >
                        פרטים
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<PersonAddIcon />}
                        onClick={() => handleAssignOpen(order)}
                      >
                        שייך נגר
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ===== Dialog פרטי הזמנה ===== */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
          פרטי הזמנה — {selectedOrder?.customer?.name}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedOrder && (
            <Grid container spacing={3}>
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

              {/* מחיר */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>💰 מחיר</Typography>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="body2"><b>מחיר לפני מע"מ:</b> ₪{selectedOrder.totalPrice?.toFixed(2)}</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#2e7d32', mt: 1 }}>
                    <b>סה"כ כולל מע"מ:</b> ₪{selectedOrder.priceWithVAT?.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    תאריך הזמנה: {new Date(selectedOrder.orderDate).toLocaleDateString('he-IL')}
                  </Typography>
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
                        <TableCell>בחירת עץ</TableCell>
                        <TableCell>בחירת בד</TableCell>
                        <TableCell>הערות</TableCell>
                        <TableCell>מחיר ליחידה</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedOrder.items?.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{item.catalogProduct?.name || '—'}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>
                            {item.selectedCustomization?.wood?.description || '—'}
                          </TableCell>
                          <TableCell>
                            {item.selectedCustomization?.fabric?.description || '—'}
                          </TableCell>
                          <TableCell>{item.selectedCustomization?.notes || '—'}</TableCell>
                          <TableCell>₪{item.itemPrice?.toFixed(2) || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setViewOpen(false);
            handleAssignOpen(selectedOrder);
          }} variant="contained" color="primary" startIcon={<PersonAddIcon />}>
            שייך נגר
          </Button>
          <Button onClick={() => setViewOpen(false)}>סגור</Button>
        </DialogActions>
      </Dialog>

      {/* ===== Dialog שיוך נגר ===== */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
          🪚 שיוך נגר — {selectedOrder?.customer?.name}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {assignError && <Alert severity="error" sx={{ mb: 2 }}>{assignError}</Alert>}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            ניתן לבצע שיוך אוטומטי לנגר הפנוי ביותר, או לבחור ידנית מהרשימה.
          </Typography>

          <Button
            fullWidth
            variant="contained"
            startIcon={<AutoFixHighIcon />}
            sx={{ mb: 2, bgcolor: '#6D4C41', '&:hover': { bgcolor: '#4E342E' } }}
            onClick={handleAutoAssign}
            disabled={assigning}
          >
            שיוך אוטומטי לנגר הפנוי ביותר
          </Button>

          <Divider sx={{ mb: 2 }}>או בחירה ידנית</Divider>

          {/* רשימת נגרים עם עומס */}
          <Box sx={{ mb: 3 }}>
            {carpenters.map(c => (
              <Paper
                key={c._id}
                variant="outlined"
                onClick={() => setCarpenterId(c._id)}
                sx={{
                  p: 2, mb: 1, borderRadius: 2, cursor: 'pointer',
                  borderColor: carpenterId === c._id ? 'primary.main' : 'divider',
                  bgcolor: carpenterId === c._id ? '#e3f2fd' : 'white',
                  '&:hover': { borderColor: 'primary.main', bgcolor: '#f5f5f5' }
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#5D4037', fontSize: 14 }}>
                      {c.fullName?.[0]}
                    </Avatar>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.fullName}</Typography>
                  </Box>
                  <Chip
                    label={`${c.currentWorkloadHours || 0} שעות עומס`}
                    size="small"
                    color={getWorkloadColor(c.currentWorkloadHours || 0)}
                  />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min((c.currentWorkloadHours || 0) / 40 * 100, 100)}
                  color={getWorkloadColor(c.currentWorkloadHours || 0)}
                  sx={{ borderRadius: 2, height: 6 }}
                />
              </Paper>
            ))}
          </Box>

          {carpenters.length === 0 && (
            <Alert severity="warning">אין נגרים במערכת</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleAssign}
            variant="contained"
            color="primary"
            disabled={!carpenterId || assigning}
          >
            {assigning ? <CircularProgress size={20} /> : 'שייך ושלח למחסן'}
          </Button>
          <Button onClick={() => setAssignOpen(false)} disabled={assigning}>ביטול</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManagerNewOrders;