// src/store/slices/employeesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../services/api';

// ─── Async Thunks ───────────────────────────────────────────

export const fetchEmployees = createAsyncThunk('employees/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await API.get('/manager/employees');
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת עובדים');
  }
});

export const fetchWarehouses = createAsyncThunk('employees/fetchWarehouses', async (_, { rejectWithValue }) => {
  try {
    const res = await API.get('/warehouses');
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת מחסנים');
  }
});

export const fetchEmployeeActiveOrders = createAsyncThunk('employees/fetchEmployeeActiveOrders', async (employeeId, { rejectWithValue }) => {
  try {
    const res = await API.get(`/manager/employees/${employeeId}/active-orders`);
    return { employeeId, orders: res.data };
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת הזמנות פעילות של העובד');
  }
});

export const fetchDriverMonthlyDeliveries = createAsyncThunk(
  'employees/fetchDriverMonthlyDeliveries',
  async (driverId, { rejectWithValue }) => {
    try {
      const res = await API.get(`/delivery/driver/${driverId}/this-month`);
      return { driverId, summary: res.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת הובלות החודש של הנהג');
    }
  }
);

export const createEmployee = createAsyncThunk('employees/create', async (formData, { rejectWithValue }) => {
  try {
    const res = await API.post('/manager/employees', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה ביצירת עובד');
  }
});

export const updateEmployee = createAsyncThunk('employees/update', async ({ id, formData }, { rejectWithValue }) => {
  try {
    const res = await API.patch(`/manager/employees/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה בעדכון עובד');
  }
});

export const deleteEmployee = createAsyncThunk('employees/delete', async (id, { rejectWithValue }) => {
  try {
    await API.delete(`/manager/employees/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה במחיקת עובד');
  }
});

export const createWarehouse = createAsyncThunk('employees/createWarehouse', async (data, { rejectWithValue }) => {
  try {
    const res = await API.post('/warehouses', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה ביצירת מחסן');
  }
});

export const updateWarehouse = createAsyncThunk('employees/updateWarehouse', async ({ id, data }, { rejectWithValue }) => {
  try {
    const res = await API.patch(`/warehouses/${id}`, data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה בעדכון מחסן');
  }
});

export const deleteWarehouse = createAsyncThunk('employees/deleteWarehouse', async (id, { rejectWithValue }) => {
  try {
    await API.delete(`/warehouses/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'שגיאה במחיקת מחסן');
  }
});

// ─── Slice ───────────────────────────────────────────────────

const employeesSlice = createSlice({
  name: 'employees',
  initialState: {
    employees: [],
    warehouses: [],
    employeeActiveOrders: {},
    activeOrdersLoadingByEmployee: {},
    driverMonthlyByEmployee: {},
    driverMonthlyLoadingByEmployee: {},
    loading: false,
    submitLoading: false,
    error: null,
    submitError: null,
  },
  reducers: {
    clearSubmitError: (state) => {
      state.submitError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchEmployees
      .addCase(fetchEmployees.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.loading = false;
        state.employees = action.payload;
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // fetchWarehouses
      .addCase(fetchWarehouses.fulfilled, (state, action) => {
        state.warehouses = action.payload;
      })
      .addCase(createWarehouse.fulfilled, (state, action) => {
        state.warehouses.push(action.payload);
      })
      .addCase(updateWarehouse.fulfilled, (state, action) => {
        const idx = state.warehouses.findIndex((w) => w._id === action.payload._id);
        if (idx !== -1) state.warehouses[idx] = action.payload;
      })
      .addCase(deleteWarehouse.fulfilled, (state, action) => {
        state.warehouses = state.warehouses.filter((w) => w._id !== action.payload);
      })
      .addCase(fetchEmployeeActiveOrders.pending, (state, action) => {
        const employeeId = action.meta.arg;
        state.activeOrdersLoadingByEmployee[employeeId] = true;
      })
      .addCase(fetchEmployeeActiveOrders.fulfilled, (state, action) => {
        const { employeeId, orders } = action.payload;
        state.activeOrdersLoadingByEmployee[employeeId] = false;
        state.employeeActiveOrders[employeeId] = orders;
      })
      .addCase(fetchEmployeeActiveOrders.rejected, (state, action) => {
        const employeeId = action.meta.arg;
        state.activeOrdersLoadingByEmployee[employeeId] = false;
        state.error = action.payload;
      })

      .addCase(fetchDriverMonthlyDeliveries.pending, (state, action) => {
        const driverId = action.meta.arg;
        state.driverMonthlyLoadingByEmployee[driverId] = true;
      })
      .addCase(fetchDriverMonthlyDeliveries.fulfilled, (state, action) => {
        const { driverId, summary } = action.payload;
        state.driverMonthlyLoadingByEmployee[driverId] = false;
        state.driverMonthlyByEmployee[driverId] = summary;
      })
      .addCase(fetchDriverMonthlyDeliveries.rejected, (state, action) => {
        const driverId = action.meta.arg;
        state.driverMonthlyLoadingByEmployee[driverId] = false;
        state.error = action.payload;
      })

      // createEmployee
      .addCase(createEmployee.pending, (state) => { state.submitLoading = true; state.submitError = null; })
      .addCase(createEmployee.fulfilled, (state, action) => {
        state.submitLoading = false;
        state.employees.push(action.payload);
      })
      .addCase(createEmployee.rejected, (state, action) => {
        state.submitLoading = false;
        state.submitError = action.payload;
      })

      // updateEmployee
      .addCase(updateEmployee.pending, (state) => { state.submitLoading = true; state.submitError = null; })
      .addCase(updateEmployee.fulfilled, (state, action) => {
        state.submitLoading = false;
        const idx = state.employees.findIndex(e => e._id === action.payload._id);
        if (idx !== -1) state.employees[idx] = action.payload;
      })
      .addCase(updateEmployee.rejected, (state, action) => {
        state.submitLoading = false;
        state.submitError = action.payload;
      })

      // deleteEmployee
      .addCase(deleteEmployee.fulfilled, (state, action) => {
        state.employees = state.employees.filter(e => e._id !== action.payload);
      })
      .addCase(deleteEmployee.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearSubmitError } = employeesSlice.actions;
export default employeesSlice.reducer;