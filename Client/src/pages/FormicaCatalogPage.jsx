import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Grid, Paper, Alert, CircularProgress, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/Upload';
import API from '../services/api';
import { useFeedbackSnackbar } from '../hooks/useFeedbackSnackbar';
import { validateMaterialForm } from '../utils/materialFormValidation';
import PageHeader from '../components/PageHeader.jsx';

const BASE_URL = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:5001';
const WOOD_COLOR = '#D2691E';
const BORDER = '#E8C9B0';

const emptyForm = { name: '', supplier: '', description: '', priceDelta: '' };

const FormicaCatalogPage = () => {
  const { user } = useSelector((s) => s.auth);
  const isManager = user?.role === 'MANAGER';
  const { showSuccess, showError, FeedbackSnackbar } = useFeedbackSnackbar();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editImageFile, setEditImageFile] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadItems = () => {
    setLoading(true);
    API.get('/formica?limit=500')
      .then((res) => setItems(Array.isArray(res.data) ? res.data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadItems();
  }, []);

  const openEdit = (item) => {
    setEditTarget(item);
    setEditForm({
      name: item.name || '',
      supplier: item.supplier || '',
      description: item.description || '',
      priceDelta: item.priceDelta != null ? String(item.priceDelta) : '',
    });
    setEditImageFile(null);
  };

  const handleSaveEdit = async () => {
    const validationError = validateMaterialForm(editForm, {
      imageFile: editImageFile,
      existingImage: editTarget?.image,
    });
    if (validationError) {
      showError(validationError);
      return;
    }
    const fd = new FormData();
    fd.append('name', editForm.name.trim());
    fd.append('supplier', editForm.supplier.trim());
    fd.append('description', editForm.description.trim());
    fd.append('priceDelta', Number(editForm.priceDelta || 0));
    if (editImageFile) fd.append('image', editImageFile);
    try {
      setSaving(true);
      await API.put(`/formica/${editTarget._id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showSuccess('דגם הפורמייקה עודכן בהצלחה');
      setEditTarget(null);
      loadItems();
    } catch (e) {
      showError(e.response?.data?.error || 'שגיאה בעדכון דגם פורמייקה');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await API.delete(`/formica/${deleteTarget._id}`);
      showSuccess('דגם הפורמייקה נמחק');
      setDeleteTarget(null);
      loadItems();
    } catch (e) {
      showError(e.response?.data?.error || 'שגיאה במחיקת דגם פורמייקה');
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
        title="קטלוג פורמייקה"
        description={isManager ? 'ניהול דגמים, תמונות ומחירון — לשימוש המנהל והמכירות.' : 'צפייה בדגמי פורמייקה לשילוב בהצעות מחיר.'}
      />
      {items.length === 0 ? (
        <Alert severity="info">אין דגמי פורמייקה זמינים כרגע.</Alert>
      ) : (
        <Grid container spacing={2}>
          {items.map((f) => (
            <Grid key={f._id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  position: 'relative',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': { transform: 'translateY(-3px)', boxShadow: 4 },
                }}
              >
                {isManager && (
                  <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => openEdit(f)} sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget(f)} sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
                      <DeleteIcon fontSize="small" color="error" />
                    </IconButton>
                  </Box>
                )}
                <Box sx={{ height: 170, borderRadius: 2, overflow: 'hidden', bgcolor: '#F5F5F5', mb: 1 }}>
                  {f.image ? (
                    <img
                      src={f.image.startsWith('http') ? f.image : `${BASE_URL}${f.image}`}
                      alt={f.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : null}
                </Box>
                <Typography sx={{ fontWeight: 700 }}>{f.name}</Typography>
                <Typography sx={{ fontSize: 12, color: '#7B6A5F' }}>{f.code || 'ללא קוד'}</Typography>
                {f.priceDelta > 0 && (
                  <Typography sx={{ fontSize: 12, color: '#2E7D32' }}>תוספת מחיר: ₪{f.priceDelta}</Typography>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>עריכת דגם פורמייקה</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField label="שם הדגם *" size="small" fullWidth value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField label="שם ספק *" size="small" fullWidth value={editForm.supplier}
            onChange={(e) => setEditForm((f) => ({ ...f, supplier: e.target.value }))} />
          <TextField label="תוספת מחיר (₪) *" size="small" fullWidth type="number" value={editForm.priceDelta}
            onChange={(e) => setEditForm((f) => ({ ...f, priceDelta: e.target.value }))} />
          <TextField label="תיאור *" size="small" fullWidth multiline rows={2} value={editForm.description}
            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
          <Button component="label" size="small" variant="outlined" startIcon={<UploadIcon />}
            sx={{ width: 'fit-content', fontSize: 11.5, borderRadius: 2 }}>
            {editImageFile ? `תמונה נבחרה: ${editImageFile.name}` : 'החלף תמונה'}
            <input type="file" accept="image/*" hidden onChange={(e) => setEditImageFile(e.target.files?.[0] || null)} />
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditTarget(null)}>ביטול</Button>
          <Button variant="contained" disabled={saving} onClick={handleSaveEdit}
            sx={{ bgcolor: WOOD_COLOR, '&:hover': { bgcolor: '#A0522D' } }}>
            {saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'שמור'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: '#8B0000' }}>מחיקת דגם פורמייקה</DialogTitle>
        <DialogContent>
          <Typography>האם למחוק את <strong>{deleteTarget?.name}</strong>?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>ביטול</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>מחק</Button>
        </DialogActions>
      </Dialog>

      <FeedbackSnackbar />
    </Box>
  );
};

export default FormicaCatalogPage;
