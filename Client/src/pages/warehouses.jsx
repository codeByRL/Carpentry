import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert, Box, Chip, CircularProgress, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography
} from '@mui/material';
import { fetchAllBaseProducts, fetchPurchaseList } from '../store/slices/warehouseSlice';

const Warehouses = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { baseProducts, purchaseList, loading, error } = useSelector((s) => s.warehouse);
  const isManager = user?.role === 'MANAGER';

  useEffect(() => {
    dispatch(fetchAllBaseProducts());
    dispatch(fetchPurchaseList());
  }, [dispatch]);

  const pendingSupply = (purchaseList || []).filter((p) => p.status !== 'ARRIVED');
  const inSupply = (purchaseList || []).filter((p) => p.status === 'SENT_TO_SUPPLIER');

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#5D4037', mb: 2 }}>
        {isManager ? 'סטטוס מחסן' : 'מלאי ומחסן'}
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#8D6E63', mb: 2 }}>
        {isManager
          ? 'תצוגה בלבד: מלאי קיים, חומרים באספקה, וחומרים הממתינים לאספקה.'
          : 'סקירת מלאי, חומרים באספקה וחומרים הממתינים לאספקה.'}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1.2, mb: 2.5, flexWrap: 'wrap' }}>
        <Chip label={`מלאי קיים: ${baseProducts?.length || 0}`} color="primary" />
        <Chip label={`באספקה: ${inSupply.length}`} color="info" />
        <Chip label={`ממתינים לאספקה: ${pendingSupply.length}`} color="warning" />
      </Box>

      <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        <Typography sx={{ fontWeight: 700, mb: 1.5 }}>מלאי קיים</Typography>
        <TableContainer sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
          <Table size="small" sx={{ minWidth: 520 }}>
            <TableHead>
              <TableRow>
                <TableCell>מוצר</TableCell>
                <TableCell>ספק</TableCell>
                <TableCell align="center">כמות במלאי</TableCell>
                <TableCell align="center">משוריין</TableCell>
                <TableCell align="center">זמין</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(baseProducts || []).map((p) => {
                const available = (p.quantity || 0) - (p.reservedQuantity || 0);
                return (
                  <TableRow key={p._id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.supplier || '—'}</TableCell>
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
                      color={item.status === 'SENT_TO_SUPPLIER' ? 'info' : 'warning'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default Warehouses;