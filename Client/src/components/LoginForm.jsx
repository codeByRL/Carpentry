import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Alert, Paper } from '@mui/material';
import WoodIcon from '@mui/icons-material/Carpenter';

const LoginForm = ({ onLogin, loading, error }) => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(credentials);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, sm: 4 },
        width: '100%',
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderRadius: 3,
        boxSizing: 'border-box',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 24px 80px rgba(62, 39, 35, 0.18)',
        bgcolor: 'background.paper',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: (theme) =>
            `linear-gradient(90deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
        },
      }}
    >
      <Box
        sx={{
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
          p: 2,
          borderRadius: '50%',
          mb: 2,
          boxShadow: '0 8px 24px rgba(62, 39, 35, 0.25)',
        }}
      >
        <WoodIcon sx={{ color: 'white', fontSize: 40 }} />
      </Box>
      <Typography component="h1" variant="h5" color="primary" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
        WoodShop
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
        כניסה למערכת ניהול הנגרייה
      </Typography>
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
        <TextField margin="normal" required fullWidth label="אימייל" name="email" autoFocus value={credentials.email} onChange={handleChange} />
        <TextField margin="normal" required fullWidth name="password" label="סיסמה" type="password" value={credentials.password} onChange={handleChange} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        <Button type="submit" fullWidth variant="contained" color="primary" disabled={loading} sx={{ mt: 3, mb: 1, py: 1.5 }}>
          {loading ? 'מתחבר...' : 'התחבר'}
        </Button>
      </Box>
    </Paper>
  );
};

export default LoginForm;