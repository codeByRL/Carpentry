import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert, Box, Chip, CircularProgress, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  IconButton, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { fetchAllBaseProducts, fetchPurchaseList, updateBaseProductAction } from '../store/slices/warehouseSlice';
import {
  fetchWarehouses, createWarehouse, updateWarehouse, deleteWarehouse,
} from '../store/slices/employeesSlice';
import { useFeedbackSnackbar } from '../hooks/useFeedbackSnackbar';
import PageHeader from '../components/PageHeader.jsx';

const EMPTY_WAREHOUSE = { name: '', address: '', description: '' };

const Warehouses = () => {
  const dispatch = useDispatch();
  const { showSuccess, showError, FeedbackSnackbar } = useFeedbackSnackbar();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState(EMPTY_WAREHOUSE);
  const [editingWarehouseId, setEditingWarehouseId] = useState(null);
  const [savingWarehouse, setSavingWarehouse] = useState(false);
  const { user } = useSelector((s) => s.auth);
  const { baseProducts, purchaseList, loading, error } = useSelector((s) => s.warehouse);
  const { warehouses } = useSelector((s) => s.employees);
  const isManager = user?.role === 'MANAGER';

  useEffect(() => {
    dispatch(fetchAllBaseProducts());
    dispatch(fetchPurchaseList());
    if (user?.role === 'MANAGER') dispatch(fetchWarehouses());
  }, [dispatch, user?.role]);

  const pendingSupply = (purchaseList || []).filter((p) => p.status !== 'ARRIVED');
  const inSupply = (purchaseList || []).filter((p) => p.status === 'SENT_TO_SUPPLIER');

  const openProductDetails = (product) => {
    setSelectedProduct(product);
    setIsEditingProduct(false);
    setEditForm({
      name: product?.name || '',
      code: product?.code || '',
      supplier: product?.supplier || '',
      shelfLocation: product?.shelfLocation || '',
      unit: product?.unit || '',
      quantity: Number(product?.quantity || 0),
      reservedQuantity: Number(product?.reservedQuantity || 0),
      minStock: Number(product?.minStock || 0),
      reorderQuantity: Number(product?.reorderQuantity || 0),
      description: product?.description || '',
    });
  };

  const closeProductDialog = () => {
    setSelectedProduct(null);
    setIsEditingProduct(false);
    setEditForm(null);
  };

  const handleEditField = (field) => (e) => {
    const value = e.target.value;
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const openAddWarehouse = () => {
    setEditingWarehouseId(null);
    setWarehouseForm(EMPTY_WAREHOUSE);
    setWarehouseDialogOpen(true);
  };

  const openEditWarehouse = (w) => {
    setEditingWarehouseId(w._id);
    setWarehouseForm({
      name: w.name || '',
      address: w.address || '',
      description: w.description || '',
    });
    setWarehouseDialogOpen(true);
  };

  const closeWarehouseDialog = () => {
    setWarehouseDialogOpen(false);
    setEditingWarehouseId(null);
    setWarehouseForm(EMPTY_WAREHOUSE);
  };

  const saveWarehouse = async () => {
    if (!warehouseForm.name.trim() || !warehouseForm.address.trim()) {
      showError('שם מחסן וכתובת הם שדות חובה');
      return;
    }
    setSavingWarehouse(true);
    try {
      const payload = {
        name: warehouseForm.name.trim(),
        address: warehouseForm.address.trim(),
        description: warehouseForm.description.trim(),
      };
      const result = editingWarehouseId
        ? await dispatch(updateWarehouse({ id: editingWarehouseId, data: payload }))
        : await dispatch(createWarehouse(payload));
      if (result.error) {
        showError(result.payload || 'שגיאה בשמירת מחסן');
        return;
      }
      showSuccess(editingWarehouseId ? 'פרטי המחסן עודכנו' : 'מחסן נוסף בהצלחה');
      closeWarehouseDialog();
    } finally {
      setSavingWarehouse(false);
    }
  };

  const handleDeleteWarehouse = async (id, name) => {
    if (!window.confirm(`למחוק את המחסן "${name}"?`)) return;
    const result = await dispatch(deleteWarehouse(id));
    if (result.error) showError(result.payload || 'לא ניתן למחוק מחסן');
    else showSuccess('המחסן נמחק');
  };

  const saveProductChanges = async () => {
    if (!selectedProduct?._id || !editForm) return;
    setSavingProduct(true);
    try {
      await dispatch(
        updateBaseProductAction({
          baseProductId: selectedProduct._id,
          data: {
            ...editForm,
            quantity: Number(editForm.quantity || 0),
            reservedQuantity: Number(editForm.reservedQuantity || 0),
            minStock: Number(editForm.minStock || 0),
            reorderQuantity: Number(editForm.reorderQuantity || 0),
          },
        })
      ).unwrap();
      await dispatch(fetchAllBaseProducts());
      setSelectedProduct((prev) => (prev ? { ...prev, ...editForm } : prev));
      setIsEditingProduct(false);
    } finally {
      setSavingProduct(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <PageHeader
        title={isManager ? 'סטטוס מחסן' : 'מלאי ומחסן'}
        description={
          isManager
            ? 'תצוגה בלבד: מלאי קיים, חומרים באספקה, וחומרים הממתינים לאספקה.'
            : 'סקירת מלאי, חומרים באספקה וחומרים הממתינים לאספקה.'
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {isManager && (
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2.5, border: '1px solid #E0D5CC' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontWeight: 700 }}>ניהול מחסנים (שם, כתובת)</Typography>
            <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />} onClick={openAddWarehouse}>
              הוסף מחסן
            </Button>
          </Box>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>שם מחסן</TableCell>
                  <TableCell>כתובת</TableCell>
                  <TableCell>תיאור</TableCell>
                  <TableCell align="right">פעולות</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(warehouses || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      אין מחסנים — לחצי «הוסף מחסן»
                    </TableCell>
                  </TableRow>
                ) : (
                  (warehouses || []).map((w) => (
                    <TableRow key={w._id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{w.name}</TableCell>
                      <TableCell>{w.address || '—'}</TableCell>
                      <TableCell>{w.description || '—'}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="עריכת פרטי מחסן">
                          <IconButton size="small" onClick={() => openEditWarehouse(w)} sx={{ color: '#5D4037' }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="מחיקת מחסן">
                          <IconButton size="small" onClick={() => handleDeleteWarehouse(w._id, w.name)} sx={{ color: '#C62828' }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            שיוך מחסנאי למחסן: ניהול עובדים → עריכת עובד מחסנאי → לשונית «פרטי מחסן».
          </Typography>
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 1.2, mb: 2.5, flexWrap: 'wrap' }}>
        <Chip label={`פריטי מחסן: ${baseProducts?.length || 0}`} color="primary" />
        <Chip
          label={`באספקה: ${inSupply.length}`}
          sx={{ bgcolor: '#EFEBE9', color: '#5D4037', border: '1px solid #D7CCC8', fontWeight: 600 }}
        />
        <Chip
          label={`ממתינים לאספקה: ${pendingSupply.length}`}
          sx={{ bgcolor: '#FFF8F0', color: '#A0522D', border: '1px solid #E8C9B0', fontWeight: 600 }}
        />
      </Box>

      <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        <Typography sx={{ fontWeight: 700, mb: 1.5 }}>פריטי מחסן</Typography>
        <TableContainer sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
          <Table size="small" sx={{ minWidth: 520 }}>
            <TableHead>
              <TableRow>
                <TableCell>מוצר</TableCell>
                <TableCell>ספק</TableCell>
                <TableCell align="right">מיקום מדף</TableCell>
                <TableCell align="right">כמות במלאי</TableCell>
                <TableCell align="right">משוריין</TableCell>
                <TableCell align="right">זמין</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(baseProducts || []).map((p) => {
                const available = (p.quantity || 0) - (p.reservedQuantity || 0);
                return (
                  <TableRow key={p._id} hover sx={{ cursor: 'pointer' }} onClick={() => openProductDetails(p)}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.supplier || '—'}</TableCell>
                    <TableCell align="right">{p.shelfLocation || '—'}</TableCell>
                    <TableCell align="right">{p.quantity || 0}</TableCell>
                    <TableCell align="right">{p.reservedQuantity || 0}</TableCell>
                    <TableCell align="right">
                      <Typography sx={{ color: available <= (p.minStock || 0) ? '#C62828' : '#2E7D32', fontWeight: 700 }}>
                        {available}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Typography sx={{ fontWeight: 700, mb: 1.5 }}>חומרי גלם באספקה / ממתינים לאספקה</Typography>
        <TableContainer sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
          <Table size="small" sx={{ minWidth: 520 }}>
            <TableHead>
              <TableRow>
                <TableCell>חומר</TableCell>
                <TableCell>ספק</TableCell>
                <TableCell align="right">כמות נדרשת</TableCell>
                <TableCell align="right">סטטוס</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingSupply.map((item) => (
                <TableRow key={item._id}>
                  <TableCell>{item.product?.name || item.name || '—'}</TableCell>
                  <TableCell>{item.supplierName || item.product?.supplier || '—'}</TableCell>
                  <TableCell align="right">{item.totalQuantityNeeded || 0}</TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      label={item.status === 'SENT_TO_SUPPLIER' ? 'באספקה' : 'ממתין לאספקה'}
                      sx={
                        item.status === 'SENT_TO_SUPPLIER'
                          ? { bgcolor: '#EFEBE9', color: '#5D4037', border: '1px solid #D7CCC8', fontWeight: 600 }
                          : { bgcolor: '#FFF8F0', color: '#A0522D', border: '1px solid #E8C9B0', fontWeight: 600 }
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={!!selectedProduct} onClose={closeProductDialog} fullWidth maxWidth="sm">
        <DialogTitle>פרטי מוצר במחסן</DialogTitle>
        <DialogContent dividers>
          {selectedProduct && !isEditingProduct && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography><b>שם מוצר:</b> {selectedProduct.name || '—'}</Typography>
              <Typography><b>קוד:</b> {selectedProduct.code || '—'}</Typography>
              <Typography><b>ספק:</b> {selectedProduct.supplier || '—'}</Typography>
              <Typography><b>מיקום מדף:</b> {selectedProduct.shelfLocation || '—'}</Typography>
              <Typography><b>יחידת מידה:</b> {selectedProduct.unit || '—'}</Typography>
              <Typography><b>כמות במלאי:</b> {selectedProduct.quantity || 0}</Typography>
              <Typography><b>כמות משוריינת:</b> {selectedProduct.reservedQuantity || 0}</Typography>
              <Typography><b>מינימום מלאי:</b> {selectedProduct.minStock || 0}</Typography>
              <Typography><b>כמות הזמנה חוזרת:</b> {selectedProduct.reorderQuantity || 0}</Typography>
              <Typography><b>תיאור:</b> {selectedProduct.description || '—'}</Typography>
            </Box>
          )}
          {selectedProduct && isEditingProduct && editForm && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mt: 0.5 }}>
              <TextField label="שם מוצר" value={editForm.name} onChange={handleEditField('name')} size="small" />
              <TextField label="קוד" value={editForm.code} onChange={handleEditField('code')} size="small" />
              <TextField label="ספק" value={editForm.supplier} onChange={handleEditField('supplier')} size="small" />
              <TextField label="מיקום מדף" value={editForm.shelfLocation} onChange={handleEditField('shelfLocation')} size="small" />
              <TextField label="יחידת מידה" value={editForm.unit} onChange={handleEditField('unit')} size="small" />
              <TextField label="כמות במלאי" type="number" value={editForm.quantity} onChange={handleEditField('quantity')} size="small" />
              <TextField label="כמות משוריינת" type="number" value={editForm.reservedQuantity} onChange={handleEditField('reservedQuantity')} size="small" />
              <TextField label="מינימום מלאי" type="number" value={editForm.minStock} onChange={handleEditField('minStock')} size="small" />
              <TextField label="כמות הזמנה חוזרת" type="number" value={editForm.reorderQuantity} onChange={handleEditField('reorderQuantity')} size="small" />
              <TextField label="תיאור" value={editForm.description} onChange={handleEditField('description')} size="small" multiline minRows={2} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {isEditingProduct ? (
            <>
              <Button onClick={() => setIsEditingProduct(false)} disabled={savingProduct}>ביטול</Button>
              <Button onClick={saveProductChanges} variant="contained" disabled={savingProduct}>
                {savingProduct ? 'שומר...' : 'שמור שינויים'}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setIsEditingProduct(true)} variant="outlined">ערוך פרטים</Button>
              <Button onClick={closeProductDialog}>סגור</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={warehouseDialogOpen} onClose={closeWarehouseDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, color: '#5D4037' }}>
          {editingWarehouseId ? 'עריכת פרטי מחסן' : 'הוספת מחסן'}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
            <TextField
              label="שם מחסן *"
              value={warehouseForm.name}
              onChange={(e) => setWarehouseForm((p) => ({ ...p, name: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="כתובת *"
              value={warehouseForm.address}
              onChange={(e) => setWarehouseForm((p) => ({ ...p, address: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="תיאור"
              value={warehouseForm.description}
              onChange={(e) => setWarehouseForm((p) => ({ ...p, description: e.target.value }))}
              fullWidth
              size="small"
              multiline
              minRows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeWarehouseDialog} color="inherit">ביטול</Button>
          <Button variant="contained" onClick={saveWarehouse} disabled={savingWarehouse}>
            {savingWarehouse ? 'שומר...' : 'שמור'}
          </Button>
        </DialogActions>
      </Dialog>

      <FeedbackSnackbar />
    </Box>
  );
};

export default Warehouses;