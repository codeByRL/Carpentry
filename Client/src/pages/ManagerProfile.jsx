import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Paper, CircularProgress, Button, Divider, Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../components/PageHeader.jsx';
import { selectUser } from '../store/slices/authSlice';
import { fetchEmployees } from '../store/slices/employeesSlice';

const getRoleLabel = (role) =>
  ({ MANAGER: 'מנהל', CARPENTER: 'נגר', WAREHOUSE: 'מחסנאי', SALES: 'מכירות', DRIVER: 'מוביל' }[role] || role);

const getEmploymentLabel = (type) =>
  ({ FULL_TIME: 'משרה מלאה', PART_TIME: 'חלקית', FREELANCE: 'פרילנס' }[type] || '-');

const ManagerProfile = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const authUser = useSelector(selectUser);
  const { employees, loading } = useSelector((state) => state.employees);

  const userId = authUser?.id || authUser?._id;

  useEffect(() => {
    dispatch(fetchEmployees());
  }, [dispatch]);

  const profile = employees.find(
    (e) => e._id === userId || e.email === authUser?.email
  );

  if (loading && !profile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const displayName = profile?.fullName || authUser?.fullName || authUser?.username || 'מנהל';
  const role = profile?.role || authUser?.role || 'MANAGER';

  const rows = profile
    ? [
        ['תפקיד', getRoleLabel(role)],
        ['אימייל', profile.email],
        ['טלפון', profile.phone || '-'],
        ['כתובת', profile.address || '-'],
        ['ת.ז.', profile.idNumber || '-'],
        ['תאריך לידה', profile.birthDate ? new Date(profile.birthDate).toLocaleDateString('he-IL') : '-'],
        ['מגדר', { MALE: 'זכר', FEMALE: 'נקבה', OTHER: 'אחר' }[profile.gender] || '-'],
        ['תאריך תחילת עבודה', profile.startDate ? new Date(profile.startDate).toLocaleDateString('he-IL') : '-'],
        ['סוג העסקה', getEmploymentLabel(profile.employmentType)],
        ['שכר', profile.salary ? `₪${profile.salary.toLocaleString()}` : '-'],
        ['איש קשר לחירום', profile.emergencyContact?.name
          ? `${profile.emergencyContact.name} (${profile.emergencyContact.relation}) — ${profile.emergencyContact.phone}`
          : '-'],
        ['הערות', profile.notes || '-'],
      ]
    : [
        ['תפקיד', getRoleLabel(role)],
        ['אימייל', authUser?.email || '-'],
        ['טלפון', authUser?.phone || '-'],
        ['כתובת', authUser?.address || '-'],
      ];

  return (
    <Box sx={{ width: '100%', maxWidth: 720, mx: 'auto' }}>
      <PageHeader
        title="פרטים אישיים"
        description="הפרופיל שלך כמנהל המערכת."
      />

      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #E0D5CC' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#5D4037', flex: 1 }}>
            {displayName}
          </Typography>
          <Chip label={getRoleLabel(role)} color="secondary" size="small" variant="outlined" />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {!profile && (
          <Typography color="text.secondary" sx={{ mb: 2, fontSize: 14 }}>
            לא נמצאו פרטים מלאים במערכת העובדים. ניתן לעדכן דרך ניהול עובדים אם נוספת רשומה.
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {rows.map(([label, value]) => (
            <Box
              key={label}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 2,
                borderBottom: '1px solid #f0f0f0',
                py: 1.25,
                '&:last-of-type': { borderBottom: 'none' },
              }}
            >
              <Typography sx={{ fontWeight: 600, flexShrink: 0 }}>{label}</Typography>
              <Typography color="text.secondary" sx={{ textAlign: 'right' }}>{value}</Typography>
            </Box>
          ))}
        </Box>

        {profile?.contractFile && (
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            sx={{ mt: 2 }}
            component="a"
            href={`http://localhost:5000/${profile.contractFile}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            צפה בחוזה
          </Button>
        )}

        {profile && (
          <Box sx={{ mt: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<EditIcon />}
              onClick={() => navigate('/employees', { state: { editEmployeeId: profile._id } })}
            >
              עריכת פרטים
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ManagerProfile;
