import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import API from '../services/api';
import {
  Box, Typography, Grid, Paper, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, IconButton, Tooltip,
  Divider, Alert, Switch, FormControlLabel,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import FilterListOutlinedIcon from '@mui/icons-material/FilterListOutlined';

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
import { useFeedbackSnackbar } from '../hooks/useFeedbackSnackbar';
import PageHeader from '../components/PageHeader.jsx';
import { firstFormError } from '../utils/formFeedback';
import { validateMaterialForm } from '../utils/materialFormValidation';
import { hoursToWeeks } from '../utils/workCalendar';

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
// חייב להיות תואם ל־CATALOG_CATEGORIES שבמודל בשרת.
const PRODUCT_CATEGORIES = ['מיטה', 'ארון', 'שידה', 'ספה', 'שולחן', 'כסא'];
const OTHER_CATEGORY = 'אחר';
const ALL_CATEGORIES = [...PRODUCT_CATEGORIES, OTHER_CATEGORY];

const getProductCategory = (product) => {
  const value = String(product?.category || '').trim();
  return ALL_CATEGORIES.includes(value) ? value : OTHER_CATEGORY;
};

const Field = ({ label, value }) =>
  value ? (
    <Box sx={{ mb: 1, display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 1.5, direction: 'rtl' }}>
      <Typography sx={{ fontSize: 11, color: '#A1887F', flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, color: DARK, flex: 1, textAlign: 'start' }}>{value}</Typography>
    </Box>
  ) : null;

const filterToggleSx = {
  px: 1.5,
  py: 0.45,
  fontSize: 12,
  borderRadius: '8px !important',
  border: `1px solid ${BORDER} !important`,
  color: '#5D4037',
  '&.Mui-selected': {
    bgcolor: `${WOOD_COLOR} !important`,
    color: 'white !important',
    borderColor: `${WOOD_COLOR} !important`,
  },
};

const ManagerToolbarSection = ({ icon, title, children }) => (
  <Paper
    elevation={0}
    sx={{
      p: 1.5,
      borderRadius: 2.5,
      border: `1px solid ${BORDER}`,
      bgcolor: '#FFFBF8',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.2 }}>
      {icon}
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: DARK }}>{title}</Typography>
    </Box>
    {children}
  </Paper>
);

