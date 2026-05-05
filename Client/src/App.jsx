import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Box, CircularProgress } from '@mui/material';

import LoginForm from './components/LoginForm';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import CatalogPage from './pages/CatalogPage';
import ChatPage from './pages/chatPage'; // ⬅️ תוקן: ייבוא באות קטנה
import SalesDashboard from './pages/SalesDashboard';
import WarehouseDashboard from './pages/WarehouseDashboard';
import CarpenterDashboard from './pages/CarpenterDashboard';
import ManagerNewOrders from './pages/ManagerNewOrders';
import ManagerOrders from './pages/ManagerOrders';
import Warehouses from './pages/warehouses';

import { loginAction } from './store/slices/authSlice';

function App() {
  const dispatch = useDispatch();
  const { user, loading, error } = useSelector(state => state.auth);
  const navigate = useNavigate();

  const getDefaultPathByRole = (role) => {
    switch (role) {
      case 'MANAGER':
        return '/dashboard';
      case 'SALES':
        return '/sales-dashboard';
      case 'WAREHOUSE':
        return '/warehouse';
      case 'CARPENTER':
        return '/carpenter/dashboard';
      case 'DRIVER':
        return '/chat';
      default:
        return '/chat';
    }
  };

  const handleLogin = async (credentials) => {
    const resultAction = await dispatch(loginAction(credentials));
    if (loginAction.fulfilled.match(resultAction)) {
      // ה-useEffect יטפל בניווט
    } else {
      console.error("Login attempt failed:", resultAction.payload || "Unknown error");
    }
  };

  useEffect(() => {
    if (user) {
      const targetPath = getDefaultPathByRole(user.role);
      if (window.location.pathname === '/login' || window.location.pathname === '/') {
        navigate(targetPath, { replace: true });
      }
    } else if (!loading && window.location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#f0f2f5' }}>
        <CircularProgress sx={{ color: '#D2691E' }} />
      </Box>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={
          getDefaultPathByRole(user.role)
        } replace /> : <LoginForm onLogin={handleLogin} loading={loading} error={error} />}
      />

      <Route element={<MainLayout />}>
        {user ? (
          <>
            <Route path="/" element={<Navigate to={
              getDefaultPathByRole(user.role)
            } replace />} />

            {/* === ראוטים למנהל === */}
            {user.role === 'MANAGER' && <Route path="/dashboard" element={<Dashboard />} />}
            {user.role === 'MANAGER' && <Route path="/employees" element={<Employees />} />}
            {user.role === 'MANAGER' && <Route path="/catalog" element={<CatalogPage />} />}
            {user.role === 'MANAGER' && <Route path="/manager/new-orders" element={<ManagerNewOrders />} />}
            {user.role === 'MANAGER' && <Route path="/manager/orders" element={<ManagerOrders />} />}
            {user.role === 'MANAGER' && <Route path="/warehouses" element={<Warehouses />} />}

            {/* === ראוטים לאיש מכירות === */}
            {user.role === 'SALES' && <Route path="/sales-dashboard" element={<SalesDashboard />} />}
            {user.role === 'SALES' && <Route path="/catalog" element={<CatalogPage />} />}

            {/* === ראוטים למחסנאי === */}
            {user.role === 'WAREHOUSE' && <Route path="/warehouse" element={<WarehouseDashboard />} />}
            {user.role === 'WAREHOUSE' && <Route path="/warehouses" element={<Warehouses />} />}
            {user.role === 'CARPENTER' && <Route path="/carpenter/dashboard" element={<CarpenterDashboard />} />}

            {/* 🆕 === ראוט צ'אט משופר: תמיכה ב-partnerId === */}
            {(user.role === 'MANAGER' || user.role === 'SALES' || user.role === 'WAREHOUSE' || user.role === 'CARPENTER' || user.role === 'DRIVER') && (
              <>
                {/* ⬅️ תוקן: שימוש בקומפוננטה ChatPage ( convention, אך הייבוא באות קטנה) */}
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/chat/:partnerId" element={<ChatPage />} />
              </>
            )}

            {/* === ניתוב לכל נתיב לא ידוע === */}
            <Route path="*" element={<Navigate to={
              getDefaultPathByRole(user.role)
            } replace />} />
          </>
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Route>
    </Routes>
  );
}

export default App;