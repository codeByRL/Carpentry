import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
  IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Tooltip, Avatar, useTheme,
} from '@mui/material';

import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import InventoryIcon from '@mui/icons-material/Inventory';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import CarpenterIcon from '@mui/icons-material/Carpenter';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import ChatIcon from '@mui/icons-material/Chat';
import CategoryIcon from '@mui/icons-material/Category';
import TextureIcon from '@mui/icons-material/Texture';
import LayersIcon from '@mui/icons-material/Layers';
import HardwareIcon from '@mui/icons-material/Hardware';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import RouteIcon from '@mui/icons-material/Route';
import PostAddIcon from '@mui/icons-material/PostAdd';

import { logoutAction } from '../store/slices/authSlice';
import { resetChatState } from '../store/slices/chatSlice';
import { authService } from '../services/authService';
import ChatNotifications from './ChatNotifications';
import { useAppRealtime } from '../hooks/useAppRealtime';

const drawerWidth = 240;

/** התאמת נתיב לפריט תפריט — מונע כפילות למשל /warehouse מול /warehouses */
const isMenuItemActive = (pathname, item) => {
  if (item.isChatLink) return pathname.startsWith('/chat');
  if (item.path === '/sales/new-order') return false;

  const base = item.path;
  if (!pathname.startsWith(base)) return false;
  const rest = pathname.slice(base.length);
  return rest === '' || rest.startsWith('/');
};

const ROLE_LABEL = {
  MANAGER: 'מנהל',
  CARPENTER: 'נגר',
  WAREHOUSE: 'מחסנאי',
  SALES: 'מכירות',
  DRIVER: 'מוביל',
};

