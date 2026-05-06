import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import API from '../services/api';
import {
  Box, Typography, Grid, Paper, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, IconButton, Tooltip,
  Divider, Alert, Switch, FormControlLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';

import {
  fetchActiveCatalog,
  fetchManagerCatalog,
  fetchCarpenters,
  createCatalogProduct,
  updateCatalogProduct,
  deleteCatalogProduct,
  approveProduct,
  assignCarpenterForCharacterization,
  generateAIImage,
  clearGeneratedImage,
  clearCatalogSubmitError,
} from '../store/slices/catalogSlice';

const STATUS_LABEL = {
  PENDING_CHARACTERIZATION: { label: 'ממתין לאפיון',  color: '#A0522D', bg: '#FDF0E8' },
  WAITING_ADMIN_APPROVAL:   { label: 'ממתין לאישור', color: '#8B0000', bg: '#FDE8E8' },
  ACTIVE:                   { label: 'פעיל',          color: '#4A5228', bg: '#EEF0E8' },
};

const WOOD_COLOR = '#D2691E';
const DARK      = '#3E2723';
const LIGHT_BG  = '#FBF0E9';
const BORDER    = '#E8C9B0';
const BASE_URL  = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:5001';

const Field = ({ label, value }) =>
  value ? (
    <Box sx={{ mb: 1 }}>
      <Typography sx={{ fontSize: 11, color: '#A1887F', mb: 0.2 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, color: DARK }}>{value}</Typography>
    </Box>
  ) : null;

const CatalogPage = () => {
  const dispatch = useDispatch();
  const { user } = useSelector(s => s.auth);
  const isManager = user?.role === 'MANAGER';

  const { products, carpenters, generatedImageUrl, loading, submitLoading, imageLoading, error, submitError } =
    useSelector(s => s.catalog);

  const [detailProduct, setDetailProduct] = useState(null);
  const [editProduct, setEditProduct]     = useState(null);
  const [showNewForm, setShowNewForm]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approvePrice, setApprovePrice]   = useState('');
  const [aiPrompt, setAiPrompt]           = useState('');
  const [imagePreview, setImagePreview]   = useState(null);
  const [imageFile, setImageFile]         = useState(null);
  const [managerFilter, setManagerFilter] = useState('ALL');
  const [showFabricForm, setShowFabricForm] = useState(false);
  const [newFabricForm, setNewFabricForm] = useState({
    name: '',
    supplier: '',
    description: '',
    priceDelta: '',
    quantity: '1',
  });
  const [newFabricImageFile, setNewFabricImageFile] = useState(null);
  const [fabricCreateResult, setFabricCreateResult] = useState('');
  const [fabricsDialogOpen, setFabricsDialogOpen] = useState(false);
  const [fabricsLoading, setFabricsLoading] = useState(false);
  const [fabricProducts, setFabricProducts] = useState([]);
  const [fabricsInStockCount, setFabricsInStockCount] = useState(0);

  const [newForm, setNewForm] = useState({
    name: '', description: '', carpenterId: '',
    needsWoodSelection: false, needsFabricSelection: false,
  });

  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    if (isManager) {
      dispatch(fetchManagerCatalog());
      dispatch(fetchCarpenters());
      API.get('/base-products?isMaterial=true&type=fabric&limit=200')
        .then((res) => {
          const inStock = (res.data || []).filter((f) => Number(f.quantity || 0) > 0);
          setFabricsInStockCount(inStock.length);
        })
        .catch(() => setFabricsInStockCount(0));
    } else {
      dispatch(fetchActiveCatalog());
    }
  }, [dispatch, isManager]);

  useEffect(() => {
    if (generatedImageUrl) {
      const normalizedUrl = generatedImageUrl.startsWith('http')
        ? generatedImageUrl
        : `${BASE_URL}${generatedImageUrl}`;
      setImagePreview(normalizedUrl);
    }
  }, [generatedImageUrl]);

  const handleDelete = () => {
    dispatch(deleteCatalogProduct(deleteConfirm._id));
    setDeleteConfirm(null);
  };

  const handleApproveOpen = (product) => {
    setApproveTarget(product);
    setApprovePrice(product?.price ? String(product.price) : '');
  };

  const handleApproveSubmit = async () => {
    if (!approveTarget?._id || !approvePrice) return;
    const result = await dispatch(approveProduct({ productId: approveTarget._id, price: Number(approvePrice) }));
    if (!result.error) {
      setApproveTarget(null);
      setApprovePrice('');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    dispatch(clearGeneratedImage());
  };

  const handleGenerateAI = () => {
    if (!aiPrompt.trim()) return;
    dispatch(clearCatalogSubmitError());
    dispatch(generateAIImage(aiPrompt));
    setImageFile(null);
  };

  // ✅ תוקן: async/await + carpenterId לא נשלח ב-FormData + בדיקת productId
  const handleCreateSubmit = async () => {
    const fd = new FormData();
    fd.append('name', newForm.name);
    fd.append('description', newForm.description);
    fd.append('needsWoodSelection', newForm.needsWoodSelection);
    fd.append('needsFabricSelection', newForm.needsFabricSelection);
    if (imageFile) fd.append('image', imageFile);
    else if (generatedImageUrl) fd.append('imageUrl', generatedImageUrl);

    const r = await dispatch(createCatalogProduct(fd));
    if (!r.error) {
      const productId = r.payload?._id;
      if (newForm.carpenterId && productId) {
        await dispatch(assignCarpenterForCharacterization({
          productId,
          carpenterId: newForm.carpenterId,
        }));
      }
      setShowNewForm(false);
      setNewForm({ name: '', description: '', carpenterId: '', needsWoodSelection: false, needsFabricSelection: false });
      setImagePreview(null);
      setImageFile(null);
      setAiPrompt('');
      dispatch(clearGeneratedImage());
    }
  };

  const handleEditOpen = (p) => {
    setEditProduct(p);
    setEditForm({
      name: p.name || '',
      description: p.description || '',
      price: p.price || '',
      estimatedWorkTime: p.estimatedWorkTime || '',
      needsWoodSelection: p.needsWoodSelection || false,
      needsFabricSelection: p.needsFabricSelection || false,
    });
    // ✅ תוקן: BASE_URL במקום localhost:5000
    setImagePreview(p.image ? `${BASE_URL}${p.image}` : null);
    setImageFile(null);
  };

  const handleEditSubmit = () => {
    const fd = new FormData();
    Object.entries(editForm).forEach(([k, v]) => fd.append(k, v));
    if (imageFile) fd.append('image', imageFile);
    dispatch(updateCatalogProduct({ productId: editProduct._id, formData: fd })).then(r => {
      if (!r.error) { setEditProduct(null); setImagePreview(null); setImageFile(null); }
    });
  };

  const handleCreateFabric = async () => {
    if (!newFabricForm.name.trim()) return;
    const fd = new FormData();
    fd.append('name', newFabricForm.name.trim());
    fd.append('unit', 'מטר');
    fd.append('supplier', newFabricForm.supplier.trim());
    fd.append('description', newFabricForm.description.trim());
    fd.append('priceDelta', Number(newFabricForm.priceDelta || 0));
    fd.append('isMaterial', 'true');
    fd.append('materialType', 'fabric');
    fd.append('quantity', Number(newFabricForm.quantity || 0));
    fd.append('minStock', 1);
    fd.append('reorderQuantity', 10);
    if (newFabricImageFile) {
      fd.append('image', newFabricImageFile);
    }
    try {
      const res = await API.post('/warehouse/base-products', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const created = res.data;
      setFabricCreateResult(`בד נוסף בהצלחה. מספר הדגם: ${created.code}`);
      setShowFabricForm(false);
      setNewFabricForm({ name: '', supplier: '', description: '', priceDelta: '', quantity: '1' });
      setNewFabricImageFile(null);
      API.get('/base-products?isMaterial=true&type=fabric&limit=200')
        .then((countRes) => {
          const inStock = (countRes.data || []).filter((f) => Number(f.quantity || 0) > 0);
          setFabricsInStockCount(inStock.length);
        })
        .catch(() => {});
    } catch (e) {
      setFabricCreateResult(e.response?.data?.error || 'שגיאה בהוספת בד חדש');
    }
  };

  const handleShowFabricsInStock = async () => {
    try {
      setFabricsLoading(true);
      const res = await API.get('/base-products?isMaterial=true&type=fabric&limit=200');
      const inStock = (res.data || []).filter((f) => Number(f.quantity || 0) > 0);
      setFabricProducts(inStock);
      setFabricsDialogOpen(true);
    } catch {
      setFabricProducts([]);
      setFabricsDialogOpen(true);
    } finally {
      setFabricsLoading(false);
    }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress sx={{ color: WOOD_COLOR }} />
    </Box>
  );

  const visibleProducts = isManager
    ? products.filter((p) => managerFilter === 'ALL' ? true : p.status === managerFilter)
    : products;

  const statusCounts = {
    PENDING_CHARACTERIZATION: products.filter((p) => p.status === 'PENDING_CHARACTERIZATION').length,
    WAITING_ADMIN_APPROVAL: products.filter((p) => p.status === 'WAITING_ADMIN_APPROVAL').length,
    ACTIVE: products.filter((p) => p.status === 'ACTIVE').length,
  };

  return (
    <Box sx={{ width: '100%' }}>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography sx={{ fontSize: 21, fontWeight: 700, color: DARK }}>קטלוג מוצרים</Typography>
        {isManager && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, width: '100%' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button size="small" variant={managerFilter === 'ALL' ? 'contained' : 'outlined'}
                sx={{ fontSize: 11.5, borderRadius: 2 }}
                onClick={() => setManagerFilter('ALL')}>
                הכל ({products.length})
              </Button>
              <Button size="small" variant={managerFilter === 'PENDING_CHARACTERIZATION' ? 'contained' : 'outlined'}
                sx={{ fontSize: 11.5, borderRadius: 2 }}
                onClick={() => setManagerFilter('PENDING_CHARACTERIZATION')}>
                מוצרים באפיון ({statusCounts.PENDING_CHARACTERIZATION})
              </Button>
              <Button size="small" variant={managerFilter === 'WAITING_ADMIN_APPROVAL' ? 'contained' : 'outlined'}
                sx={{ fontSize: 11.5, borderRadius: 2 }}
                onClick={() => setManagerFilter('WAITING_ADMIN_APPROVAL')}>
                ממתינים לאישור ({statusCounts.WAITING_ADMIN_APPROVAL})
              </Button>
              <Button size="small" variant={managerFilter === 'ACTIVE' ? 'contained' : 'outlined'}
                sx={{ fontSize: 11.5, borderRadius: 2 }}
                onClick={() => setManagerFilter('ACTIVE')}>
                פעילים ({statusCounts.ACTIVE})
              </Button>
              <Button size="small" variant="contained" startIcon={<AddIcon />}
                sx={{ minWidth: 132, bgcolor: WOOD_COLOR, fontSize: 12, borderRadius: 2, '&:hover': { bgcolor: '#A0522D' } }}
                onClick={() => setShowNewForm(true)}>
                מוצר חדש
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button size="small" variant="outlined"
                sx={{ fontSize: 11.5, borderRadius: 2, borderColor: BORDER, color: '#6D4C41' }}
                onClick={handleShowFabricsInStock}>
                בדי ריפוד במלאי ({fabricsInStockCount})
              </Button>
              <Button size="small" variant="contained" startIcon={<AddIcon />}
                sx={{ minWidth: 132, bgcolor: '#6D4C41', fontSize: 12, borderRadius: 2, '&:hover': { bgcolor: '#4E342E' } }}
                onClick={() => setShowFabricForm(true)}>
                הוסף בד חדש
              </Button>
            </Box>
          </Box>
        )}
      </Box>
      {fabricCreateResult && (
        <Alert severity={fabricCreateResult.includes('בהצלחה') ? 'success' : 'error'} sx={{ mb: 2 }}>
          {fabricCreateResult}
        </Alert>
      )}

      {error && (
        <Alert severity={error.includes('נטפרי') ? "warning" : "error"} sx={{ mb: 2, direction: 'rtl' }}>
          <Typography sx={{ fontSize: 13 }}>
            {error.includes('נטפרי') ? (
              <><strong>בעיה בגישה ל-AI:</strong> {error}<br />
              <small>הפתרון: הפעל את האפליקציה על מחשב ללא סינון רשת</small></>
            ) : error}
          </Typography>
        </Alert>
      )}

      {visibleProducts.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          {isManager && managerFilter === 'PENDING_CHARACTERIZATION'
            ? 'אין מוצרים לאפיון'
            : isManager && managerFilter === 'WAITING_ADMIN_APPROVAL'
              ? 'אין מוצרים הממתינים לאישור'
              : isManager && managerFilter === 'ACTIVE'
                ? 'אין מוצרים פעילים'
                : 'אין מוצרים להצגה'}
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {visibleProducts.map(p => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={p._id}>
              <Paper sx={{
                borderRadius: 3, overflow: 'hidden', boxShadow: 'none',
                border: `1px solid ${BORDER}`, bgcolor: 'white',
                transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' },
              }}>
                <Box sx={{
                  height: 180, bgcolor: LIGHT_BG, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {/* ✅ תוקן: BASE_URL */}
                  {p.image
                    ? <img src={`${BASE_URL}${p.image}`} alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Typography sx={{ color: '#C4A882', fontSize: 13 }}>אין תמונה</Typography>
                  }
                </Box>
                <Box sx={{ p: 1.8 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: DARK, mb: 0.3 }}>{p.name}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: '#A1887F', mb: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.description || '—'}
                  </Typography>
                  {p.price && (
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: WOOD_COLOR, mb: 1 }}>
                      ₪{p.price.toLocaleString()}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button size="small" variant="outlined" startIcon={<InfoOutlinedIcon />}
                      sx={{ flex: 1, fontSize: 11, borderColor: BORDER, color: '#5D4037', borderRadius: 2 }}
                      onClick={() => setDetailProduct(p)}>פרטים</Button>
                    {isManager && (
                      <Tooltip title="עריכה">
                        <IconButton size="small"
                          sx={{ border: `1px solid ${BORDER}`, borderRadius: 2, color: '#A0522D' }}
                          onClick={() => handleEditOpen(p)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isManager && (
                      <Tooltip title="מחיקה">
                        <IconButton size="small"
                          sx={{ border: '1px solid #FFCDD2', borderRadius: 2, color: '#C62828' }}
                          onClick={() => setDeleteConfirm(p)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                  {isManager && p.status === 'WAITING_ADMIN_APPROVAL' && (
                    <Button
                      size="small"
                      fullWidth
                      variant="contained"
                      sx={{ mt: 1, bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' }, fontSize: 11.5 }}
                      onClick={() => handleApproveOpen(p)}
                    >
                      קביעת מחיר ואישור מוצר
                    </Button>
                  )}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* דיאלוג פרטים */}
      <Dialog open={!!detailProduct} onClose={() => setDetailProduct(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        {detailProduct && <>
          <DialogTitle sx={{ fontWeight: 700, color: DARK, pb: 1 }}>{detailProduct.name}</DialogTitle>
          <DialogContent dividers>
            {detailProduct.image && (
              <Box sx={{ mb: 2, borderRadius: 2, overflow: 'hidden', height: 200 }}>
                {/* ✅ תוקן: BASE_URL */}
                <img src={`${BASE_URL}${detailProduct.image}`} alt={detailProduct.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Box>
            )}
            <Field label="תיאור" value={detailProduct.description} />
            <Field label="מחיר" value={detailProduct.price ? `₪${detailProduct.price.toLocaleString()}` : null} />
            <Field label="זמן עבודה משוער" value={detailProduct.estimatedWorkTime ? `${detailProduct.estimatedWorkTime} שעות` : null} />
            {detailProduct.needsWoodSelection && (
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: 11, color: '#A1887F', mb: 0.5 }}>אפשרויות עץ</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                  {detailProduct.woodOptions?.map((w, i) => (
                    <Chip key={i} label={`${w.code} — ${w.description}`} size="small"
                      sx={{ bgcolor: LIGHT_BG, color: DARK, fontSize: 11 }} />
                  ))}
                </Box>
              </Box>
            )}
            {detailProduct.needsFabricSelection && (
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: 11, color: '#A1887F', mb: 0.5 }}>אפשרויות בד</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                  {detailProduct.fabricOptions?.map((f, i) => (
                    <Chip key={i} label={`${f.code} — ${f.description}`} size="small"
                      sx={{ bgcolor: '#F5EDE8', color: DARK, fontSize: 11 }} />
                  ))}
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDetailProduct(null)} sx={{ color: '#A1887F', fontSize: 12 }}>סגור</Button>
          </DialogActions>
        </>}
      </Dialog>

      {/* דיאלוג מוצר חדש */}
      <Dialog open={isManager && showNewForm} onClose={() => setShowNewForm(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: DARK, display: 'flex', justifyContent: 'space-between' }}>
          מוצר חדש
          <IconButton size="small" onClick={() => setShowNewForm(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="שם מוצר" size="small" fullWidth value={newForm.name}
            onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
          <TextField label="תיאור" size="small" fullWidth multiline rows={2} value={newForm.description}
            onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} />
          <Box>
            <Typography sx={{ fontSize: 12, color: '#A1887F', mb: 1 }}>תמונה</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Button component="label" size="small" variant="outlined" startIcon={<UploadIcon />}
                sx={{ fontSize: 11, borderColor: BORDER, color: '#5D4037', borderRadius: 2 }}>
                העלאה
                <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
              </Button>
              <TextField size="small" placeholder="תאר את המוצר ל-AI..." value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                sx={{ flex: 1, '& .MuiInputBase-root': { fontSize: 12 } }} />
              <Button size="small" variant="contained" startIcon={<AutoAwesomeIcon />}
                disabled={imageLoading || !aiPrompt.trim()} onClick={handleGenerateAI}
                sx={{ bgcolor: '#6D4C41', fontSize: 11, borderRadius: 2, whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: '#4E342E' } }}>
                {imageLoading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : 'AI'}
              </Button>
            </Box>
            {submitError && submitError.includes && submitError.includes('נטפרי') && (
              <Alert severity="warning" sx={{ mb: 1, fontSize: 11 }}>
                יצירת תמונה עם AI לא זמינה על מחשב זה בגלל סינון רשת.
              </Alert>
            )}
            {submitError && (!submitError.includes || !submitError.includes('נטפרי')) && (
              <Alert severity="error" sx={{ mb: 1, fontSize: 11 }}>
                {typeof submitError === 'string' ? submitError : 'שגיאה ביצירת תמונה עם AI'}
              </Alert>
            )}
            {imagePreview && (
              <Box sx={{ borderRadius: 2, overflow: 'hidden', height: 140, border: `1px solid ${BORDER}` }}>
                <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Box>
            )}
          </Box>
          <TextField select label="שיוך נגר לאפיון" size="small" fullWidth
            value={newForm.carpenterId}
            onChange={e => setNewForm(f => ({ ...f, carpenterId: e.target.value }))}
            SelectProps={{ native: true }}>
            <option value="">— בחר נגר —</option>
            {carpenters.map(c => (
              <option key={c._id} value={c._id}>{c.fullName || c.username}</option>
            ))}
          </TextField>
          <Divider />
          <FormControlLabel
            control={<Switch checked={newForm.needsWoodSelection}
              onChange={e => setNewForm(f => ({ ...f, needsWoodSelection: e.target.checked }))}
              sx={{ '& .MuiSwitch-thumb': { bgcolor: WOOD_COLOR } }} />}
            label={<Typography sx={{ fontSize: 13 }}>דורש בחירת סוג עץ</Typography>} />
          <FormControlLabel
            control={<Switch checked={newForm.needsFabricSelection}
              onChange={e => setNewForm(f => ({ ...f, needsFabricSelection: e.target.checked }))}
              sx={{ '& .MuiSwitch-thumb': { bgcolor: WOOD_COLOR } }} />}
            label={<Typography sx={{ fontSize: 13 }}>דורש בחירת בד</Typography>} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowNewForm(false)} sx={{ color: '#A1887F', fontSize: 12 }}>ביטול</Button>
          <Button variant="contained" disabled={submitLoading || !newForm.name} onClick={handleCreateSubmit}
            sx={{ bgcolor: WOOD_COLOR, fontSize: 12, borderRadius: 2, '&:hover': { bgcolor: '#A0522D' } }}>
            {submitLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'שלח לאפיון'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* דיאלוג עריכה */}
      <Dialog open={isManager && !!editProduct} onClose={() => setEditProduct(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: DARK, display: 'flex', justifyContent: 'space-between' }}>
          עריכת מוצר
          <IconButton size="small" onClick={() => setEditProduct(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="שם מוצר" size="small" fullWidth value={editForm.name || ''}
            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
          <TextField label="תיאור" size="small" fullWidth multiline rows={2} value={editForm.description || ''}
            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
          <TextField label="מחיר (₪)" size="small" type="number" fullWidth value={editForm.price || ''}
            onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
          <TextField label="זמן עבודה משוער (שעות)" size="small" type="number" fullWidth
            value={editForm.estimatedWorkTime || ''}
            onChange={e => setEditForm(f => ({ ...f, estimatedWorkTime: e.target.value }))} />
          <Box>
            <Typography sx={{ fontSize: 12, color: '#A1887F', mb: 1 }}>תמונה</Typography>
            <Button component="label" size="small" variant="outlined" startIcon={<UploadIcon />}
              sx={{ fontSize: 11, borderColor: BORDER, color: '#5D4037', borderRadius: 2, mb: 1 }}>
              החלף תמונה
              <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
            </Button>
            {imagePreview && (
              <Box sx={{ borderRadius: 2, overflow: 'hidden', height: 140, border: `1px solid ${BORDER}` }}>
                <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Box>
            )}
          </Box>
          <Divider />
          <FormControlLabel
            control={<Switch checked={editForm.needsWoodSelection || false}
              onChange={e => setEditForm(f => ({ ...f, needsWoodSelection: e.target.checked }))} />}
            label={<Typography sx={{ fontSize: 13 }}>דורש בחירת סוג עץ</Typography>} />
          <FormControlLabel
            control={<Switch checked={editForm.needsFabricSelection || false}
              onChange={e => setEditForm(f => ({ ...f, needsFabricSelection: e.target.checked }))} />}
            label={<Typography sx={{ fontSize: 13 }}>דורש בחירת בד</Typography>} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditProduct(null)} sx={{ color: '#A1887F', fontSize: 12 }}>ביטול</Button>
          <Button variant="contained" disabled={submitLoading} onClick={handleEditSubmit}
            sx={{ bgcolor: WOOD_COLOR, fontSize: 12, borderRadius: 2, '&:hover': { bgcolor: '#A0522D' } }}>
            {submitLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'שמור שינויים'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* דיאלוג אישור מחיקה */}
      <Dialog open={isManager && !!deleteConfirm} onClose={() => setDeleteConfirm(null)}
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: '#8B0000', fontSize: 15 }}>מחיקת מוצר</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13 }}>
            האם למחוק את <strong>{deleteConfirm?.name}</strong>? פעולה זו אינה הפיכה.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ color: '#A1887F', fontSize: 12 }}>ביטול</Button>
          <Button variant="contained" onClick={handleDelete}
            sx={{ bgcolor: '#C62828', fontSize: 12, borderRadius: 2, '&:hover': { bgcolor: '#8B0000' } }}>
            מחק
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isManager && !!approveTarget} onClose={() => setApproveTarget(null)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: '#2E7D32' }}>קביעת מחיר ואישור מוצר</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 14, mb: 1.5 }}>
            מוצר: <strong>{approveTarget?.name}</strong>
          </Typography>
          {approveTarget?.image && (
            <Box sx={{ mb: 2, borderRadius: 2, overflow: 'hidden', height: 180, border: `1px solid ${BORDER}` }}>
              <img
                src={`${BASE_URL}${approveTarget.image}`}
                alt={approveTarget.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Box>
          )}
          <Field label="תיאור מנהל" value={approveTarget?.description} />
          <Field label="נגר מאפיין" value={approveTarget?.assignedCarpenter?.fullName} />
          <Field
            label="זמן עבודה משוער"
            value={approveTarget?.estimatedWorkTime
              ? `${(Number(approveTarget.estimatedWorkTime) / 40).toFixed(1)} שבועות (${approveTarget.estimatedWorkTime} שעות)`
              : null}
          />
          <Field
            label="נדרש בחירת עץ"
            value={approveTarget?.needsWoodSelection ? 'כן' : 'לא'}
          />
          <Field
            label="נדרש בחירת בד"
            value={approveTarget?.needsFabricSelection ? 'כן' : 'לא'}
          />

          <Box sx={{ mb: 1.2 }}>
            <Typography sx={{ fontSize: 11, color: '#A1887F', mb: 0.6 }}>חומרי גלם לאפיון</Typography>
            {approveTarget?.baseProducts?.length ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                {approveTarget.baseProducts.map((b, i) => (
                  <Chip
                    key={i}
                    size="small"
                    label={`${b.product?.name || b.product || 'חומר'} × ${b.quantity}`}
                    sx={{ bgcolor: '#F5EDE8', color: '#3E2723', fontSize: 11 }}
                  />
                ))}
              </Box>
            ) : (
              <Typography sx={{ fontSize: 12, color: '#A1887F' }}>לא הוגדרו חומרי גלם</Typography>
            )}
          </Box>

          <Box sx={{ mb: 1.2 }}>
            <Typography sx={{ fontSize: 11, color: '#A1887F', mb: 0.6 }}>אפשרויות עץ</Typography>
            {approveTarget?.woodOptions?.length ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                {approveTarget.woodOptions.map((w, i) => (
                  <Chip
                    key={i}
                    size="small"
                    label={`${w.code} — ${w.description}`}
                    sx={{ bgcolor: LIGHT_BG, color: DARK, fontSize: 11 }}
                  />
                ))}
              </Box>
            ) : (
              <Typography sx={{ fontSize: 12, color: '#A1887F' }}>ללא אפשרויות עץ</Typography>
            )}
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 11, color: '#A1887F', mb: 0.6 }}>אפשרויות בד</Typography>
            {approveTarget?.fabricOptions?.length ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                {approveTarget.fabricOptions.map((f, i) => (
                  <Chip
                    key={i}
                    size="small"
                    label={`${f.code} — ${f.description}`}
                    sx={{ bgcolor: '#F5EDE8', color: DARK, fontSize: 11 }}
                  />
                ))}
              </Box>
            ) : (
              <Typography sx={{ fontSize: 12, color: '#A1887F' }}>ללא אפשרויות בד</Typography>
            )}
          </Box>

          <TextField
            label="מחיר סופי (₪)"
            type="number"
            fullWidth
            size="small"
            value={approvePrice}
            onChange={(e) => setApprovePrice(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setApproveTarget(null)} sx={{ color: '#A1887F', fontSize: 12 }}>ביטול</Button>
          <Button variant="contained" disabled={submitLoading || !approvePrice} onClick={handleApproveSubmit}
            sx={{ bgcolor: '#2E7D32', fontSize: 12, borderRadius: 2, '&:hover': { bgcolor: '#1B5E20' } }}>
            {submitLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'אשר מוצר'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isManager && showFabricForm} onClose={() => setShowFabricForm(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: DARK }}>הוספת בד ריפוד חדש</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="שם הבד *"
            size="small"
            fullWidth
            value={newFabricForm.name}
            onChange={(e) => setNewFabricForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label="שם ספק"
            size="small"
            fullWidth
            value={newFabricForm.supplier}
            onChange={(e) => setNewFabricForm((f) => ({ ...f, supplier: e.target.value }))}
          />
          <TextField
            label="תוספת מחיר (₪)"
            size="small"
            fullWidth
            type="number"
            value={newFabricForm.priceDelta}
            onChange={(e) => setNewFabricForm((f) => ({ ...f, priceDelta: e.target.value }))}
          />
          <TextField
            label="כמות התחלתית במלאי"
            size="small"
            fullWidth
            type="number"
            inputProps={{ min: 0 }}
            value={newFabricForm.quantity}
            onChange={(e) => setNewFabricForm((f) => ({ ...f, quantity: e.target.value }))}
          />
          <TextField
            label="תיאור"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={newFabricForm.description}
            onChange={(e) => setNewFabricForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Button component="label" size="small" variant="outlined" startIcon={<UploadIcon />}
            sx={{ width: 'fit-content', fontSize: 11.5, borderRadius: 2 }}>
            {newFabricImageFile ? `תמונה נבחרה: ${newFabricImageFile.name}` : 'העלה תמונה לבד'}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => setNewFabricImageFile(e.target.files?.[0] || null)}
            />
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowFabricForm(false)} sx={{ color: '#A1887F', fontSize: 12 }}>ביטול</Button>
          <Button
            variant="contained"
            disabled={!newFabricForm.name.trim()}
            onClick={handleCreateFabric}
            sx={{ bgcolor: WOOD_COLOR, fontSize: 12, borderRadius: 2, '&:hover': { bgcolor: '#A0522D' } }}
          >
            שמור בד חדש
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={fabricsDialogOpen} onClose={() => setFabricsDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: DARK }}>בדי ריפוד במלאי</DialogTitle>
        <DialogContent dividers>
          {fabricsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={22} sx={{ color: WOOD_COLOR }} />
            </Box>
          ) : fabricProducts.length === 0 ? (
            <Alert severity="info">אין בדי ריפוד זמינים במלאי כרגע</Alert>
          ) : (
            <Grid container spacing={1.5}>
              {fabricProducts.map((f) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={f._id}>
                  <Paper sx={{ p: 1.2, borderRadius: 2, border: `1px solid ${BORDER}`, boxShadow: 'none' }}>
                    <Box sx={{ height: 120, borderRadius: 1.5, overflow: 'hidden', bgcolor: LIGHT_BG, mb: 1 }}>
                      {f.image ? (
                        <img src={`${BASE_URL}${f.image}`} alt={f.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography sx={{ fontSize: 11, color: '#A1887F' }}>אין תמונה</Typography>
                        </Box>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: DARK }}>{f.name}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#8D6E63' }}>קוד: {f.code || '—'}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#2E7D32', fontWeight: 600 }}>
                      במלאי: {f.quantity || 0}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFabricsDialogOpen(false)} sx={{ color: '#A1887F', fontSize: 12 }}>
            סגור
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default CatalogPage;