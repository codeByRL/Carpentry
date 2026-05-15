import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../services/api';

// שליפת מוצרים פעילים (סוכן מכירות)
export const fetchActiveCatalog = createAsyncThunk('catalog/fetchActive', async (_, { rejectWithValue }) => {
  try {
    const res = await API.get('/catalog/active');
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת קטלוג');
  }
});

// שליפת קטלוג למנהל: פעילים + בתהליך אפיון + ממתין לאישור
export const fetchManagerCatalog = createAsyncThunk('catalog/fetchManagerCatalog', async (_, { rejectWithValue }) => {
  try {
    const [active, pending, waitingApproval] = await Promise.all([
      API.get('/catalog/active'),
      API.get('/catalog/status/PENDING_CHARACTERIZATION'),
      API.get('/catalog/status/WAITING_ADMIN_APPROVAL'),
    ]);

    const merged = [...active.data, ...pending.data, ...waitingApproval.data];
    const deduped = Array.from(new Map(merged.map((p) => [p._id, p])).values());
    return deduped;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת קטלוג מנהל');
  }
});

// שליפת מוצרים לפי סטטוס (מנהל)
export const fetchCatalogByStatus = createAsyncThunk('catalog/fetchByStatus', async (status, { rejectWithValue }) => {
  try {
    const res = await API.get(`/catalog/status/${status}`);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת קטלוג');
  }
});

// שליפת כל הנגרים
export const fetchCarpenters = createAsyncThunk('catalog/fetchCarpenters', async (_, { rejectWithValue }) => {
  try {
    const res = await API.get('/catalog/carpenters');
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת נגרים');
  }
});

// יצירת מוצר חדש (מנהל)
export const createCatalogProduct = createAsyncThunk('catalog/create', async (formData, { rejectWithValue }) => {
  try {
    const res = await API.post('/catalog', formData);
    return res.data.product;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה ביצירת מוצר');
  }
});

// יצירת תמונה עם AI
export const generateAIImage = createAsyncThunk('catalog/generateImage', async (prompt, { rejectWithValue }) => {
  try {
    const res = await API.post('/catalog/generate-image', { prompt });
    return res.data.imageUrl;
  } catch (err) {
    // בדיקה אם יש מידע נוסף על שגיאה
    console.log('Full error object:', err); //_DEBUG
    
    // טיפול מיוחד במקרה של שגיאות Netzfree
    if (err.response?.data?.netfreeBlocked) {
      return rejectWithValue({
        message: err.response.data.message,
        netfreeBlocked: true
      });
    }
    
    // אם יש הודעת שגיאה ספציפית מהשרת
    if (err.response?.data?.message) {
      return rejectWithValue(err.response.data.message);
    }
    
    // שגיאה כללית
    return rejectWithValue('שגיאה ביצירת תמונה עם ה-AI');
  }
});

// שיוך נגר לאפיון
export const assignCarpenterForCharacterization = createAsyncThunk('catalog/assign', async ({ productId, carpenterId }, { rejectWithValue }) => {
  try {
    const res = await API.post('/catalog/assign-carpenter', { productId, carpenterId });
    return res.data.product;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה בשיוך נגר');
  }
});

// החלפת נגר
export const reassignCarpenter = createAsyncThunk('catalog/reassign', async ({ productId, carpenterId }, { rejectWithValue }) => {
  try {
    const res = await API.patch(`/catalog/${productId}/reassign`, { carpenterId });
    return res.data.product;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה בהחלפת נגר');
  }
});

// אישור מוצר (מנהל)
export const approveProduct = createAsyncThunk('catalog/approve', async ({ productId, price }, { rejectWithValue }) => {
  try {
    const res = await API.patch(`/catalog/${productId}/approve`, { price });
    return res.data.product;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה באישור מוצר');
  }
});

// עריכת מוצר (מנהל)
export const updateCatalogProduct = createAsyncThunk('catalog/update', async ({ productId, formData }, { rejectWithValue }) => {
  try {
    const res = await API.put(`/catalog/${productId}`, formData);
    return res.data.product;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה בעדכון מוצר');
  }
});

