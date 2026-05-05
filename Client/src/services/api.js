// client/src/services/api.js
import axios from 'axios';
import { authService } from './authService'; // נדרש ל-logout ב-interceptor

const API_BASE_URL = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:5001';
console.log('🔍 API URL:', API_BASE_URL); // ← הוסיפי רק את השורה הזו

const API = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Unauthorized request. Token might be expired or missing/invalid. Attempting to log out.');
      authService.logout(); // משתמש בפונקציית ה-logout מה-authService
      window.location = '/login';
    }
    return Promise.reject(error);
  }
);

export default API;