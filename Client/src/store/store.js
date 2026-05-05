// store.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import employeesReducer from './slices/employeesSlice';
import ordersReducer from './slices/ordersSlice';
import catalogReducer from './slices/catalogSlice';
import notificationsReducer from './slices/notificationsSlice';
import chatReducer from './slices/chatSlice';
import warehouseReducer from './slices/warehouseSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    employees: employeesReducer,
    orders: ordersReducer,
    catalog: catalogReducer,
    notifications: notificationsReducer,
    chat: chatReducer,
    warehouse: warehouseReducer, // ✅ נוסף
  },
});