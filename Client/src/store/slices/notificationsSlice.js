// client/src/store/slices/notificationsSlice.js (מתוקן ומלא)
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { createSelector } from 'reselect'; // הוסף ייבוא זה
import API from '../../services/api';

export const fetchNotifications = createAsyncThunk('notifications/fetchAll', async (_, { rejectWithValue }) => {
  try {
    // התיקון כאן: הסרת /api
    const res = await API.get('/notifications'); 
    return res.data;
  } catch (err) {
    // חשוב להחזיר את err.response?.data?.message לפורמט אחיד
    return rejectWithValue(err.response?.data?.message || 'שגיאה בטעינת התראות');
  }
});

export const markNotificationRead = createAsyncThunk('notifications/markRead', async (id, { rejectWithValue }) => {
  try {
    // התיקון כאן: הסרת /api
    const res = await API.patch(`/notifications/${id}/read`); 
    return res.data;
  } catch (err) {
    // חשוב להחזיר את err.response?.data?.message לפורמט אחיד
    return rejectWithValue(err.response?.data?.message || 'שגיאה בעדכון התראה');
  }
});

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
  },
  reducers: {
    // ניתן להוסיף רדיוסרים אם יש צורך בלוגיקה ספציפית לניהול התראות שלא קשורה ל-async thunks
    resetNotificationsState: (state) => {
        state.notifications = [];
        state.unreadCount = 0;
        state.loading = false;
        state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload;
        // וודא שמשתמשים במאפיין שהשרת מחזיר עבור סטטוס קריאה (isRead)
        state.unreadCount = action.payload.filter(n => !n.isRead).length; 
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        // action.payload הוא ההתראה המעודכנת מהשרת
        const updatedNotification = action.payload;
        const idx = state.notifications.findIndex(n => n._id === updatedNotification._id);
        if (idx !== -1) {
          state.notifications[idx] = updatedNotification;
        }
        // עדכון ספירה לאחר שינוי
        state.unreadCount = state.notifications.filter(n => !n.isRead).length;
      })
      .addCase(markNotificationRead.rejected, (state, action) => {
        state.error = action.payload; // שגיאת סימון כנקרא
      });
  },
});

export const { resetNotificationsState } = notificationsSlice.actions;

// סלקטורים
export const selectAllNotifications = createSelector(
    (state) => state.notifications.notifications,
    (notifications) => notifications
);

export const selectUnreadNotificationsCount = createSelector(
    (state) => state.notifications.unreadCount,
    (unreadCount) => unreadCount
);

export const selectNotificationsLoading = createSelector(
    (state) => state.notifications.loading,
    (loading) => loading
);

export const selectNotificationsError = createSelector(
    (state) => state.notifications.error,
    (error) => error
);

export default notificationsSlice.reducer;