// מחיקת מוצר (מנהל)
export const deleteCatalogProduct = createAsyncThunk('catalog/delete', async (productId, { rejectWithValue }) => {
  try {
    await API.delete(`/catalog/${productId}`);
    return productId;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה במחיקת מוצר');
  }
});

const catalogSlice = createSlice({
  name: 'catalog',
  initialState: {
    products: [],
    carpenters: [],
    generatedImageUrl: null,
    loading: false,
    submitLoading: false,
    imageLoading: false,
    error: null,
    submitError: null,
  },
  reducers: {
    clearCatalogSubmitError: (state) => { state.submitError = null; },
    clearGeneratedImage: (state) => { state.generatedImageUrl = null; },
  },
  extraReducers: (builder) => {
    builder
      // fetchActiveCatalog
      .addCase(fetchActiveCatalog.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchActiveCatalog.fulfilled, (state, action) => { state.loading = false; state.products = action.payload; })
      .addCase(fetchActiveCatalog.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      // fetchManagerCatalog
      .addCase(fetchManagerCatalog.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchManagerCatalog.fulfilled, (state, action) => { state.loading = false; state.products = action.payload; })
      .addCase(fetchManagerCatalog.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      // fetchCatalogByStatus
      .addCase(fetchCatalogByStatus.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchCatalogByStatus.fulfilled, (state, action) => { state.loading = false; state.products = action.payload; })
      .addCase(fetchCatalogByStatus.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      // fetchCarpenters
      .addCase(fetchCarpenters.fulfilled, (state, action) => { state.carpenters = action.payload; })

      // createCatalogProduct
      .addCase(createCatalogProduct.pending, (state) => { state.submitLoading = true; state.submitError = null; })
      .addCase(createCatalogProduct.fulfilled, (state, action) => { state.submitLoading = false; state.products.push(action.payload); })
      .addCase(createCatalogProduct.rejected, (state, action) => { state.submitLoading = false; state.submitError = action.payload; })

      // generateAIImage
      .addCase(generateAIImage.pending, (state) => { state.imageLoading = true; state.submitError = null; })
      .addCase(generateAIImage.fulfilled, (state, action) => { state.imageLoading = false; state.generatedImageUrl = action.payload; })
      .addCase(generateAIImage.rejected, (state, action) => { 
        state.imageLoading = false; 
        state.submitError = typeof action.payload === 'object' && action.payload.netfreeBlocked 
          ? action.payload.message 
          : action.payload; 
      })

      // assignCarpenter / reassign / approve / update / delete
      .addCase(assignCarpenterForCharacterization.fulfilled, (state, action) => {
        const idx = state.products.findIndex(p => p._id === action.payload._id);
        if (idx !== -1) state.products[idx] = action.payload;
      })
      .addCase(reassignCarpenter.fulfilled, (state, action) => {
        const idx = state.products.findIndex(p => p._id === action.payload._id);
        if (idx !== -1) state.products[idx] = action.payload;
      })
      .addCase(approveProduct.fulfilled, (state, action) => {
        const idx = state.products.findIndex(p => p._id === action.payload._id);
        if (idx !== -1) state.products[idx] = action.payload;
      })
      .addCase(updateCatalogProduct.pending, (state) => {
        state.submitLoading = true;
        state.submitError = null;
      })
      .addCase(updateCatalogProduct.fulfilled, (state, action) => {
        state.submitLoading = false;
        const id = String(action.payload._id ?? action.payload.id ?? "");
        const idx = state.products.findIndex((p) => String(p._id) === id);
        if (idx !== -1) state.products[idx] = action.payload;
      })
      .addCase(updateCatalogProduct.rejected, (state, action) => {
        state.submitLoading = false;
        state.submitError = action.payload;
      })
      .addCase(deleteCatalogProduct.fulfilled, (state, action) => {
        state.products = state.products.filter(p => p._id !== action.payload);
      });
  },
});

export const { clearCatalogSubmitError, clearGeneratedImage } = catalogSlice.actions;
export default catalogSlice.reducer;