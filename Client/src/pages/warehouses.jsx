import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert, Box, Chip, CircularProgress, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField
} from '@mui/material';
import { fetchAllBaseProducts, fetchPurchaseList, updateBaseProductAction } from '../store/slices/warehouseSlice';
import PageHeader from '../components/PageHeader.jsx';

const Warehouses = () => {
  const dispatch = useDispatch();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const { user } = useSelector((s) => s.auth);
  const { baseProducts, purchaseList, loading, error } = useSelector((s) => s.warehouse);
  const isManager = user?.role === 'MANAGER';

  useEffect(() => {
    dispatch(fetchAllBaseProducts());
    dispatch(fetchPurchaseList());
  }, [dispatch]);

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
                <TableCell align="center">מיקום מדף</TableCell>
                <TableCell align="center">כמות במלאי</TableCell>
                <TableCell align="center">משוריין</TableCell>
                <TableCell align="center">זמין</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(baseProducts || []).map((p) => {
                const available = (p.quantity || 0) - (p.reservedQuantity || 0);
                return (
                  <TableRow key={p._id} hover sx={{ cursor: 'pointer' }} onClick={() => openProductDetails(p)}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.supplier || '—'}</TableCell>
                    <TableCell align="center">{p.shelfLocation || '—'}</TableCell>
                    <TableCell align="center">{p.quantity || 0}</TableCell>
                    <TableCell align="center">{p.reservedQuantity || 0}</TableCell>
                    <TableCell align="center">
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
                <TableCell align="center">כמות נדרשת</TableCell>
                <TableCell align="center">סטטוס</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingSupply.map((item) => (
                <TableRow key={item._id}>
                  <TableCell>{item.product?.name || item.name || '—'}</TableCell>
                  <TableCell>{item.supplierName || item.product?.supplier || '—'}</TableCell>
                  <TableCell align="center">{item.totalQuantityNeeded || 0}</TableCell>
                  <TableCell align="center">
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
    </Box>
  );
};

export default Warehouses;