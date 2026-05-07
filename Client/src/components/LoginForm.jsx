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
      elevation={6}
      sx={{
        p: { xs: 2.5, sm: 4 },
        width: '100%',
        maxWidth: 440,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderRadius: 4,
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ bgcolor: 'primary.main', p: 2, borderRadius: '50%', mb: 2 }}>
        <WoodIcon sx={{ color: 'white', fontSize: 40 }} />
      </Box>
      <Typography component="h1" variant="h5" sx={{ fontWeight: 'bold', color: '#5D4037' }}>
        נגריית אקספרס - כניסה
      </Typography>
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
        <TextField margin="normal" required fullWidth label="אימייל" name="email" autoFocus value={credentials.email} onChange={handleChange} />
        <TextField margin="normal" required fullWidth name="password" label="סיסמה" type="password" value={credentials.password} onChange={handleChange} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        <Button type="submit" fullWidth variant="contained" disabled={loading} sx={{ mt: 3, mb: 2, py: 1.5 }}>
          {loading ? 'מתחבר...' : 'התחבר'}
        </Button>
      </Box>
    </Paper>
  );
};

export default LoginForm;