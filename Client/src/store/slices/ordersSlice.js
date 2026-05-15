// client/src/store/slices/ordersSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../services/api';

// ─── Async Thunks ───────────────────────────────────────────

export const fetchAllOrders = createAsyncThunk(
  'orders/fetchAll',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams(filters).toString();
      // ✅ Fixed path
      const res = await API.get(`/orders${params ? `?${params}` : ''}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת הזמנות');
    }
  }
);

export const fetchOrdersForSales = createAsyncThunk(
  'orders/fetchOrdersForSales',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams(filters).toString();
      // ✅ Fixed path
      const response = await API.get(`/orders${params ? `?${params}` : ''}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'שגיאה בטעינת הזמנות לסוכן מכירות');
    }
  }
);

export const fetchOrderById = createAsyncThunk(
  'orders/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      // ✅ Fixed path
      const res = await API.get(`/orders/${id}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת הזמנה');
    }
  }
);

export const createOrder = createAsyncThunk(
  'orders/create',
  async (orderData, { rejectWithValue }) => {
    try {
      // ✅ Fixed path
      const res = await API.post('/orders', orderData);
      return res.data.order;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה ביצירת הזמנה');
    }
  }
);

export const assignCarpenterToOrder = createAsyncThunk(
  'orders/assignCarpenter',
  async ({ orderId, carpenterId }, { rejectWithValue }) => {
    try {
      // ✅ Fixed path
      const res = await API.patch(`/orders/${orderId}/assign-carpenter`, { carpenterId });
      return res.data.order;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה בשיוך נגר');
    }
  }
);

export const assignBestCarpenterToOrder = createAsyncThunk(
  'orders/assignBestCarpenter',
  async (orderId, { rejectWithValue }) => {
    try {
      const res = await API.patch(`/orders/${orderId}/assign-best-carpenter`);
      return res.data.order;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה בשיוך אוטומטי');
    }
  }
);

export const updateOrderStatus = createAsyncThunk(
  'orders/updateStatus',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      // ✅ Fixed path
      const res = await API.patch(`/orders/${id}/status`, { status });
      return res.data.order;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה בעדכון סטטוס');
    }
  }
);

export const pickMaterial = createAsyncThunk(
  'orders/pickMaterial',
  async ({ orderId, materialId }, { rejectWithValue }) => {
    try {
      // ✅ Fixed path
      const res = await API.patch(`/warehouse/orders/${orderId}/pick/${materialId}`);
      return res.data.order;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה בסימון חומר');
    }
  }
);

export const markOrderSeenByWarehouse = createAsyncThunk(
  'orders/markSeen',
  async (orderId, { rejectWithValue }) => {
    try {
      // ✅ Fixed path
      const res = await API.patch(`/warehouse/orders/${orderId}/seen`);
      return res.data.order;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה');
    }
  }
);

export const markOrderReadyForShipping = createAsyncThunk(
  'orders/readyForShipping',
  async (orderId, { rejectWithValue }) => {
    try {
      // ✅ Fixed path
      const res = await API.patch(`/warehouse/orders/${orderId}/ready-for-shipping`);
      return res.data.order;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה');
    }
  }
);

// NEW: Async thunk to mark an order as paid
export const markOrderAsPaid = createAsyncThunk(
  'orders/markOrderAsPaid',
  async (orderId, { rejectWithValue }) => {
    try {
      // ✅ Fixed path
      const response = await API.patch(`/orders/${orderId}/mark-as-paid`);
      return response.data.order;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'שגיאה בסימון הזמנה כשולמה');
    }
  }
);

export const confirmQuotationOrder = createAsyncThunk(
  'orders/confirmQuotationOrder',
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await API.patch(`/orders/${orderId}/confirm-order`);
      return response.data.order;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'שגיאה בהמרת הצעת מחיר להזמנה');
    }
  }
);

// ─── Slice ───────────────────────────────────────────────────

const ordersSlice = createSlice({
  name: 'orders',
  initialState: {
    orders: [],
    selectedOrder: null,
    loading: false,
    error: null,
    submitLoading: false,
    submitError: null,
  },
  reducers: {
    clearSelectedOrder: (state) => {
      state.selectedOrder = null;
    },
    clearOrdersError: (state) => {
      state.error = null;
    },
    clearSubmitError: (state) => {
      state.submitError = null;
    },
  },
  extraReducers: (builder) => {
    const handlePending = (state) => { state.loading = true; state.error = null; };
    const handleRejected = (state, action) => { state.loading = false; state.error = action.payload; };
    const handleSubmitPending = (state) => { state.submitLoading = true; state.submitError = null; };
    const handleSubmitRejected = (state, action) => { state.submitLoading = false; state.submitError = action.payload; };
    const handleSubmitFulfilled = (state) => { state.submitLoading = false; };

    builder
      .addCase(fetchAllOrders.pending, handlePending)
      .addCase(fetchAllOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload;
      })
      .addCase(fetchAllOrders.rejected, handleRejected)

      .addCase(fetchOrdersForSales.pending, handlePending)
      .addCase(fetchOrdersForSales.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload;
      })
      .addCase(fetchOrdersForSales.rejected, handleRejected)

      .addCase(fetchOrderById.pending, handlePending)
      .addCase(fetchOrderById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedOrder = action.payload;
      })
      .addCase(fetchOrderById.rejected, handleRejected)

      .addCase(createOrder.pending, handleSubmitPending)
      .addCase(createOrder.fulfilled, (state, action) => {
        handleSubmitFulfilled(state);
        state.orders.unshift(action.payload);
      })
      .addCase(createOrder.rejected, handleSubmitRejected)

      .addCase(assignCarpenterToOrder.pending, handlePending)
      .addCase(assignCarpenterToOrder.fulfilled, (state, action) => {
        state.loading = false;
        // מעדכנים את ההזמנה במקום (לא מסירים) — אחרת היא נעלמת מהדשבורד הראשי
        // ויש חוסר התאמה בין כמות בסוגריים לכמות בפועל בליסט.
        const idx = state.orders.findIndex(o => o._id === action.payload._id);
        if (idx !== -1) state.orders[idx] = action.payload;
        if (state.selectedOrder?._id === action.payload._id) {
          state.selectedOrder = action.payload;
        }
      })
      .addCase(assignCarpenterToOrder.rejected, handleRejected)

      .addCase(assignBestCarpenterToOrder.pending, handlePending)
      .addCase(assignBestCarpenterToOrder.fulfilled, (state, action) => {
        state.loading = false;
        const idx = state.orders.findIndex(o => o._id === action.payload._id);
        if (idx !== -1) state.orders[idx] = action.payload;
        if (state.selectedOrder?._id === action.payload._id) {
          state.selectedOrder = action.payload;
        }
      })
      .addCase(assignBestCarpenterToOrder.rejected, handleRejected)

      .addCase(updateOrderStatus.pending, handleSubmitPending)
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        handleSubmitFulfilled(state);
        const idx = state.orders.findIndex(o => o._id === action.payload._id);
        if (idx !== -1) state.orders[idx] = action.payload;
        if (state.selectedOrder?._id === action.payload._id) state.selectedOrder = action.payload;
      })
      .addCase(updateOrderStatus.rejected, handleSubmitRejected)

      .addCase(pickMaterial.pending, handleSubmitPending)
      .addCase(pickMaterial.fulfilled, (state, action) => {
        handleSubmitFulfilled(state);
        const idx = state.orders.findIndex(o => o._id === action.payload._id);
        if (idx !== -1) state.orders[idx] = action.payload;
        if (state.selectedOrder?._id === action.payload._id) state.selectedOrder = action.payload;
      })
      .addCase(pickMaterial.rejected, handleSubmitRejected)

      .addCase(markOrderSeenByWarehouse.pending, handleSubmitPending)
      .addCase(markOrderSeenByWarehouse.fulfilled, (state, action) => {
        handleSubmitFulfilled(state);
        const idx = state.orders.findIndex(o => o._id === action.payload._id);
        if (idx !== -1) state.orders[idx] = action.payload;
        if (state.selectedOrder?._id === action.payload._id) state.selectedOrder = action.payload;
      })
      .addCase(markOrderSeenByWarehouse.rejected, handleSubmitRejected)

      .addCase(markOrderReadyForShipping.pending, handleSubmitPending)
      .addCase(markOrderReadyForShipping.fulfilled, (state, action) => {
        handleSubmitFulfilled(state);
        const idx = state.orders.findIndex(o => o._id === action.payload._id);
        if (idx !== -1) state.orders[idx] = action.payload;
        if (state.selectedOrder?._id === action.payload._id) state.selectedOrder = action.payload;
      })
      .addCase(markOrderReadyForShipping.rejected, handleSubmitRejected)

      .addCase(markOrderAsPaid.pending, handleSubmitPending)
      .addCase(markOrderAsPaid.fulfilled, (state, action) => {
        handleSubmitFulfilled(state);
        const index = state.orders.findIndex(order => order._id === action.payload._id);
        if (index !== -1) {
          state.orders[index] = action.payload;
        }
        if (state.selectedOrder?._id === action.payload._id) {
          state.selectedOrder = action.payload;
        }
      })
      .addCase(markOrderAsPaid.rejected, handleSubmitRejected)

      .addCase(confirmQuotationOrder.pending, handleSubmitPending)
      .addCase(confirmQuotationOrder.fulfilled, (state, action) => {
        handleSubmitFulfilled(state);
        const index = state.orders.findIndex(order => order._id === action.payload._id);
        if (index !== -1) {
          state.orders[index] = action.payload;
        }
        if (state.selectedOrder?._id === action.payload._id) {
          state.selectedOrder = action.payload;
        }
      })
      .addCase(confirmQuotationOrder.rejected, handleSubmitRejected);
  },
});

export const { clearSelectedOrder, clearOrdersError, clearSubmitError } = ordersSlice.actions;
export default ordersSlice.reducer;