import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Paper, Alert, CircularProgress } from '@mui/material';
import API from '../services/api';
import PageHeader from '../components/PageHeader.jsx';

const BASE_URL = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:5001';

const SalesHandlesCatalog = () => {
  const [handles, setHandles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    API.get('/base-products?isMaterial=true&type=handle&limit=500')
      .then((res) => {
        if (!mounted) return;
        setHandles(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!mounted) return;
        setHandles([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <PageHeader title="קטלוג ידיות" description="ידיות ואביזרי פרזול לפי דגם — לשילוב בהצעות מחיר." />
      {handles.length === 0 ? (
        <Alert severity="info">אין ידיות זמינות כרגע.</Alert>
      ) : (
        <Grid container spacing={2}>
          {handles.map((h) => (
            <Grid key={h._id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': { transform: 'translateY(-3px)', boxShadow: 4 },
                }}
              >
                <Box sx={{ height: 170, borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100', mb: 1.5 }}>
                  {h.image ? (
                    <img
                      src={h.image.startsWith('http') ? h.image : `${BASE_URL}${h.image}`}
                      alt={h.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : null}
                </Box>
                <Typography sx={{ fontWeight: 700 }}>{h.name}</Typography>
                <Typography sx={{ fontSize: 12, color: '#7B6A5F' }}>{h.code || 'ללא קוד'}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default SalesHandlesCatalog;