const MainLayout = () => {
  const theme = useTheme();
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useAppRealtime();

  useEffect(() => {
    if (!user?.id) {
      dispatch(resetChatState());
    }
  }, [user?.id, dispatch]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    dispatch(logoutAction());
    navigate('/login');
  };

  const menuItems = [
    // ✅ לוח מחוונים — אחיד לכל התפקידים (נתיב נפרד למחסן / מכירות)
    { text: 'לוח מחוונים', icon: <DashboardIcon />, path: '/dashboard', roles: ['MANAGER'] },
    { text: 'לוח מחוונים', icon: <DashboardIcon />, path: '/sales-dashboard', roles: ['SALES'] },
    { text: 'הזמנה חדשה', icon: <PostAddIcon />, path: '/sales/new-order', roles: ['SALES'] },
    { text: 'לוח מחוונים', icon: <WarehouseIcon />, path: '/warehouse', roles: ['WAREHOUSE'] },

    { text: 'לוח מחוונים', icon: <AssignmentIcon />, path: '/carpenter/dashboard', roles: ['CARPENTER'] },
    { text: 'לוח מחוונים', icon: <DashboardIcon />, path: '/driver/deliveries', roles: ['DRIVER'] },
    { text: 'תכנון מסלול יומי', icon: <RouteIcon />, path: '/driver/claim-today', roles: ['DRIVER'] },
    { text: 'הובלות החודש', icon: <CalendarMonthIcon />, path: '/driver/monthly', roles: ['DRIVER'] },

    // ✅ הזמנות – גישה קבועה לתצוגת ההזמנות גם לנגר
    { text: 'הזמנות חדשות', icon: <AddShoppingCartIcon />, path: '/manager/new-orders', roles: ['MANAGER'] },
    { text: 'הזמנות פעילות', icon: <ShoppingCartIcon />, path: '/manager/orders', roles: ['MANAGER'] },
    {
      text: 'הזמנות פעילות',
      icon: <ShoppingCartIcon />,
      path: '/manager/orders',
      roles: ['CARPENTER'],
      state: {
        initialStatusFilter: 'IN_PROGRESS',
        emptyText: 'אין הזמנות בסטטוס "בעבודה" כרגע',
      },
    },

    { text: 'קטלוג מוצרים', icon: <CategoryIcon />, path: '/catalog', roles: ['MANAGER', 'SALES'] },
    { text: 'קטלוג בדי ריפוד', icon: <TextureIcon />, path: '/sales/fabrics', roles: ['SALES'] },
    { text: 'קטלוג פורמייקה', icon: <LayersIcon />, path: '/sales/formica', roles: ['SALES'] },
    { text: 'קטלוג ידיות', icon: <HardwareIcon />, path: '/sales/handles', roles: ['SALES'] },
    { text: 'סטטוס מחסן', icon: <InventoryIcon />, path: '/warehouses', roles: ['MANAGER'] },
    { text: 'מלאי ומחסן', icon: <InventoryIcon />, path: '/warehouses', roles: ['WAREHOUSE'] },
    { text: 'ניהול עובדים', icon: <PeopleIcon />, path: '/employees', roles: ['MANAGER'] },
    { text: "צ'אט", icon: <ChatIcon />, path: '/chat', roles: ['MANAGER', 'WAREHOUSE', 'CARPENTER', 'SALES', 'DRIVER'], isChatLink: true },
  ];

  const visibleItems = menuItems.filter(item => user?.role && item.roles.includes(user.role));

  const drawerContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: `linear-gradient(175deg, ${theme.palette.primary.dark} 0%, #1a1210 55%, #120d0b 100%)`,
        color: 'common.white',
      }}
    >
      {/* Logo */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2.5,
            background: `linear-gradient(135deg, ${theme.palette.secondary.light} 0%, ${theme.palette.secondary.main} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          }}
        >
          <CarpenterIcon sx={{ fontSize: 22, color: 'white' }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 17, color: 'common.white', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            WoodShop
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            מערכת ניהול נגרייה
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* User Info */}
      <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar
          sx={{
            bgcolor: 'secondary.main',
            width: 36,
            height: 36,
            fontSize: 14,
            fontWeight: 700,
            border: '2px solid rgba(255,255,255,0.15)',
          }}
        >
          {user?.fullName?.[0] || user?.username?.[0]}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: 'common.white', fontWeight: 600, fontSize: 13, lineHeight: 1.3 }} noWrap>
            {user?.fullName || user?.username}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
            {ROLE_LABEL[user?.role] || user?.role}
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 1 }} />

      {/* Menu */}
      <List sx={{ flexGrow: 1, px: 1.5, py: 0.5 }}>
        {visibleItems.map((item) => {
          const isActive = isMenuItemActive(location.pathname, item);
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path, item.state ? { state: item.state } : undefined); setMobileOpen(false); }}
                sx={{
                  borderRadius: 2,
                  py: 1.1,
                  px: 1.5,
                  border: '1px solid',
                  borderColor: isActive ? 'rgba(229, 154, 90, 0.55)' : 'transparent',
                  color: isActive ? 'common.white' : 'rgba(255,255,255,0.65)',
                  bgcolor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  boxShadow: isActive ? 'inset 3px 0 0 rgba(229, 154, 90, 0.9)' : 'none',
                  '&:hover': {
                    bgcolor: isActive ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)',
                    color: 'common.white',
                  },
                  transition: 'all 0.18s ease',
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 36, '& svg': { fontSize: 20 } }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{ fontSize: 13.5, fontWeight: isActive ? 700 : 500 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* Logout */}
      <Box sx={{ px: 1.5, py: 1.5 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            py: 1.1,
            px: 1.5,
            color: '#FFCDD2',
            '&:hover': { bgcolor: 'rgba(239,83,80,0.15)', color: '#FFEBEE' },
            transition: 'all 0.18s ease',
          }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 36, '& svg': { fontSize: 20 } }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="התנתקות" primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        direction: 'rtl',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        minHeight: '100dvh',
        boxSizing: 'border-box',
      }}
    >
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          width: { xs: '100%', sm: `calc(100% - ${drawerWidth}px)` },
          left: 'auto',
          right: { xs: 0, sm: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: '56px !important', gap: 1 }}>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ display: { sm: 'none' }, flexShrink: 0 }}>
            <MenuIcon />
          </IconButton>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { xs: 14, sm: 15 },
              color: 'primary.main',
              flex: 1,
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              px: 0.5,
            }}
          >
            {visibleItems.find(i => location.pathname.startsWith(i.path))?.text || 'WoodShop'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <ChatNotifications />
            <Tooltip title="התנתקות">
              <IconButton onClick={handleLogout} size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary" open={mobileOpen} onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth } }}>
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent" anchor="right"
          sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, border: 'none' } }}
          open>
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 1.5, sm: 2.5 },
          width: { xs: '100%', sm: `calc(100% - ${drawerWidth}px)` },
          maxWidth: { xs: '100%', sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100dvh',
          bgcolor: 'background.default',
          mt: '56px',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          ml: { sm: `-${drawerWidth}px` },
        }}
      >
        <Toolbar />
        <Box sx={{ maxWidth: 1440, mx: 'auto', width: '100%', minWidth: 0, px: { xs: 0, sm: 0 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout;