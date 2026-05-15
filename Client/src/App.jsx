import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Box, CircularProgress } from '@mui/material';

import LoginForm from './components/LoginForm';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import ManagerProfile from './pages/ManagerProfile';
import CatalogPage from './pages/CatalogPage';
import ChatPage from './pages/chatPage'; // ⬅️ תוקן: ייבוא באות קטנה
import SalesDashboard from './pages/SalesDashboard';
import SalesFabricsCatalog from './pages/SalesFabricsCatalog';
import SalesFormicaCatalog from './pages/SalesFormicaCatalog';
import SalesHandlesCatalog from './pages/SalesHandlesCatalog';
import WarehouseDashboard from './pages/WarehouseDashboard';
import CarpenterDashboard from './pages/CarpenterDashboard';
import ManagerNewOrders from './pages/ManagerNewOrders';
import ManagerOrders from './pages/ManagerOrders';
import Warehouses from './pages/warehouses';
import DriverDeliveries from './pages/DriverDeliveries';
import DriverClaimToday from './pages/DriverClaimToday';
import DriverMonthlyDeliveries from './pages/DriverMonthlyDeliveries';

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
        return '/driver/deliveries';
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh', bgcolor: 'background.default' }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={
          getDefaultPathByRole(user.role)
        } replace /> : (
          <Box
            sx={{
              minHeight: '100dvh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: { xs: 2, sm: 3 },
              boxSizing: 'border-box',
              background: (theme) =>
                `radial-gradient(1200px 600px at 50% -10%, ${theme.palette.secondary.light}33, transparent 55%), linear-gradient(165deg, ${theme.palette.background.default} 0%, #e8dfd4 45%, ${theme.palette.primary.light}22 100%)`,
            }}
          >
            <LoginForm onLogin={handleLogin} loading={loading} error={error} />
          </Box>
        )}
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
            {user.role === 'MANAGER' && <Route path="/manager/profile" element={<ManagerProfile />} />}
            {user.role === 'MANAGER' && <Route path="/catalog" element={<CatalogPage />} />}
            {user.role === 'MANAGER' && <Route path="/manager/new-orders" element={<ManagerNewOrders />} />}
            {(user.role === 'MANAGER' || user.role === 'CARPENTER') && (
              <Route path="/manager/orders" element={<ManagerOrders />} />
            )}
            {user.role === 'MANAGER' && <Route path="/warehouses" element={<Warehouses />} />}

            {/* === ראוטים לאיש מכירות === */}
            {user.role === 'SALES' && <Route path="/sales-dashboard" element={<SalesDashboard />} />}
            {user.role === 'SALES' && <Route path="/sales/new-order" element={<SalesDashboard />} />}
            {user.role === 'SALES' && <Route path="/catalog" element={<CatalogPage />} />}
            {user.role === 'SALES' && <Route path="/sales/fabrics" element={<SalesFabricsCatalog />} />}
            {user.role === 'SALES' && <Route path="/sales/formica" element={<SalesFormicaCatalog />} />}
            {user.role === 'SALES' && <Route path="/sales/handles" element={<SalesHandlesCatalog />} />}

            {/* === ראוטים למחסנאי === */}
            {user.role === 'WAREHOUSE' && <Route path="/warehouse" element={<WarehouseDashboard />} />}
            {user.role === 'WAREHOUSE' && <Route path="/warehouses" element={<Warehouses />} />}
            {user.role === 'CARPENTER' && <Route path="/carpenter/dashboard" element={<CarpenterDashboard />} />}
            {user.role === 'DRIVER' && (
              <Route path="/driver/dashboard" element={<Navigate to="/driver/deliveries" replace />} />
            )}
            {user.role === 'DRIVER' && <Route path="/driver/claim-today" element={<DriverClaimToday />} />}
            {user.role === 'DRIVER' && <Route path="/driver/deliveries" element={<DriverDeliveries />} />}
            {user.role === 'DRIVER' && <Route path="/driver/monthly" element={<DriverMonthlyDeliveries />} />}

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