import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../services/api';

const purchaseSupplierKey = (item) =>
  item?.supplierName || item?.product?.supplier || 'ללא ספק';

export const fetchAllOrders = createAsyncThunk(
  'warehouse/fetchAllOrders',
  async (_, { rejectWithValue }) => {
    try { return (await API.get('/orders')).data; }
    catch (err) { return rejectWithValue(err.response?.data?.message || 'שגיאה'); }
  }
);

export const fetchPurchaseList = createAsyncThunk(
  'warehouse/fetchPurchaseList',
  async (opts = {}, { rejectWithValue }) => {
    try { return (await API.get('/warehouse/purchase-list')).data; }
    catch (err) { return rejectWithValue(err.response?.data?.message || 'שגיאה'); }
  }
);

export const fetchAllBaseProducts = createAsyncThunk(
  'warehouse/fetchAllBaseProducts',
  async (_, { rejectWithValue }) => {
    try { return (await API.get('/warehouse/base-products')).data; }
    catch (err) { return rejectWithValue(err.response?.data?.message || 'שגיאה'); }
  }
);

export const fetchOrdersWithNewProducts = createAsyncThunk(
  'warehouse/fetchOrdersWithNewProducts',
  async (_, { rejectWithValue }) => {
    try { return (await API.get('/warehouse/orders-with-new-products')).data; }
    catch (err) { return rejectWithValue(err.response?.data?.message || 'שגיאה'); }
  }
);

export const pickMaterialAction = createAsyncThunk(
  'warehouse/pickMaterial',
  async ({ orderId, materialId, warehouseUserId }, { rejectWithValue }) => {
    try { return (await API.patch(`/warehouse/order/${orderId}/pick`, { materialId, warehouseUserId })).data; }
    catch (err) {
      return rejectWithValue(
        err.response?.data?.error || err.response?.data?.message || 'שגיאה בסימון ליקוט'
      );
    }
  }
);

export const markReadyForShipping = createAsyncThunk(
  'warehouse/markReadyForShipping',
  async (orderId, { rejectWithValue }) => {
    try { return (await API.post(`/warehouse/order/${orderId}/ready-for-shipping`)).data.order; }
    catch (err) { return rejectWithValue(err.response?.data?.message || 'שגיאה'); }
  }
);

export const createBaseProductAction = createAsyncThunk(
  'warehouse/createBaseProduct',
  async (productData, { rejectWithValue }) => {
    try { return (await API.post('/warehouse/base-products', productData)).data; }
    catch (err) { return rejectWithValue(err.response?.data?.error || 'שגיאה ביצירת מוצר'); }
  }
);

export const markBaseProductSupplied = createAsyncThunk(
  'warehouse/markBaseProductSupplied',
  async ({ baseProductId, quantity }, { rejectWithValue }) => {
    try { return (await API.patch(`/warehouse/base-products/${baseProductId}/supplied`, { quantity })).data; }
    catch (err) { return rejectWithValue(err.response?.data?.message || 'שגיאה'); }
  }
);

export const updateBaseProductAction = createAsyncThunk(
  'warehouse/updateBaseProduct',
  async ({ baseProductId, data }, { rejectWithValue }) => {
    try { return (await API.put(`/warehouse/base-products/${baseProductId}`, data)).data; }
    catch (err) { return rejectWithValue(err.response?.data?.error || 'שגיאה בעדכון מוצר'); }
  }
);

// ─── חדש: ניהול ספקים ────────────────────────────────────

export const markSupplierSentAction = createAsyncThunk(
  'warehouse/markSupplierSent',
  async (supplierName, { rejectWithValue }) => {
    try { return (await API.patch(`/warehouse/purchase-list/supplier/${encodeURIComponent(supplierName)}/sent`)).data; }
    catch (err) { return rejectWithValue(err.response?.data?.error || 'שגיאה'); }
  }
);

export const markSupplierArrivedAction = createAsyncThunk(
  'warehouse/markSupplierArrived',
  async (supplierName, { rejectWithValue }) => {
    try { return (await API.patch(`/warehouse/purchase-list/supplier/${encodeURIComponent(supplierName)}/arrived`)).data; }
    catch (err) { return rejectWithValue(err.response?.data?.error || 'שגיאה'); }
  }
);