const CatalogPage = () => {
  const dispatch = useDispatch();
  const { showSuccess, showError, FeedbackSnackbar } = useFeedbackSnackbar();
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
  const [managerFilter, setManagerFilter] = useState('ACTIVE');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showFabricForm, setShowFabricForm] = useState(false);
  const [newFabricForm, setNewFabricForm] = useState({
    name: '',
    supplier: '',
    description: '',
    priceDelta: '',
    quantity: '1',
  });
  const [newFabricImageFile, setNewFabricImageFile] = useState(null);
  const [fabricsDialogOpen, setFabricsDialogOpen] = useState(false);
  const [fabricsLoading, setFabricsLoading] = useState(false);
  const [fabricProducts, setFabricProducts] = useState([]);
  const [fabricsCatalogCount, setFabricsCatalogCount] = useState(0);
  const [showFormicaForm, setShowFormicaForm] = useState(false);
  const [newFormicaForm, setNewFormicaForm] = useState({
    name: '',
    supplier: '',
    description: '',
    priceDelta: '',
    quantity: '1',
  });
  const [newFormicaImageFile, setNewFormicaImageFile] = useState(null);
  const [formicasCatalogCount, setFormicasCatalogCount] = useState(0);
  const [formicasDialogOpen, setFormicasDialogOpen] = useState(false);
  const [formicaStockProducts, setFormicaStockProducts] = useState([]);
  const [formicasLoading, setFormicasLoading] = useState(false);
  const [showHandleForm, setShowHandleForm] = useState(false);
  const [newHandleForm, setNewHandleForm] = useState({
    name: '',
    supplier: '',
    description: '',
    priceDelta: '',
    quantity: '1',
  });
  const [newHandleImageFile, setNewHandleImageFile] = useState(null);
  const [handlesCatalogCount, setHandlesCatalogCount] = useState(0);
  const [handlesDialogOpen, setHandlesDialogOpen] = useState(false);
  const [handleProducts, setHandleProducts] = useState([]);
  const [handlesLoading, setHandlesLoading] = useState(false);
  const [materialEdit, setMaterialEdit] = useState(null);
  const [materialEditSaving, setMaterialEditSaving] = useState(false);
  const [assignOrphanProduct, setAssignOrphanProduct] = useState(null);
  const [assignOrphanCarpenterId, setAssignOrphanCarpenterId] = useState('');
  const [assignOrphanLoading, setAssignOrphanLoading] = useState(false);

  const [newForm, setNewForm] = useState({
    name: '', category: '', description: '', carpenterId: '',
  });

  const [editForm, setEditForm] = useState({});
  const [editValidationError, setEditValidationError] = useState('');
  const [createValidationError, setCreateValidationError] = useState('');

  useEffect(() => {
    if (isManager) {
      dispatch(fetchManagerCatalog());
      dispatch(fetchCarpenters());
      API.get('/base-products?isMaterial=true&type=fabric&limit=200')
        .then((res) => setFabricsCatalogCount((res.data || []).length))
        .catch(() => setFabricsCatalogCount(0));
      API.get('/base-products?isMaterial=true&type=formica&limit=200')
        .then((res) => setFormicasCatalogCount((res.data || []).length))
        .catch(() => setFormicasCatalogCount(0));
      API.get('/base-products?isMaterial=true&type=handle&limit=200')
        .then((res) => setHandlesCatalogCount((res.data || []).length))
        .catch(() => setHandlesCatalogCount(0));
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

  const handleDelete = async () => {
    const result = await dispatch(deleteCatalogProduct(deleteConfirm._id));
    setDeleteConfirm(null);
    if (!result.error) showSuccess('המוצר נמחק מהקטלוג');
  };

  const handleApproveOpen = (product) => {
    setApproveTarget(product);
    setApprovePrice(product?.price ? String(product.price) : '');
  };

  const handleApproveSubmit = async () => {
    if (!approveTarget?._id) return;
    if (!approvePrice) {
      showError('יש להזין מחיר לפני אישור המוצר');
      return;
    }
    const result = await dispatch(approveProduct({ productId: approveTarget._id, price: Number(approvePrice) }));
    if (!result.error) {
      setApproveTarget(null);
      setApprovePrice('');
      showSuccess('המוצר התווסף לקטלוג בהצלחה');
    } else {
      showError(firstFormError(result.payload || submitError, 'שגיאה באישור המוצר'));
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
    if (!aiPrompt.trim()) {
      showError('יש להזין תיאור לפני יצירת תמונה עם AI');
      return;
    }
    dispatch(clearCatalogSubmitError());
    dispatch(generateAIImage(aiPrompt));
    setImageFile(null);
  };

  // ✅ תוקן: async/await + carpenterId לא נשלח ב-FormData + בדיקת productId
  const handleCreateSubmit = async () => {
    if (!newForm.name?.trim()) {
      const msg = 'יש להזין שם מוצר';
      setCreateValidationError(msg);
      showError(msg);
      return;
    }
    if (!ALL_CATEGORIES.includes(newForm.category)) {
      const msg = 'יש לבחור קטגוריית מוצר';
      setCreateValidationError(msg);
      showError(msg);
      return;
    }
    if (!imageFile && !generatedImageUrl) {
      const msg = 'חובה להעלות תמונה למוצר (או לייצר תמונה עם AI) — הנגר זקוק לתמונה כדי לאפיין את המוצר';
      setCreateValidationError(msg);
      showError(msg);
      return;
    }
    if (!newForm.carpenterId) {
      const msg = 'יש לבחור נגר לאפיון לפני יצירת המוצר';
      setCreateValidationError(msg);
      showError(msg);
      return;
    }
    setCreateValidationError('');

    const fd = new FormData();
    fd.append('name', newForm.name);
    fd.append('category', newForm.category);
    fd.append('description', newForm.description);
    fd.append('carpenterId', newForm.carpenterId);
    fd.append('needsWoodSelection', false);
    // דרישת בחירת בד נקבעת ע״י הנגר באפיון, לא ע״י המנהל ביצירה.
    if (imageFile) fd.append('image', imageFile);
    else if (generatedImageUrl) fd.append('imageUrl', generatedImageUrl);

    const r = await dispatch(createCatalogProduct(fd));
    if (!r.error) {
      showSuccess('המוצר נוצר ונשלח לנגר לאפיון');
      setShowNewForm(false);
      setNewForm({ name: '', category: '', description: '', carpenterId: '' });
      setImagePreview(null);
      setImageFile(null);
      setAiPrompt('');
      dispatch(clearGeneratedImage());
    } else {
      showError(firstFormError(r.payload || submitError, 'שגיאה ביצירת המוצר'));
    }
  };

  const handleAssignOrphanSubmit = async () => {
    if (!assignOrphanProduct?._id || !assignOrphanCarpenterId) {
      showError('יש לבחור נגר');
      return;
    }
    setAssignOrphanLoading(true);
    const r = await dispatch(assignCarpenterForCharacterization({
      productId: assignOrphanProduct._id,
      carpenterId: assignOrphanCarpenterId,
    }));
    setAssignOrphanLoading(false);
    if (!r.error) {
      showSuccess('הנגר שויך והמוצר נשלח לאפיון');
      setAssignOrphanProduct(null);
      setAssignOrphanCarpenterId('');
    } else {
      showError(firstFormError(r.payload, 'שגיאה בשיוך נגר'));
    }
  };

  const handleEditOpen = (p) => {
    dispatch(clearCatalogSubmitError());
    setEditValidationError('');
    setEditProduct(p);
    setEditForm({
      category: ALL_CATEGORIES.includes(p.category) ? p.category : OTHER_CATEGORY,
      description: p.description || '',
      price: p.price || '',
      needsFabricSelection: p.needsFabricSelection || false,
      needsFormicaSelection: p.needsFormicaSelection || false,
      fabricQuantityPerUnit:
        p.needsFabricSelection && Number(p.fabricQuantityPerUnit) > 0
          ? String(p.fabricQuantityPerUnit)
          : '',
      formicaQuantityPerUnit:
        p.needsFormicaSelection && Number(p.formicaQuantityPerUnit) > 0
          ? String(p.formicaQuantityPerUnit)
          : '',
      needsHandleSelection: p.needsHandleSelection || false,
      handleQuantityPerUnit:
        p.needsHandleSelection && Number(p.handleQuantityPerUnit) > 0
          ? String(p.handleQuantityPerUnit)
          : '',
    });
    // ✅ תוקן: BASE_URL במקום localhost:5000
    setImagePreview(p.image ? `${BASE_URL}${p.image}` : null);
    setImageFile(null);
  };

  const handleEditSubmit = () => {
    const needsFabric = editForm.needsFabricSelection === true;
    const fabricQtyNumber = Number(editForm.fabricQuantityPerUnit);
    if (needsFabric && (!Number.isFinite(fabricQtyNumber) || fabricQtyNumber <= 0)) {
      const msg = 'כשמסומן "דורש בחירת בד" יש להזין כמות בד נדרשת ליחידה (במטרים, גדולה מ־0)';
      setEditValidationError(msg);
      showError(msg);
      return;
    }
    const needsFormica = editForm.needsFormicaSelection === true;
    const formicaQtyNumber = Number(editForm.formicaQuantityPerUnit);
    if (needsFormica && (!Number.isFinite(formicaQtyNumber) || formicaQtyNumber <= 0)) {
      const msg = 'כשמסומן "דורש בחירת פורמייקה" יש להזין כמות פורמייקה נדרשת ליחידה (גדולה מ־0)';
      setEditValidationError(msg);
      showError(msg);
      return;
    }
    const needsHandle = editForm.needsHandleSelection === true;
    const handleQtyNumber = Number(editForm.handleQuantityPerUnit);
    if (needsHandle && (!Number.isFinite(handleQtyNumber) || handleQtyNumber <= 0)) {
      const msg = 'כשמסומן "דורש בחירת ידית" יש להזין כמות ידיות נדרשת ליחידה (גדולה מ־0)';
      setEditValidationError(msg);
      showError(msg);
      return;
    }
    if (!ALL_CATEGORIES.includes(editForm.category)) {
      const msg = 'יש לבחור קטגוריית מוצר חוקית';
      setEditValidationError(msg);
      showError(msg);
      return;
    }
    setEditValidationError('');
    const fd = new FormData();
    fd.append('category', editForm.category);
    fd.append('description', editForm.description || '');
    if (editForm.price !== '' && editForm.price != null) fd.append('price', editForm.price);
    fd.append('needsFabricSelection', String(needsFabric));
    fd.append('fabricQuantityPerUnit', String(needsFabric ? fabricQtyNumber : 0));
    fd.append('needsFormicaSelection', String(editForm.needsFormicaSelection === true));
    fd.append('formicaQuantityPerUnit', String(needsFormica ? formicaQtyNumber : 0));
    fd.append('needsHandleSelection', String(editForm.needsHandleSelection === true));
    fd.append('handleQuantityPerUnit', String(needsHandle ? handleQtyNumber : 0));
    fd.append('needsWoodSelection', 'false');
    if (imageFile) fd.append('image', imageFile);
    dispatch(updateCatalogProduct({ productId: editProduct._id, formData: fd })).then((r) => {
      if (!r.error) {
        setEditProduct(null);
        setImagePreview(null);
        setImageFile(null);
        setEditValidationError('');
        showSuccess('פרטי המוצר עודכנו בהצלחה');
      } else {
        showError(firstFormError(r.payload || submitError, 'שגיאה בעדכון המוצר'));
      }
    });
  };

  const handleCreateFabric = async () => {
    const validationError = validateMaterialForm(newFabricForm, {
      imageFile: newFabricImageFile,
      existingImage: null,
    });
    if (validationError) {
      showError(validationError);
      return;
    }
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
      showSuccess(`בד נוסף בהצלחה. מספר הדגם: ${created.code}`);
      setShowFabricForm(false);
      setNewFabricForm({ name: '', supplier: '', description: '', priceDelta: '', quantity: '1' });
      setNewFabricImageFile(null);
      API.get('/base-products?isMaterial=true&type=fabric&limit=200')
        .then((countRes) => setFabricsCatalogCount((countRes.data || []).length))
        .catch(() => {});
    } catch (e) {
      const msg = e.response?.data?.error || 'שגיאה בהוספת בד חדש';
      showError(msg);
    }
  };

  const handleCreateFormica = async () => {
    const validationError = validateMaterialForm(newFormicaForm, {
      imageFile: newFormicaImageFile,
      existingImage: null,
    });
    if (validationError) {
      showError(validationError);
      return;
    }
    const fd = new FormData();
    fd.append('name', newFormicaForm.name.trim());
    fd.append('supplier', newFormicaForm.supplier.trim());
    fd.append('description', newFormicaForm.description.trim());
    fd.append('priceDelta', Number(newFormicaForm.priceDelta || 0));
    fd.append('quantity', Number(newFormicaForm.quantity || 0));
    if (newFormicaImageFile) fd.append('image', newFormicaImageFile);
    try {
      const res = await API.post('/formica', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const created = res.data;
      showSuccess(`דגם פורמייקה נוסף בהצלחה. מספר הדגם: ${created.code}`);
      setShowFormicaForm(false);
      setNewFormicaForm({ name: '', supplier: '', description: '', priceDelta: '', quantity: '1' });
      setNewFormicaImageFile(null);
      API.get('/base-products?isMaterial=true&type=formica&limit=200')
        .then((countRes) => setFormicasCatalogCount((countRes.data || []).length))
        .catch(() => {});
    } catch (e) {
      const msg = e.response?.data?.error || 'שגיאה בהוספת דגם פורמייקה חדש';
      showError(msg);
    }
  };

  const handleShowFormicasInStock = async () => {
    try {
      setFormicasLoading(true);
      const res = await API.get('/base-products?isMaterial=true&type=formica&limit=500');
      setFormicaStockProducts(Array.isArray(res.data) ? res.data : []);
      setFormicasDialogOpen(true);
    } catch {
      setFormicaStockProducts([]);
      setFormicasDialogOpen(true);
    } finally {
      setFormicasLoading(false);
    }
  };

  const handleCreateHandle = async () => {
    const validationError = validateMaterialForm(newHandleForm, {
      imageFile: newHandleImageFile,
      existingImage: null,
    });
    if (validationError) {
      showError(validationError);
      return;
    }
    const fd = new FormData();
    fd.append('name', newHandleForm.name.trim());
    fd.append('unit', 'יח׳');
    fd.append('supplier', newHandleForm.supplier.trim());
    fd.append('description', newHandleForm.description.trim());
    fd.append('priceDelta', Number(newHandleForm.priceDelta || 0));
    fd.append('isMaterial', 'true');
    fd.append('materialType', 'handle');
    fd.append('quantity', Number(newHandleForm.quantity || 0));
    fd.append('minStock', 1);
    fd.append('reorderQuantity', 10);
    if (newHandleImageFile) fd.append('image', newHandleImageFile);
    try {
      const res = await API.post('/warehouse/base-products', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const created = res.data;
      showSuccess(`ידית נוספה בהצלחה. מספר הדגם: ${created.code}`);
      setShowHandleForm(false);
      setNewHandleForm({ name: '', supplier: '', description: '', priceDelta: '', quantity: '1' });
      setNewHandleImageFile(null);
      API.get('/base-products?isMaterial=true&type=handle&limit=200')
        .then((countRes) => setHandlesCatalogCount((countRes.data || []).length))
        .catch(() => {});
    } catch (e) {
      const msg = e.response?.data?.error || 'שגיאה בהוספת ידית חדשה';
      showError(msg);
    }
  };

  const handleShowHandlesInStock = async () => {
    try {
      setHandlesLoading(true);
      const res = await API.get('/base-products?isMaterial=true&type=handle&limit=500');
      setHandleProducts(Array.isArray(res.data) ? res.data : []);
      setHandlesDialogOpen(true);
    } catch {
      setHandleProducts([]);
      setHandlesDialogOpen(true);
    } finally {
      setHandlesLoading(false);
    }
  };

  const handleShowFabricsInStock = async () => {
    try {
      setFabricsLoading(true);
      const res = await API.get('/base-products?isMaterial=true&type=fabric&limit=500');
      setFabricProducts(Array.isArray(res.data) ? res.data : []);
      setFabricsDialogOpen(true);
    } catch {
      setFabricProducts([]);
      setFabricsDialogOpen(true);
    } finally {
      setFabricsLoading(false);
    }
  };

  const openMaterialEdit = (type, item) => {
    setMaterialEdit({
      type,
      item,
      form: {
        name: item.name || '',
        supplier: item.supplier || '',
        description: item.description || '',
        priceDelta: item.priceDelta != null ? String(item.priceDelta) : '',
      },
      imageFile: null,
    });
  };

  const refreshMaterialCounts = () => {
    API.get('/base-products?isMaterial=true&type=fabric&limit=200')
      .then((res) => setFabricsCatalogCount((res.data || []).length))
      .catch(() => {});
    API.get('/base-products?isMaterial=true&type=formica&limit=200')
      .then((res) => setFormicasCatalogCount((res.data || []).length))
      .catch(() => {});
    API.get('/base-products?isMaterial=true&type=handle&limit=200')
      .then((res) => setHandlesCatalogCount((res.data || []).length))
      .catch(() => {});
  };

  const handleSaveMaterialEdit = async () => {
    if (!materialEdit) return;
    const validationError = validateMaterialForm(materialEdit.form, {
      imageFile: materialEdit.imageFile,
      existingImage: materialEdit.item?.image,
    });
    if (validationError) {
      showError(validationError);
      return;
    }
    const fd = new FormData();
    fd.append('name', materialEdit.form.name.trim());
    fd.append('supplier', materialEdit.form.supplier.trim());
    fd.append('description', materialEdit.form.description.trim());
    fd.append('priceDelta', Number(materialEdit.form.priceDelta || 0));
    if (materialEdit.imageFile) fd.append('image', materialEdit.imageFile);
    try {
      setMaterialEditSaving(true);
      if (materialEdit.type === 'formica' && materialEdit.item?.formicaModelId) {
        const ffd = new FormData();
        ffd.append('name', materialEdit.form.name.trim());
        ffd.append('supplier', materialEdit.form.supplier.trim());
        ffd.append('description', materialEdit.form.description.trim());
        ffd.append('priceDelta', Number(materialEdit.form.priceDelta || 0));
        if (materialEdit.imageFile) ffd.append('image', materialEdit.imageFile);
        await API.put(`/formica/${materialEdit.item.formicaModelId}`, ffd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      await API.put(`/warehouse/base-products/${materialEdit.item._id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showSuccess('הפריט עודכן בהצלחה');
      setMaterialEdit(null);
      refreshMaterialCounts();
      if (fabricsDialogOpen) handleShowFabricsInStock();
      if (formicasDialogOpen) handleShowFormicasInStock();
      if (handlesDialogOpen) handleShowHandlesInStock();
    } catch (e) {
      showError(e.response?.data?.error || 'שגיאה בעדכון הפריט');
    } finally {
      setMaterialEditSaving(false);
    }
  };

  const materialTypeLabel = { fabric: 'בד ריפוד', formica: 'פורמייקה', handle: 'ידית' };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress sx={{ color: WOOD_COLOR }} />
    </Box>
  );

  const visibleProducts = isManager
    ? products.filter((p) => managerFilter === 'ALL' ? true : p.status === managerFilter)
    : products;

  const filteredByCategoryProducts = visibleProducts.filter((p) =>
    categoryFilter === 'ALL' ? true : getProductCategory(p) === categoryFilter
  );

  const statusCounts = {
    PENDING_CHARACTERIZATION: products.filter((p) => p.status === 'PENDING_CHARACTERIZATION').length,
    WAITING_ADMIN_APPROVAL: products.filter((p) => p.status === 'WAITING_ADMIN_APPROVAL').length,
    ACTIVE: products.filter((p) => p.status === 'ACTIVE').length,
  };
  const categoryCounts = {
    ALL: visibleProducts.length,
    ...PRODUCT_CATEGORIES.reduce((acc, c) => {
      acc[c] = visibleProducts.filter((p) => getProductCategory(p) === c).length;
      return acc;
    }, {}),
    אחר: visibleProducts.filter((p) => getProductCategory(p) === OTHER_CATEGORY).length,
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', mx: 'auto', boxSizing: 'border-box', direction: 'rtl' }}>
      <PageHeader
        title="קטלוג מוצרים"
        description={isManager ? 'ניהול מוצרים, אפיון, אישורים וספריית חומרים לפי סטטוס וקטגוריה.' : undefined}
        action={
          isManager ? (
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setShowNewForm(true)}>
              מוצר חדש
            </Button>
          ) : null
        }
      />

      {isManager && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2.5 }}>
          <ManagerToolbarSection
            icon={<FilterListOutlinedIcon sx={{ fontSize: 18, color: WOOD_COLOR }} />}
            title="סטטוס מוצר"
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={managerFilter}
              onChange={(_, value) => value && setManagerFilter(value)}
              sx={{ flexWrap: 'wrap', gap: 0.8 }}
            >
              <ToggleButton value="ALL" sx={filterToggleSx}>הכל ({products.length})</ToggleButton>
              <ToggleButton value="PENDING_CHARACTERIZATION" sx={filterToggleSx}>
                באפיון ({statusCounts.PENDING_CHARACTERIZATION})
              </ToggleButton>
              <ToggleButton value="WAITING_ADMIN_APPROVAL" sx={filterToggleSx}>
                ממתינים לאישור ({statusCounts.WAITING_ADMIN_APPROVAL})
              </ToggleButton>
              <ToggleButton value="ACTIVE" sx={filterToggleSx}>
                פעילים ({statusCounts.ACTIVE})
              </ToggleButton>
            </ToggleButtonGroup>
          </ManagerToolbarSection>

          <ManagerToolbarSection
            icon={<CategoryOutlinedIcon sx={{ fontSize: 18, color: WOOD_COLOR }} />}
            title="קטגוריית מוצר"
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={categoryFilter}
              onChange={(_, value) => value && setCategoryFilter(value)}
              sx={{ flexWrap: 'wrap', gap: 0.8 }}
            >
              <ToggleButton value="ALL" sx={filterToggleSx}>הכל ({categoryCounts.ALL})</ToggleButton>
              {PRODUCT_CATEGORIES.map((cat) => (
                <ToggleButton key={cat} value={cat} sx={filterToggleSx}>
                  {cat} ({categoryCounts[cat] || 0})
                </ToggleButton>
              ))}
              <ToggleButton value="אחר" sx={filterToggleSx}>
                אחר ({categoryCounts['אחר'] || 0})
              </ToggleButton>
            </ToggleButtonGroup>
          </ManagerToolbarSection>

          <ManagerToolbarSection
            icon={<Inventory2OutlinedIcon sx={{ fontSize: 18, color: WOOD_COLOR }} />}
            title="ספריית חומרים"
          >
            <Grid container spacing={1.2}>
              {[
                {
                  key: 'fabric',
                  label: 'בדי ריפוד',
                  count: fabricsCatalogCount,
                  onView: handleShowFabricsInStock,
                  onAdd: () => setShowFabricForm(true),
                },
                {
                  key: 'formica',
                  label: 'פורמייקות',
                  count: formicasCatalogCount,
                  onView: handleShowFormicasInStock,
                  onAdd: () => setShowFormicaForm(true),
                },
                {
                  key: 'handle',
                  label: 'ידיות',
                  count: handlesCatalogCount,
                  onView: handleShowHandlesInStock,
                  onAdd: () => setShowHandleForm(true),
                },
              ].map((item) => (
                <Grid key={item.key} size={{ xs: 12, md: 4 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      p: 1.2,
                      borderRadius: 2,
                      border: `1px solid ${BORDER}`,
                      bgcolor: 'white',
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: DARK }}>{item.label}</Typography>
                      <Typography sx={{ fontSize: 11, color: '#A1887F' }}>{item.count} פריטים בקטלוג</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.8, flexShrink: 0 }}>
                      <Button size="small" variant="outlined" onClick={item.onView}
                        sx={{ fontSize: 11, borderRadius: 1.5, borderColor: BORDER, color: '#5D4037', minWidth: 64 }}>
                        צפייה
                      </Button>
                      <Button size="small" variant="contained" startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                        onClick={item.onAdd}
                        sx={{ fontSize: 11, borderRadius: 1.5, bgcolor: '#6D4C41', '&:hover': { bgcolor: '#4E342E' } }}>
                        הוסף
                      </Button>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </ManagerToolbarSection>
        </Box>
      )}

      {!isManager && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            size="small"
            variant={categoryFilter === 'ALL' ? 'contained' : 'outlined'}
            onClick={() => setCategoryFilter('ALL')}
            sx={{ fontSize: 11.5, borderRadius: 2 }}
          >
            הכל ({categoryCounts.ALL})
          </Button>
          {PRODUCT_CATEGORIES.map((cat) => (
            <Button
              key={cat}
              size="small"
              variant={categoryFilter === cat ? 'contained' : 'outlined'}
              onClick={() => setCategoryFilter(cat)}
              sx={{ fontSize: 11.5, borderRadius: 2 }}
            >
              {cat} ({categoryCounts[cat] || 0})
            </Button>
          ))}
          <Button
            size="small"
            variant={categoryFilter === 'אחר' ? 'contained' : 'outlined'}
            onClick={() => setCategoryFilter('אחר')}
            sx={{ fontSize: 11.5, borderRadius: 2 }}
          >
            אחר ({categoryCounts['אחר'] || 0})
          </Button>
        </Box>
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

      {filteredByCategoryProducts.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          {isManager && managerFilter === 'PENDING_CHARACTERIZATION' && categoryFilter === 'ALL'
            ? 'אין מוצרים לאפיון'
            : isManager && managerFilter === 'WAITING_ADMIN_APPROVAL' && categoryFilter === 'ALL'
              ? 'אין מוצרים הממתינים לאישור'
              : isManager && managerFilter === 'ACTIVE' && categoryFilter === 'ALL'
                ? 'אין מוצרים פעילים'
                : 'אין מוצרים להצגה בקטגוריה שנבחרה'}
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {filteredByCategoryProducts.map(p => (
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
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
                  {isManager && p.status === 'PENDING_CHARACTERIZATION' && !p.assignedCarpenter && (
                    <Alert severity="warning" sx={{ mt: 1, py: 0, fontSize: 11.5 }}>
                      לא שויך נגר — יש לשייך לפני שהנגר יוכל לאפיין
                    </Alert>
                  )}
                  {isManager && p.status === 'PENDING_CHARACTERIZATION' && !p.assignedCarpenter && (
                    <Button
                      size="small"
                      fullWidth
                      variant="contained"
                      sx={{ mt: 1, bgcolor: '#A0522D', '&:hover': { bgcolor: '#8B4513' }, fontSize: 11.5 }}
                      onClick={() => {
                        setAssignOrphanProduct(p);
                        setAssignOrphanCarpenterId('');
                      }}
                    >
                      שיוך נגר לאפיון
                    </Button>
                  )}
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
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </Box>
            )}
            <Field label="קטגוריה" value={getProductCategory(detailProduct)} />
            <Field label="תיאור" value={detailProduct.description} />
            <Field label="מחיר" value={detailProduct.price ? `₪${detailProduct.price.toLocaleString()}` : null} />
            <Field label="זמן עבודה משוער" value={detailProduct.estimatedWorkTime ? `${detailProduct.estimatedWorkTime} שעות` : null} />
            <Field label="נדרש בחירת עץ" value={detailProduct.needsWoodSelection ? 'כן' : 'לא'} />
            <Field label="נדרש בחירת בד" value={detailProduct.needsFabricSelection ? 'כן' : 'לא'} />
            {detailProduct.needsFabricSelection && (
              <Field
                label="כמות בד ליחידה (מ׳)"
                value={detailProduct.fabricQuantityPerUnit || '—'}
              />
            )}
            <Field label="נדרש בחירת פורמייקה" value={detailProduct.needsFormicaSelection ? 'כן' : 'לא'} />
            {detailProduct.needsFormicaSelection && (
              <Field
                label="כמות פורמייקה ליחידה (מ״ר)"
                value={detailProduct.formicaQuantityPerUnit || '—'}
              />
            )}
            <Field label="נדרש בחירת ידית" value={detailProduct.needsHandleSelection ? 'כן' : 'לא'} />
            {detailProduct.needsHandleSelection && (
              <Field
                label="כמות ידיות ליחידה"
                value={detailProduct.handleQuantityPerUnit || '—'}
              />
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDetailProduct(null)} sx={{ color: '#A1887F', fontSize: 12 }}>סגור</Button>
          </DialogActions>
        </>}
      </Dialog>

      {/* דיאלוג מוצר חדש */}
      <Dialog open={isManager && showNewForm} onClose={() => { setShowNewForm(false); setCreateValidationError(''); }} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: DARK, display: 'flex', justifyContent: 'space-between' }}>
          מוצר חדש
          <IconButton size="small" onClick={() => { setShowNewForm(false); setCreateValidationError(''); }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {createValidationError && (
            <Alert severity="warning" sx={{ fontSize: 12 }} onClose={() => setCreateValidationError('')}>
              {createValidationError}
            </Alert>
          )}
          <TextField label="שם מוצר *" size="small" fullWidth value={newForm.name}
            onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
          <TextField select label="קטגוריה *" size="small" fullWidth
            value={newForm.category}
            onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
            SelectProps={{ native: true }}
            helperText="הקטגוריה משמשת לסינון בקטלוג ובחירת סוג בטופס ההזמנה">
            <option value="">— בחר קטגוריה —</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </TextField>
          <TextField label="תיאור" size="small" fullWidth multiline rows={2} value={newForm.description}
            onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} />
          <Box>
            <Typography sx={{ fontSize: 12, color: '#A1887F', mb: 1 }}>
              תמונה * <Box component="span" sx={{ color: '#8B0000', fontSize: 11 }}>(חובה — הנגר זקוק לתמונה לאפיון)</Box>
            </Typography>
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
                <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </Box>
            )}
          </Box>
          <TextField select label="שיוך נגר לאפיון *" size="small" fullWidth required
            value={newForm.carpenterId}
            onChange={e => setNewForm(f => ({ ...f, carpenterId: e.target.value }))}
            SelectProps={{ native: true }}>
            <option value="">— בחר נגר —</option>
            {carpenters.map(c => (
              <option key={c._id} value={c._id}>{c.fullName || c.username}</option>
            ))}
          </TextField>
          <Alert severity="info" sx={{ fontSize: 11.5 }}>
            דרישת בחירת בד וכמות הבד הנדרשת ליחידה ייקבעו על־ידי הנגר בשלב האפיון.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowNewForm(false)} sx={{ color: '#A1887F', fontSize: 12 }}>ביטול</Button>
          <Button variant="contained"
            disabled={submitLoading || !newForm.name || !newForm.category || !newForm.carpenterId || (!imageFile && !generatedImageUrl)}
            onClick={handleCreateSubmit}
            sx={{ bgcolor: WOOD_COLOR, fontSize: 12, borderRadius: 2, '&:hover': { bgcolor: '#A0522D' } }}>
            {submitLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'שלח לאפיון'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* שיוך נגר למוצר ללא נגר */}
      <Dialog
        open={isManager && !!assignOrphanProduct}
        onClose={() => { if (!assignOrphanLoading) { setAssignOrphanProduct(null); setAssignOrphanCarpenterId(''); } }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: DARK }}>
          שיוך נגר: {assignOrphanProduct?.name}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <Typography sx={{ fontSize: 12, color: '#A1887F', mb: 2 }}>
            למוצר זה לא שויך נגר. בחר נגר כדי שיוכל לקבל את המוצר לאפיון.
          </Typography>
          <TextField
            select
            label="נגר לאפיון *"
            size="small"
            fullWidth
            required
            value={assignOrphanCarpenterId}
            onChange={(e) => setAssignOrphanCarpenterId(e.target.value)}
            SelectProps={{ native: true }}
          >
            <option value="">— בחר נגר —</option>
            {carpenters.map((c) => (
              <option key={c._id} value={c._id}>{c.fullName || c.username}</option>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => { setAssignOrphanProduct(null); setAssignOrphanCarpenterId(''); }}
            disabled={assignOrphanLoading}
            sx={{ color: '#A1887F', fontSize: 12 }}
          >
            ביטול
          </Button>
          <Button
            variant="contained"
            disabled={assignOrphanLoading || !assignOrphanCarpenterId}
            onClick={handleAssignOrphanSubmit}
            sx={{ bgcolor: WOOD_COLOR, fontSize: 12, borderRadius: 2, '&:hover': { bgcolor: '#A0522D' } }}
          >
            {assignOrphanLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'שייך נגר'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* דיאלוג עריכה */}
      <Dialog open={isManager && !!editProduct} onClose={() => { setEditProduct(null); setEditValidationError(''); }} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: DARK, display: 'flex', justifyContent: 'space-between' }}>
          עריכת מוצר: {editProduct?.name}
          <IconButton size="small" onClick={() => { dispatch(clearCatalogSubmitError()); setEditValidationError(''); setEditProduct(null); }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {submitError && (
            <Alert severity="error" sx={{ fontSize: 12 }} onClose={() => dispatch(clearCatalogSubmitError())}>
              {typeof submitError === 'string' ? submitError : 'שגיאה בשמירה'}
            </Alert>
          )}
          {editValidationError && (
            <Alert severity="warning" sx={{ fontSize: 12 }} onClose={() => setEditValidationError('')}>
              {editValidationError}
            </Alert>
          )}
          <Typography sx={{ fontSize: 11, color: '#A1887F' }}>
            ניתן לערוך קטגוריה, תיאור, מחיר, תמונה, ודרישת בחירת בד בלבד. שם המוצר וזמן העבודה נקבעים באפיון.
          </Typography>
          <TextField select label="קטגוריה *" size="small" fullWidth
            value={editForm.category || ''}
            onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
            SelectProps={{ native: true }}>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </TextField>
          <TextField label="תיאור" size="small" fullWidth multiline rows={2} value={editForm.description || ''}
            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
          <TextField label="מחיר (₪)" size="small" type="number" fullWidth value={editForm.price || ''}
            onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
          <Box>
            <Typography sx={{ fontSize: 12, color: '#A1887F', mb: 1 }}>תמונה</Typography>
            <Button component="label" size="small" variant="outlined" startIcon={<UploadIcon />}
              sx={{ fontSize: 11, borderColor: BORDER, color: '#5D4037', borderRadius: 2, mb: 1 }}>
              החלף תמונה
              <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
            </Button>
            {imagePreview && (
              <Box sx={{ borderRadius: 2, overflow: 'hidden', height: 140, border: `1px solid ${BORDER}` }}>
                <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </Box>
            )}
          </Box>
          <Divider />
          <Box sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${BORDER}`, bgcolor: '#FFFBF8', display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <Typography sx={{ fontWeight: 700, color: DARK, fontSize: 13 }}>בחירת בד ע״י הלקוח</Typography>
            <FormControlLabel
              control={<Switch checked={editForm.needsFabricSelection || false}
                onChange={e => setEditForm(f => ({
                  ...f,
                  needsFabricSelection: e.target.checked,
                  fabricQuantityPerUnit: e.target.checked ? f.fabricQuantityPerUnit : '',
                }))} />}
              label={
                <Typography sx={{ fontSize: 13 }}>
                  האם המוצר דורש בחירת בד?{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: editForm.needsFabricSelection ? '#2E7D32' : '#8B0000' }}>
                    {editForm.needsFabricSelection ? 'כן — דורש בחירת בד' : 'לא — לא דורש בחירת בד'}
                  </Box>
                </Typography>
              }
            />
            {editForm.needsFabricSelection && (
              <TextField
                label="כמות בד נדרשת ליחידה (במטרים)"
                size="small"
                type="number"
                inputProps={{ min: 0, step: 0.1 }}
                value={editForm.fabricQuantityPerUnit || ''}
                onChange={e => setEditForm(f => ({ ...f, fabricQuantityPerUnit: e.target.value }))}
                helperText="כמה מטרים של בד צורך מוצר אחד"
              />
            )}
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${BORDER}`, bgcolor: '#FFFBF8', display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <Typography sx={{ fontWeight: 700, color: DARK, fontSize: 13 }}>בחירת פורמייקה ע״י הלקוח</Typography>
            <FormControlLabel
              control={<Switch checked={editForm.needsFormicaSelection || false}
                onChange={e => setEditForm(f => ({
                  ...f,
                  needsFormicaSelection: e.target.checked,
                  formicaQuantityPerUnit: e.target.checked ? f.formicaQuantityPerUnit : '',
                }))} />}
              label={
                <Typography sx={{ fontSize: 13 }}>
                  האם המוצר דורש בחירת פורמייקה?{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: editForm.needsFormicaSelection ? '#2E7D32' : '#8B0000' }}>
                    {editForm.needsFormicaSelection ? 'כן — דורש בחירת פורמייקה' : 'לא — לא דורש בחירת פורמייקה'}
                  </Box>
                </Typography>
              }
            />
            {editForm.needsFormicaSelection && (
              <TextField
                label="כמות פורמייקה נדרשת ליחידה (במ״ר)"
                size="small"
                type="number"
                inputProps={{ min: 0, step: 0.1 }}
                value={editForm.formicaQuantityPerUnit || ''}
                onChange={e => setEditForm(f => ({ ...f, formicaQuantityPerUnit: e.target.value }))}
                helperText="כמה מ״ר פורמייקה צורך מוצר אחד"
              />
            )}
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${BORDER}`, bgcolor: '#FFFBF8', display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <Typography sx={{ fontWeight: 700, color: DARK, fontSize: 13 }}>בחירת ידית ע״י הלקוח</Typography>
            <FormControlLabel
              control={<Switch checked={editForm.needsHandleSelection || false}
                onChange={e => setEditForm(f => ({
                  ...f,
                  needsHandleSelection: e.target.checked,
                  handleQuantityPerUnit: e.target.checked ? f.handleQuantityPerUnit : '',
                }))} />}
              label={
                <Typography sx={{ fontSize: 13 }}>
                  האם המוצר דורש בחירת ידית?{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: editForm.needsHandleSelection ? '#2E7D32' : '#8B0000' }}>
                    {editForm.needsHandleSelection ? 'כן — דורש בחירת ידית' : 'לא — לא דורש בחירת ידית'}
                  </Box>
                </Typography>
              }
            />
            {editForm.needsHandleSelection && (
              <TextField
                label="כמות ידיות נדרשת ליחידה"
                size="small"
                type="number"
                inputProps={{ min: 0, step: 1 }}
                value={editForm.handleQuantityPerUnit || ''}
                onChange={e => setEditForm(f => ({ ...f, handleQuantityPerUnit: e.target.value }))}
                helperText="כמה ידיות צורך מוצר אחד"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { dispatch(clearCatalogSubmitError()); setEditValidationError(''); setEditProduct(null); }} sx={{ color: '#A1887F', fontSize: 12 }}>ביטול</Button>
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
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>
          )}
          <Field label="תיאור מנהל" value={approveTarget?.description} />
          <Field label="נגר מאפיין" value={approveTarget?.assignedCarpenter?.fullName} />
          <Field
            label="זמן עבודה משוער"
            value={approveTarget?.estimatedWorkTime
              ? `${hoursToWeeks(approveTarget.estimatedWorkTime).toFixed(1)} שבועות (${approveTarget.estimatedWorkTime} שעות, 4 שעות ליום)`
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
          {approveTarget?.needsFabricSelection && (
            <Field
              label="כמות בד ליחידה (מ׳)"
              value={approveTarget?.fabricQuantityPerUnit || '—'}
            />
          )}
          <Field
            label="נדרש בחירת פורמייקה"
            value={approveTarget?.needsFormicaSelection ? 'כן' : 'לא'}
          />
          {approveTarget?.needsFormicaSelection && (
            <Field
              label="כמות פורמייקה ליחידה (מ״ר)"
              value={approveTarget?.formicaQuantityPerUnit || '—'}
            />
          )}
          <Field
            label="נדרש בחירת ידית"
            value={approveTarget?.needsHandleSelection ? 'כן' : 'לא'}
          />
          {approveTarget?.needsHandleSelection && (
            <Field
              label="כמות ידיות ליחידה"
              value={approveTarget?.handleQuantityPerUnit || '—'}
            />
          )}

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
            label="שם ספק *"
            size="small"
            fullWidth
            value={newFabricForm.supplier}
            onChange={(e) => setNewFabricForm((f) => ({ ...f, supplier: e.target.value }))}
          />
          <TextField
            label="תוספת מחיר (₪) *"
            size="small"
            fullWidth
            type="number"
            value={newFabricForm.priceDelta}
            onChange={(e) => setNewFabricForm((f) => ({ ...f, priceDelta: e.target.value }))}
          />
          <TextField
            label="כמות לאספקה ראשונית"
            size="small"
            fullWidth
            type="number"
            inputProps={{ min: 0 }}
            value={newFabricForm.quantity}
            onChange={(e) => setNewFabricForm((f) => ({ ...f, quantity: e.target.value }))}
          />
          <TextField
            label="תיאור *"
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

      <Dialog open={isManager && showFormicaForm} onClose={() => setShowFormicaForm(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: DARK }}>הוספת דגם פורמייקה חדש</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField label="שם הדגם *" size="small" fullWidth value={newFormicaForm.name}
            onChange={(e) => setNewFormicaForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField label="שם ספק *" size="small" fullWidth value={newFormicaForm.supplier}
            onChange={(e) => setNewFormicaForm((f) => ({ ...f, supplier: e.target.value }))} />
          <TextField label="תוספת מחיר (₪) *" size="small" fullWidth type="number" value={newFormicaForm.priceDelta}
            onChange={(e) => setNewFormicaForm((f) => ({ ...f, priceDelta: e.target.value }))} />
          <TextField label="כמות לאספקה ראשונית" size="small" fullWidth type="number"
            inputProps={{ min: 0 }} value={newFormicaForm.quantity}
            onChange={(e) => setNewFormicaForm((f) => ({ ...f, quantity: e.target.value }))} />
          <TextField label="תיאור *" size="small" fullWidth multiline rows={2} value={newFormicaForm.description}
            onChange={(e) => setNewFormicaForm((f) => ({ ...f, description: e.target.value }))} />
          <Button component="label" size="small" variant="outlined" startIcon={<UploadIcon />}
            sx={{ width: 'fit-content', fontSize: 11.5, borderRadius: 2 }}>
            {newFormicaImageFile ? `תמונה נבחרה: ${newFormicaImageFile.name}` : 'העלה תמונה לדגם'}
            <input type="file" accept="image/*" hidden
              onChange={(e) => setNewFormicaImageFile(e.target.files?.[0] || null)} />
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowFormicaForm(false)} sx={{ color: '#A1887F', fontSize: 12 }}>ביטול</Button>
          <Button variant="contained" disabled={!newFormicaForm.name.trim()} onClick={handleCreateFormica}
            sx={{ bgcolor: '#5D4037', fontSize: 12, borderRadius: 2, '&:hover': { bgcolor: '#3E2723' } }}>
            שמור דגם פורמייקה
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isManager && showHandleForm} onClose={() => setShowHandleForm(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: DARK }}>הוספת ידית חדשה</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField label="שם הידית *" size="small" fullWidth value={newHandleForm.name}
            onChange={(e) => setNewHandleForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField label="שם ספק *" size="small" fullWidth value={newHandleForm.supplier}
            onChange={(e) => setNewHandleForm((f) => ({ ...f, supplier: e.target.value }))} />
          <TextField label="תוספת מחיר (₪) *" size="small" fullWidth type="number" value={newHandleForm.priceDelta}
            onChange={(e) => setNewHandleForm((f) => ({ ...f, priceDelta: e.target.value }))} />
          <TextField label="כמות לאספקה ראשונית" size="small" fullWidth type="number"
            inputProps={{ min: 0 }} value={newHandleForm.quantity}
            onChange={(e) => setNewHandleForm((f) => ({ ...f, quantity: e.target.value }))} />
          <TextField label="תיאור *" size="small" fullWidth multiline rows={2} value={newHandleForm.description}
            onChange={(e) => setNewHandleForm((f) => ({ ...f, description: e.target.value }))} />
          <Button component="label" size="small" variant="outlined" startIcon={<UploadIcon />}
            sx={{ width: 'fit-content', fontSize: 11.5, borderRadius: 2 }}>
            {newHandleImageFile ? `תמונה נבחרה: ${newHandleImageFile.name}` : 'העלה תמונה לידית'}
            <input type="file" accept="image/*" hidden
              onChange={(e) => setNewHandleImageFile(e.target.files?.[0] || null)} />
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowHandleForm(false)} sx={{ color: '#A1887F', fontSize: 12 }}>ביטול</Button>
          <Button variant="contained" disabled={!newHandleForm.name.trim()} onClick={handleCreateHandle}
            sx={{ bgcolor: '#4E342E', fontSize: 12, borderRadius: 2, '&:hover': { bgcolor: '#3E2723' } }}>
            שמור ידית חדשה
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={formicasDialogOpen} onClose={() => setFormicasDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: DARK }}>ניהול פורמייקות</DialogTitle>
        <DialogContent dividers>
          {formicasLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={22} sx={{ color: WOOD_COLOR }} />
            </Box>
          ) : formicaStockProducts.length === 0 ? (
            <Alert severity="info">אין פורמייקות בקטלוג כרגע</Alert>
          ) : (
            <Grid container spacing={1.5}>
              {formicaStockProducts.map((f) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={f._id}>
                  <Paper sx={{ p: 1.2, borderRadius: 2, border: `1px solid ${BORDER}`, boxShadow: 'none', position: 'relative' }}>
                    {isManager && (
                      <IconButton size="small" onClick={() => openMaterialEdit('formica', f)}
                        sx={{ position: 'absolute', top: 6, left: 6, bgcolor: 'rgba(255,255,255,0.92)', zIndex: 1 }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    <Box sx={{ height: 120, borderRadius: 1.5, overflow: 'hidden', bgcolor: LIGHT_BG, mb: 1 }}>
                      {f.image ? (
                        <img src={f.image.startsWith('http') ? f.image : `${BASE_URL}${f.image}`} alt={f.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography sx={{ fontSize: 11, color: '#A1887F' }}>אין תמונה</Typography>
                        </Box>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: DARK }}>{f.name}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#8D6E63' }}>קוד: {f.code || '—'}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormicasDialogOpen(false)} sx={{ color: '#A1887F', fontSize: 12 }}>סגור</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={handlesDialogOpen} onClose={() => setHandlesDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: DARK }}>ניהול ידיות</DialogTitle>
        <DialogContent dividers>
          {handlesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={22} sx={{ color: WOOD_COLOR }} />
            </Box>
          ) : handleProducts.length === 0 ? (
            <Alert severity="info">אין ידיות בקטלוג כרגע</Alert>
          ) : (
            <Grid container spacing={1.5}>
              {handleProducts.map((f) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={f._id}>
                  <Paper sx={{ p: 1.2, borderRadius: 2, border: `1px solid ${BORDER}`, boxShadow: 'none', position: 'relative' }}>
                    {isManager && (
                      <IconButton size="small" onClick={() => openMaterialEdit('handle', f)}
                        sx={{ position: 'absolute', top: 6, left: 6, bgcolor: 'rgba(255,255,255,0.92)', zIndex: 1 }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    <Box sx={{ height: 120, borderRadius: 1.5, overflow: 'hidden', bgcolor: LIGHT_BG, mb: 1 }}>
                      {f.image ? (
                        <img src={f.image.startsWith('http') ? f.image : `${BASE_URL}${f.image}`} alt={f.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography sx={{ fontSize: 11, color: '#A1887F' }}>אין תמונה</Typography>
                        </Box>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: DARK }}>{f.name}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#8D6E63' }}>קוד: {f.code || '—'}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setHandlesDialogOpen(false)} sx={{ color: '#A1887F', fontSize: 12 }}>סגור</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={fabricsDialogOpen} onClose={() => setFabricsDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: DARK }}>ניהול בדי ריפוד</DialogTitle>
        <DialogContent dividers>
          {fabricsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={22} sx={{ color: WOOD_COLOR }} />
            </Box>
          ) : fabricProducts.length === 0 ? (
            <Alert severity="info">אין בדי ריפוד בקטלוג כרגע</Alert>
          ) : (
            <Grid container spacing={1.5}>
              {fabricProducts.map((f) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={f._id}>
                  <Paper sx={{ p: 1.2, borderRadius: 2, border: `1px solid ${BORDER}`, boxShadow: 'none', position: 'relative' }}>
                    {isManager && (
                      <IconButton size="small" onClick={() => openMaterialEdit('fabric', f)}
                        sx={{ position: 'absolute', top: 6, left: 6, bgcolor: 'rgba(255,255,255,0.92)', zIndex: 1 }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    <Box sx={{ height: 120, borderRadius: 1.5, overflow: 'hidden', bgcolor: LIGHT_BG, mb: 1 }}>
                      {f.image ? (
                        <img src={f.image.startsWith('http') ? f.image : `${BASE_URL}${f.image}`} alt={f.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography sx={{ fontSize: 11, color: '#A1887F' }}>אין תמונה</Typography>
                        </Box>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: DARK }}>{f.name}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#8D6E63' }}>קוד: {f.code || '—'}</Typography>
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

      <Dialog open={!!materialEdit} onClose={() => setMaterialEdit(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, direction: 'rtl' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: DARK }}>
          עריכת {materialTypeLabel[materialEdit?.type] || 'פריט'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField label="שם *" size="small" fullWidth value={materialEdit?.form?.name || ''}
            onChange={(e) => setMaterialEdit((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))} />
          <TextField label="שם ספק *" size="small" fullWidth value={materialEdit?.form?.supplier || ''}
            onChange={(e) => setMaterialEdit((m) => ({ ...m, form: { ...m.form, supplier: e.target.value } }))} />
          <TextField label="תוספת מחיר (₪) *" size="small" fullWidth type="number"
            value={materialEdit?.form?.priceDelta || ''}
            onChange={(e) => setMaterialEdit((m) => ({ ...m, form: { ...m.form, priceDelta: e.target.value } }))} />
          <TextField label="תיאור *" size="small" fullWidth multiline rows={2}
            value={materialEdit?.form?.description || ''}
            onChange={(e) => setMaterialEdit((m) => ({ ...m, form: { ...m.form, description: e.target.value } }))} />
          {materialEdit?.item?.image && !materialEdit?.imageFile && (
            <Box sx={{ height: 100, borderRadius: 2, overflow: 'hidden', bgcolor: LIGHT_BG }}>
              <img
                src={materialEdit.item.image.startsWith('http') ? materialEdit.item.image : `${BASE_URL}${materialEdit.item.image}`}
                alt={materialEdit.item.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>
          )}
          <Button component="label" size="small" variant="outlined" startIcon={<UploadIcon />}
            sx={{ width: 'fit-content', fontSize: 11.5, borderRadius: 2 }}>
            {materialEdit?.imageFile
              ? `תמונה נבחרה: ${materialEdit.imageFile.name}`
              : materialEdit?.item?.image
                ? 'החלף תמונה'
                : 'העלה תמונה *'}
            <input type="file" accept="image/*" hidden
              onChange={(e) => setMaterialEdit((m) => ({ ...m, imageFile: e.target.files?.[0] || null }))} />
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMaterialEdit(null)} sx={{ color: '#A1887F', fontSize: 12 }}>ביטול</Button>
          <Button variant="contained" disabled={materialEditSaving} onClick={handleSaveMaterialEdit}
            sx={{ bgcolor: WOOD_COLOR, fontSize: 12, borderRadius: 2, '&:hover': { bgcolor: '#A0522D' } }}>
            {materialEditSaving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'שמור'}
          </Button>
        </DialogActions>
      </Dialog>

      <FeedbackSnackbar />
    </Box>
  );
};

export default CatalogPage;