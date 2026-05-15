import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../services/api';

export const fetchPendingDeliveries = createAsyncThunk(
  'delivery/fetchPending',
  async (_, { rejectWithValue }) => {
    try {
      return (await API.get('/delivery/pending')).data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת הובלות ממתינות');
    }
  }
);

export const fetchMyTodayRun = createAsyncThunk(
  'delivery/fetchMyToday',
  async (_, { rejectWithValue }) => {
    try {
      return (await API.get('/delivery/my-today')).data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת המסלול שלי');
    }
  }
);

export const claimDeliveriesForToday = createAsyncThunk(
  'delivery/claimMyToday',
  async ({ desiredHours, startAddress, startLat, startLng }, { rejectWithValue }) => {
    try {
      const payload = { desiredHours: Number(desiredHours) };
      if (Number.isFinite(startLat) && Number.isFinite(startLng)) {
        payload.startLat = startLat;
        payload.startLng = startLng;
      } else if (startAddress) {
        payload.startAddress = startAddress;
      }
      const res = await API.post('/delivery/claim-my-today', payload);
      return res.data;
    } catch (err) {
      const data = err.response?.data || {};
      return rejectWithValue({
        message: data.message || 'שגיאה בתכנון מסלול יומי',
        kind: data.kind || null,
        minHoursNeeded: data.minHoursNeeded ?? null,
      });
    }
  }
);

export const fetchMyMonthlyDeliveries = createAsyncThunk(
  'delivery/fetchMyMonth',
  async (_, { rejectWithValue }) => {
    try {
      return (await API.get('/delivery/my-month')).data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת הובלות החודש');
    }
  }
);

export const completeDeliveryStop = createAsyncThunk(
  'delivery/completeStop',
  async ({ runId, stopId }, { rejectWithValue }) => {
    try {
      return (await API.post('/delivery/complete-stop', { runId, stopId })).data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'שגיאה בסימון הובלה כהושלמה');
    }
  }
);

const initialState = {
  pendingPool: [],
  myRun: null,
  driverReleaseNotice: null,
  myMonthly: { count: 0, stops: [], periodStart: null, periodEnd: null },
  myMonthlyLoading: false,
  loading: false,
  claimLoading: false,
  completeLoading: false,
  error: null,
  info: null,
};

const deliverySlice = createSlice({
  name: 'delivery',
  initialState,
  reducers: {
    clearDeliveryError: (state) => {
      state.error = null;
    },
    clearDeliveryInfo: (state) => {
      state.info = null;
    },
    clearDriverReleaseNotice: (state) => {
      state.driverReleaseNotice = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPendingDeliveries.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPendingDeliveries.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingPool = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchPendingDeliveries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(fetchMyTodayRun.fulfilled, (state, action) => {
        const payload = action.payload;
        if (!payload) {
          state.myRun = null;
          return;
        }
        if (Object.prototype.hasOwnProperty.call(payload, "run")) {
          state.myRun = payload.run || null;
          if (payload.releaseNotice) {
            state.driverReleaseNotice = payload.releaseNotice;
          }
          return;
        }
        if (payload.stops) {
          state.myRun = payload;
        }
      })
      .addCase(fetchMyTodayRun.rejected, (state, action) => {
        state.error = action.payload;
      })

      .addCase(claimDeliveriesForToday.pending, (state) => {
        state.claimLoading = true;
        state.error = null;
        state.info = null;
      })
      .addCase(claimDeliveriesForToday.fulfilled, (state, action) => {
        state.claimLoading = false;
        const run = action.payload?.run || null;
        state.myRun = run;
        state.driverReleaseNotice = null;
        if (run?.stops?.length) {
          const claimedOrderIds = new Set(
            run.stops.map((s) => String(s.order?._id || s.order))
          );
          state.pendingPool = state.pendingPool.filter(
            (s) => !claimedOrderIds.has(String(s.order?._id || s.order))
          );
        }
      })
      .addCase(claimDeliveriesForToday.rejected, (state, action) => {
        state.claimLoading = false;
        const payload = action.payload || {};
        let message = payload.message || 'שגיאה בתכנון מסלול יומי';
        if (payload.minHoursNeeded != null) {
          message = `${message} (נדרשות לפחות ~${payload.minHoursNeeded} שעות)`;
        }
        const isInformational = /אין כרגע הובלות|אף הובלה לא נכנסת|אין הובלות מתאימות|נתפסו ע"י נהג/.test(
          message
        );
        if (isInformational) {
          state.info = message;
          state.error = null;
        } else {
          state.error = message;
          state.info = null;
        }
      })

      .addCase(completeDeliveryStop.pending, (state) => {
        state.completeLoading = true;
      })
      .addCase(completeDeliveryStop.fulfilled, (state, action) => {
        state.completeLoading = false;
        state.myRun = action.payload?.run || state.myRun;
      })
      .addCase(completeDeliveryStop.rejected, (state, action) => {
        state.completeLoading = false;
        state.error = action.payload;
      })

      .addCase(fetchMyMonthlyDeliveries.pending, (state) => {
        state.myMonthlyLoading = true;
      })
      .addCase(fetchMyMonthlyDeliveries.fulfilled, (state, action) => {
        state.myMonthlyLoading = false;
        state.myMonthly = action.payload || initialState.myMonthly;
      })
      .addCase(fetchMyMonthlyDeliveries.rejected, (state, action) => {
        state.myMonthlyLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearDeliveryError, clearDeliveryInfo, clearDriverReleaseNotice } = deliverySlice.actions;
export default deliverySlice.reducer;