const warehouseSlice = createSlice({
  name: 'warehouse',
  initialState: {
    orders: [],
    purchaseList: [],
    baseProducts: [],
    ordersWithNewProducts: [],
    loading: false,
    createLoading: false,
    error: null,
    createError: null,
    createSuccess: false,
  },
  reducers: {
    clearWarehouseError: (state) => { state.error = null; },
    clearCreateStatus:   (state) => { state.createError = null; state.createSuccess = false; },
  },
  extraReducers: (builder) => {
    const load = (state) => { state.loading = true; state.error = null; };
    const fail = (state, a) => { state.loading = false; state.error = a.payload; };

    builder
      .addCase(fetchAllOrders.pending,   load)
      .addCase(fetchAllOrders.fulfilled, (state, a) => { state.loading = false; state.orders = a.payload; })
      .addCase(fetchAllOrders.rejected,  fail)

      .addCase(fetchPurchaseList.pending, (state, action) => {
        if (!action.meta.arg?.silent) load(state);
      })
      .addCase(fetchPurchaseList.fulfilled, (state, a) => {
        if (!a.meta.arg?.silent) state.loading = false;
        state.purchaseList = a.payload;
      })
      .addCase(fetchPurchaseList.rejected, (state, a) => {
        if (!a.meta.arg?.silent) fail(state, a);
      })

      .addCase(fetchAllBaseProducts.pending,   load)
      .addCase(fetchAllBaseProducts.fulfilled, (state, a) => { state.loading = false; state.baseProducts = a.payload; })
      .addCase(fetchAllBaseProducts.rejected,  fail)

      .addCase(fetchOrdersWithNewProducts.fulfilled, (state, a) => { state.ordersWithNewProducts = a.payload; })

      .addCase(pickMaterialAction.fulfilled, (state, a) => {
        const id = String(a.payload?._id ?? '');
        const idx = state.orders.findIndex((o) => String(o._id) === id);
        if (idx !== -1) state.orders[idx] = a.payload;
      })

      .addCase(markReadyForShipping.fulfilled, (state, a) => {
        const id = String(a.payload?._id ?? '');
        const idx = state.orders.findIndex((o) => String(o._id) === id);
        if (idx !== -1) state.orders[idx] = a.payload;
      })

      .addCase(createBaseProductAction.pending,   (state) => {
        state.createLoading = true;
        state.createError = null;
        state.createSuccess = false;
      })
      .addCase(createBaseProductAction.fulfilled, (state, a) => {
        state.createLoading = false;
        state.createSuccess = true;
        state.baseProducts.push(a.payload);
      })
      .addCase(createBaseProductAction.rejected,  (state, a) => {
        state.createLoading = false;
        state.createError = a.payload;
      })

      .addCase(markBaseProductSupplied.fulfilled, (state, a) => {
        const idx = state.baseProducts.findIndex(p => p._id === a.payload._id);
        if (idx !== -1) state.baseProducts[idx] = a.payload;
      })

      .addCase(updateBaseProductAction.fulfilled, (state, a) => {
        const idx = state.baseProducts.findIndex(p => p._id === a.payload._id);
        if (idx !== -1) state.baseProducts[idx] = a.payload;
      })

      // ─── ספקים ───────────────────────────────────────────
      .addCase(markSupplierSentAction.fulfilled, (state, action) => {
        const supplierName = action.meta.arg;
        const updated = Array.isArray(action.payload) ? action.payload : [];
        const updatedById = new Map(
          updated.map((item) => [String(item._id), item])
        );
        state.purchaseList = state.purchaseList.map((p) => {
          if (purchaseSupplierKey(p) !== supplierName) return p;
          const fromApi = updatedById.get(String(p._id));
          if (fromApi) return fromApi;
          return {
            ...p,
            status: 'SENT_TO_SUPPLIER',
            sentAt: p.sentAt || new Date().toISOString(),
          };
        });
      })

      .addCase(markSupplierArrivedAction.fulfilled, (state, action) => {
        const supplierName = action.meta.arg;
        state.purchaseList = state.purchaseList.filter(
          (p) => purchaseSupplierKey(p) !== supplierName
        );
      });
  }
});

export const { clearWarehouseError, clearCreateStatus } = warehouseSlice.actions;
export default warehouseSlice.reducer;