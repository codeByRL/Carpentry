import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
  IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Tooltip, Avatar
} from '@mui/material';

import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import InventoryIcon from '@mui/icons-material/Inventory';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import CarpenterIcon from '@mui/icons-material/Carpenter';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import ChatIcon from '@mui/icons-material/Chat';
import CategoryIcon from '@mui/icons-material/Category';
import TextureIcon from '@mui/icons-material/Texture';

import { logoutAction } from '../store/slices/authSlice';
import { resetChatState } from '../store/slices/chatSlice';
import { authService } from '../services/authService';
import ChatNotifications from './ChatNotifications';

const drawerWidth = 240;

const ROLE_LABEL = {
  MANAGER: 'מנהל',
  CARPENTER: 'נגר',
  WAREHOUSE: 'מחסנאי',
  SALES: 'מכירות',
  DRIVER: 'נהג',
};

const MainLayout = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
    // ✅ דשבורד למנהל ומכירות
    { text: 'דשבורד', icon: <DashboardIcon />, path: '/dashboard', roles: ['MANAGER', 'SALES'] },
    // ✅ דשבורד נפרד למחסנאי
    { text: 'דשבורד מחסן', icon: <WarehouseIcon />, path: '/warehouse', roles: ['WAREHOUSE'] },

    // ✅ דשבורד נגר ראשון בתפריט
    { text: 'דשבורד נגר', icon: <AssignmentIcon />, path: '/carpenter/dashboard', roles: ['CARPENTER'] },

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

    { text: 'משלוחים', icon: <LocalShippingIcon />, path: '/driver/deliveries', roles: ['DRIVER'] },
    { text: 'קטלוג מוצרים', icon: <CategoryIcon />, path: '/catalog', roles: ['MANAGER', 'SALES'] },
    { text: 'קטלוג בדי ריפוד', icon: <TextureIcon />, path: '/sales/fabrics', roles: ['SALES'] },
    { text: 'מלאי ומחסן', icon: <InventoryIcon />, path: '/warehouses', roles: ['MANAGER', 'WAREHOUSE'] },
    { text: 'ניהול עובדים', icon: <PeopleIcon />, path: '/employees', roles: ['MANAGER'] },
    { text: "צ'אט", icon: <ChatIcon />, path: '/chat', roles: ['MANAGER', 'WAREHOUSE', 'CARPENTER', 'SALES', 'DRIVER'], isChatLink: true },
  ];

  const visibleItems = menuItems.filter(item => user?.role && item.roles.includes(user.role));

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#2C1A0E', color: 'white' }}>
      {/* Logo */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: '#D2691E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CarpenterIcon sx={{ fontSize: 22, color: 'white' }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: 'white', lineHeight: 1.2 }}>
            WoodShop
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#A1887F' }}>
            מערכת ניהול
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* User Info */}
      <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: '#D2691E', width: 34, height: 34, fontSize: 14, fontWeight: 700 }}>
          {user?.fullName?.[0] || user?.username?.[0]}
        </Avatar>
        <Box>
          <Typography sx={{ color: 'white', fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
            {user?.fullName || user?.username}
          </Typography>
          <Typography sx={{ color: '#A1887F', fontSize: 11 }}>
            {ROLE_LABEL[user?.role] || user?.role}
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', mb: 1 }} />

      {/* Menu */}
      <List sx={{ flexGrow: 1, px: 1.5, py: 0.5 }}>
        {visibleItems.map((item) => {
          const isActive = item.isChatLink
            ? location.pathname.startsWith('/chat')
            : location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path, item.state ? { state: item.state } : undefined); setMobileOpen(false); }}
                sx={{
                  borderRadius: 2, py: 1, px: 1.5,
                  color: isActive ? 'white' : '#BCAAA4',
                  bgcolor: isActive ? '#D2691E' : 'transparent',
                  '&:hover': { bgcolor: isActive ? '#BF5A18' : 'rgba(210,105,30,0.12)', color: 'white' },
                  transition: 'all 0.15s ease',
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 34, '& svg': { fontSize: 19 } }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{ fontSize: 13.5, fontWeight: isActive ? 600 : 400 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* Logout */}
      <Box sx={{ px: 1.5, py: 1.5 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 2, py: 1, px: 1.5, color: '#EF9A9A',
            '&:hover': { bgcolor: 'rgba(239,83,80,0.12)', color: '#EF5350' },
            transition: 'all 0.15s ease',
          }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 34, '& svg': { fontSize: 19 } }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="התנתקות" primaryTypographyProps={{ fontSize: 13.5 }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', direction: 'rtl' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          left: 'auto',
          right: { sm: `${drawerWidth}px` },
          bgcolor: 'white', color: '#333', borderBottom: '1px solid #EEEEEE',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: '56px !important' }}>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#5D4037' }}>
            {visibleItems.find(i => location.pathname.startsWith(i.path))?.text || 'WoodShop ERP'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChatNotifications />
            <Tooltip title="התנתקות">
              <IconButton onClick={handleLogout} size="small" sx={{ color: '#BDBDBD', '&:hover': { color: '#EF5350' } }}>
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
          p: { xs: 2, sm: 2.5 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          maxWidth: { xs: '100%', sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: '#F5F0EB',
          mt: '56px',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          ml: { sm: `-${drawerWidth}px` },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout;