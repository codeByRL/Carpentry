import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import { authService } from '../../services/authService';
// import api from '../../services/api'; // אין צורך ב-api אם אין loadUser

// אין כאן את ה-thunk של loadUser

const userFromStorage = authService.getCurrentUser();
const tokenFromStorage = authService.getToken();

export const loginAction = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      return response;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: userFromStorage,
    loading: false, // חוזר למצב המקורי, לא יציג CircularProgress אוטומטית בהפעלה
    error: null,
    token: tokenFromStorage,
  },
  reducers: {
    logoutAction: (state) => {
      authService.logout();
      state.user = null;
      state.token = null;
      state.error = null;
    },
    setUser: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAction.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(loginAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'שגיאה בהתחברות';
        state.user = null;
        state.token = null;
      });
  },
});

export const { logoutAction, setUser } = authSlice.actions;

// סלקטורים שמחזירים את המשתמש
export const selectUser = createSelector(
  (state) => state.auth.user,
  (user) => user
);

export const selectCurrentUserDetails = createSelector(
  (state) => state.auth.user,
  (user) => user
);

export const selectAuthToken = createSelector(
  (state) => state.auth.token,
  (token) => token
);

export const selectCurrentUserId = createSelector(
  (state) => state.auth.user,
  (user) => user ? user._id || user.id : null
);

export default authSlice.reducer;