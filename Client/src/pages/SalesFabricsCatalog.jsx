import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Paper, Alert, CircularProgress } from '@mui/material';
import API from '../services/api';

const BASE_URL = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:5001';

const SalesFabricsCatalog = () => {
  const [fabrics, setFabrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    API.get('/base-products?isMaterial=true&type=fabric&limit=500')
      .then((res) => {
        if (!mounted) return;
        setFabrics(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!mounted) return;
        setFabrics([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress sx={{ color: '#D2691E' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#3E2723', mb: 2 }}>
        קטלוג בדי ריפוד
      </Typography>
      {fabrics.length === 0 ? (
        <Alert severity="info">אין בדי ריפוד זמינים כרגע.</Alert>
      ) : (
        <Grid container spacing={2}>
          {fabrics.map((f) => (
            <Grid key={f._id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Paper sx={{ p: 1.5, borderRadius: 3, border: '1px solid #E8C9B0', bgcolor: '#FBF0E9' }}>
                <Box sx={{ height: 170, borderRadius: 2, overflow: 'hidden', bgcolor: '#F5F5F5', mb: 1 }}>
                  {f.image ? (
                    <img
                      src={f.image.startsWith('http') ? f.image : `${BASE_URL}${f.image}`}
                      alt={f.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : null}
                </Box>
                <Typography sx={{ fontWeight: 700 }}>{f.name}</Typography>
                <Typography sx={{ fontSize: 12, color: '#7B6A5F' }}>{f.code || 'ללא קוד'}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default SalesFabricsCatalog;
