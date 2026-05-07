import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar, IconButton,
  Dialog, DialogTitle, DialogContent, TextField, MenuItem, DialogActions,
  LinearProgress, Tabs, Tab, Divider, Tooltip, Alert, CircularProgress
} from '@mui/material';
import {
  fetchEmployees, fetchWarehouses,
  fetchEmployeeActiveOrders,
  createEmployee, updateEmployee, deleteEmployee,
  clearSubmitError
} from '../store/slices/employeesSlice';

// --- (הוצא מחוץ לקומפוננטת Employees) ---
const FormField = ({ label, field, formData, handleChange, errors, type = 'text', multiline, rows, children, helperTextOverride, ...props }) => {
  if (children) {
    return (
      <TextField 
        select 
        label={label} 
        fullWidth 
        value={formData[field] || ''}
        onChange={handleChange(field)} 
        error={!!errors[field]}
        helperText={errors[field] || helperTextOverride || ''} 
        {...props}
      >
        {children}
      </TextField>
    );
  }
  return (
    <TextField 
      label={label} 
      type={type} 
      fullWidth 
      value={formData[field] || ''}
      onChange={handleChange(field)} 
      error={!!errors[field]}
      helperText={errors[field] || ''} 
      multiline={multiline} 
      rows={rows}
      InputLabelProps={type === 'date' ? { shrink: true } : undefined} 
      {...props} 
    />
  );
};

const EMPTY_EMPLOYEE = {
  fullName: '', email: '', password: '', role: 'CARPENTER',
  phone: '', address: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
  idNumber: '', birthDate: '', gender: '',
  startDate: '', employmentType: 'FULL_TIME', salary: '',
  bankName: '', branchNumber: '', accountNumber: '',
  warehouse: '', seniority: '', specialization: '',
  notes: ''
};

const validate = (emp, isEdit = false) => {
  const errors = {};
  if (!emp.fullName.trim()) errors.fullName = 'שם מלא הוא שדה חובה';
  if (!emp.email.trim()) errors.email = 'אימייל הוא שדה חובה';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emp.email)) errors.email = 'אימייל לא תקין';
  if (!isEdit && !emp.password) errors.password = 'סיסמה היא שדה חובה';
  if (!isEdit && emp.password && emp.password.length < 6) errors.password = 'סיסמה חייבת להכיל לפחות 6 תווים';
  if (emp.phone && !/^[0-9\-+\s]{7,15}$/.test(emp.phone)) errors.phone = 'מספר טלפון לא תקין';
  if (emp.idNumber && !/^\d{9}$/.test(emp.idNumber)) errors.idNumber = 'ת.ז. חייבת להכיל 9 ספרות';
  if (emp.salary && isNaN(Number(emp.salary))) errors.salary = 'שכר חייב להיות מספר';
  if (emp.role === 'WAREHOUSE' && !emp.warehouse) errors.warehouse = 'יש לבחור מחסן למחסנאי';
  return errors;
};

const TabPanel = ({ children, value, index }) => (
  <Box hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

const Employees = () => {
  const dispatch = useDispatch();
  const {
    employees, warehouses, loading, submitLoading, submitError,
    employeeActiveOrders, activeOrdersLoadingByEmployee
  } = useSelector(state => state.employees);

  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [tab, setTab] = useState(0);
  const [formData, setFormData] = useState(EMPTY_EMPLOYEE);
  const [contractFile, setContractFile] = useState(null);
  const [errors, setErrors] = useState({});

  const [viewOpen, setViewOpen] = useState(false);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [ordersSpecOpen, setOrdersSpecOpen] = useState(false);
  const [ordersSpecEmployee, setOrdersSpecEmployee] = useState(null);

  // ── סינון ──
  const [filterName, setFilterName]               = useState('');
  const [filterRole, setFilterRole]               = useState('');
  const [filterEmployment, setFilterEmployment]   = useState('');
  const [filterMinSeniority, setFilterMinSeniority] = useState('');
  const [sortBy, setSortBy]                       = useState('name');

  useEffect(() => {
    dispatch(fetchEmployees());
    dispatch(fetchWarehouses());
  }, [dispatch]);

  const handleOpenAdd = () => {
    setIsEdit(false); setEditId(null);
    setFormData(EMPTY_EMPLOYEE); setContractFile(null);
    setErrors({}); dispatch(clearSubmitError()); setTab(0); setOpen(true);
  };

  const handleOpenEdit = (emp) => {
    setIsEdit(true); setEditId(emp._id);
    setFormData({
      fullName: emp.fullName || '', email: emp.email || '', password: '',
      role: emp.role || 'CARPENTER', phone: emp.phone || '', address: emp.address || '',
      emergencyContactName: emp.emergencyContact?.name || '',
      emergencyContactPhone: emp.emergencyContact?.phone || '',
      emergencyContactRelation: emp.emergencyContact?.relation || '',
      idNumber: emp.idNumber || '',
      birthDate: emp.birthDate ? emp.birthDate.split('T')[0] : '',
      gender: emp.gender || '',
      startDate: emp.startDate ? emp.startDate.split('T')[0] : '',
      employmentType: emp.employmentType || 'FULL_TIME',
      salary: emp.salary || '',
      bankName: emp.bankDetails?.bankName || '',
      branchNumber: emp.bankDetails?.branchNumber || '',
      accountNumber: emp.bankDetails?.accountNumber || '',
      warehouse: emp.warehouse?._id || emp.warehouse || '',
      seniority: emp.seniority || '', specialization: emp.specialization || '',
      notes: emp.notes || ''
    });
    setContractFile(null); setErrors({});
    dispatch(clearSubmitError()); setTab(0); setOpen(true);
  };

  const handleClose = () => { setOpen(false); setErrors({}); dispatch(clearSubmitError()); };

  const handleChange = (field = '') => (e) => { // ברירת מחדל ל-'' כדי למנוע שגיאה
    setFormData({ ...formData, [field]: e.target.value });
    if (errors[field]) setErrors({ ...errors, [field]: '' });
  };

  const handleSubmit = async () => {
    const validationErrors = validate(formData, isEdit);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // שיפור קטן: מציג את הטאב הנכון אם יש שגיאה
      if (validationErrors.fullName || validationErrors.email || validationErrors.password || validationErrors.idNumber) setTab(0);
      else if (validationErrors.phone) setTab(1);
      else if (validationErrors.salary) setTab(2);
      else if (validationErrors.warehouse) setTab(4); // רק אם הטאב הרביעי הוא מחסן/נגר
      return;
    }
    const data = new FormData();
    Object.entries(formData).forEach(([key, val]) => {
      // אם זה עריכה והסיסמה ריקה, אל תשלח אותה כדי לא לאפס סיסמה קיימת
      if (val !== '' && !(isEdit && key === 'password' && val === '')) data.append(key, val);
    });
    if (contractFile) data.append('contractFile', contractFile);
    const result = await dispatch(isEdit ? updateEmployee({ id: editId, formData: data }) : createEmployee(data));
    if (!result.error) handleClose();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('האם למחוק עובד זה?')) return;
    dispatch(deleteEmployee(id));
  };

  const ORDER_STATUS_LABEL = {
    QUOTATION_PENDING: 'בהצעת מחיר',
    ORDERED: 'הזמנה חדשה',
    WAITING_FOR_WAREHOUSE: 'ממתין למחסן',
    WAITING_FOR_PICKING: 'ממתין לליקוט',
    WAITING_FOR_SUPPLY: 'ממתין לאספקה',
    READY_FOR_SHIPPING: 'מוכן למשלוח',
    IN_PROGRESS: 'בעבודה',
    DONE: 'הושלם',
  };

  const openEmployeeView = (emp) => {
    setViewEmployee(emp);
    setViewOpen(true);
    if (emp?.role === 'CARPENTER' || emp?.role === 'WAREHOUSE') {
      dispatch(fetchEmployeeActiveOrders(emp._id));
    }
  };

  const openEmployeeOrdersSpec = (emp) => {
    if (emp?.role !== 'CARPENTER' && emp?.role !== 'SALES') return;
    setOrdersSpecEmployee(emp);
    setOrdersSpecOpen(true);
    dispatch(fetchEmployeeActiveOrders(emp._id));
  };

  const getRoleColor  = (role) => ({ MANAGER: 'error', CARPENTER: 'primary', WAREHOUSE: 'warning', SALES: 'success', DRIVER: 'secondary' }[role] || 'default');
  const getRoleLabel  = (role) => ({ MANAGER: 'מנהל', CARPENTER: 'נגר', WAREHOUSE: 'מחסנאי', SALES: 'מכירות', DRIVER: 'נהג' }[role] || role);
  const getEmploymentLabel = (type) => ({ FULL_TIME: 'משרה מלאה', PART_TIME: 'חלקית', FREELANCE: 'פרילנס' }[type] || '-');

  const filteredEmployees = employees
    .filter(emp => {
      if (filterName && !emp.fullName?.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterRole && emp.role !== filterRole) return false;
      if (filterEmployment && emp.employmentType !== filterEmployment) return false;
      if (filterMinSeniority && (emp.seniority || 0) < Number(filterMinSeniority)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'seniority') return (b.seniority || 0) - (a.seniority || 0);
      // תיקון: שימוש ב-currentWorkloadHours במקום workloadHours
      if (sortBy === 'workload')  return (b.currentWorkloadHours || 0) - (a.currentWorkloadHours || 0);
      return (a.fullName || '').localeCompare(b.fullName || '', 'he');
    });

  const hasExtraTab = formData.role === 'CARPENTER' || formData.role === 'WAREHOUSE';
  const lastTab = hasExtraTab ? 4 : 3;

  // --- 2. יצירת פונקציית עזר פשוטה לקיצור הכתיבה בתוך ה-JSX ---
  const renderField = (label, field, type = 'text', extras = {}) => (
    <FormField 
      label={label} 
      field={field} 
      type={type} 
      formData={formData} 
      handleChange={handleChange} 
      errors={errors} 
      {...extras} 
    />
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#5D4037' }}>
          ניהול צוות הנגרייה
        </Typography>
        <Button variant="contained" startIcon={<PersonAddIcon />} onClick={handleOpenAdd}>
          הוסף עובד חדש
        </Button>
      </Box>

      {/* ── שורת סינון ── */}
      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 3, boxShadow: 'none', border: '1px solid #E0D5CC', bgcolor: '#FBF7F4' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small" label="🔍 חיפוש לפי שם" value={filterName}
            onChange={e => setFilterName(e.target.value)} sx={{ minWidth: 180 }}
          />
          <TextField select size="small" label="תפקיד" value={filterRole}
            onChange={e => setFilterRole(e.target.value)} sx={{ minWidth: 140 }}>
            {/* נוסף key */}
            <MenuItem key="all-roles" value="">הכל</MenuItem> 
            <MenuItem key="CARPENTER" value="CARPENTER">נגר</MenuItem>
            <MenuItem key="WAREHOUSE" value="WAREHOUSE">מחסנאי</MenuItem>
            <MenuItem key="SALES" value="SALES">מכירות</MenuItem>
            <MenuItem key="DRIVER" value="DRIVER">נהג</MenuItem>
            <MenuItem key="MANAGER" value="MANAGER">מנהל</MenuItem>
          </TextField>
          <TextField select size="small" label="סוג העסקה" value={filterEmployment}
            onChange={e => setFilterEmployment(e.target.value)} sx={{ minWidth: 150 }}>
            {/* נוסף key */}
            <MenuItem key="all-employment" value="">הכל</MenuItem> 
            <MenuItem key="FULL_TIME" value="FULL_TIME">משרה מלאה</MenuItem>
            <MenuItem key="PART_TIME" value="PART_TIME">חלקית</MenuItem>
            <MenuItem key="FREELANCE" value="FREELANCE">פרילנס</MenuItem>
          </TextField>
          <TextField
            size="small" label="ותק מינימלי (שנים)" type="number" value={filterMinSeniority}
            onChange={e => setFilterMinSeniority(e.target.value)}
            sx={{ minWidth: 160 }} inputProps={{ min: 0 }}
          />
          <TextField select size="small" label="מיון לפי" value={sortBy}
            onChange={e => setSortBy(e.target.value)} sx={{ minWidth: 140 }}>
            {/* נוסף key */}
            <MenuItem key="sort-name" value="name">שם</MenuItem> 
            {/* נוסף key */}
            <MenuItem key="sort-seniority" value="seniority">ותק</MenuItem> 
            {/* נוסף key */}
            <MenuItem key="sort-workload" value="workload">עומס עבודה</MenuItem> 
          </TextField>
          {(filterName || filterRole || filterEmployment || filterMinSeniority) && (
            <Button size="small" color="inherit" onClick={() => {
              setFilterName(''); setFilterRole(''); setFilterEmployment(''); setFilterMinSeniority('');
            }}>
              ✕ נקה סינון
            </Button>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
            {filteredEmployees.length} / {employees.length} עובדים
          </Typography>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            borderRadius: 3,
            boxShadow: 3,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            maxWidth: '100%',
          }}
        >
          <Table size="small" sx={{ minWidth: 880 }}>
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell>עובד</TableCell>
                <TableCell>תפקיד</TableCell>
                <TableCell>טלפון</TableCell>
                <TableCell>אימייל</TableCell>
                <TableCell>סוג העסקה</TableCell>
                <TableCell>עומס (נגרים)</TableCell>
                <TableCell>מחסן</TableCell>
                <TableCell align="center">פעולות</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                // נוסף key
                <TableRow key="no-employees"> 
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    {employees.length === 0 ? 'אין עובדים במערכת עדיין' : 'לא נמצאו עובדים התואמים את הסינון'}
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.map((emp) => (
                <TableRow key={emp._id} hover onClick={() => openEmployeeView(emp)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: 'secondary.main' }}>{emp.fullName?.[0]}</Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 500 }}>{emp.fullName}</Typography>
                        <Typography variant="caption" color="text.secondary">{emp.idNumber}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={getRoleLabel(emp.role)} color={getRoleColor(emp.role)} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{emp.phone || '-'}</TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>{getEmploymentLabel(emp.employmentType)}</TableCell>
                  <TableCell sx={{ width: '180px' }}>
                    {emp.role === 'CARPENTER' && emp.currentWorkloadHours > 0 ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min((emp.currentWorkloadHours || 0) * 2, 100)}
                          color={emp.currentWorkloadHours > 40 ? 'error' : 'primary'}
                          sx={{ width: '100%' }}
                        />
                        <Typography variant="body2">{emp.currentWorkloadHours}ש'</Typography>
                      </Box>
                    ) : <Typography variant="body2" color="text.secondary">-</Typography>}
                  </TableCell>
                  <TableCell>
                    {emp.role === 'WAREHOUSE' && emp.warehouse?.name ? emp.warehouse.name : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="צפייה בפרטים">
                      <IconButton color="info" onClick={(e) => { e.stopPropagation(); openEmployeeView(emp); }}>
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    {(emp.role === 'CARPENTER' || emp.role === 'SALES') && (
                      <Tooltip title="מפרט הזמנות פעילות">
                        <IconButton
                          color="warning"
                          onClick={(e) => { e.stopPropagation(); openEmployeeOrdersSpec(emp); }}
                        >
                          <ListAltIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="עריכה">
                      <IconButton color="primary" onClick={(e) => { e.stopPropagation(); handleOpenEdit(emp); }}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="מחיקה">
                      <IconButton color="error" onClick={(e) => { e.stopPropagation(); handleDelete(emp._id); }}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                    {emp.contractFile && (
                      <Tooltip title="הורד חוזה">
                        <IconButton color="success" component="a"
                          onClick={(e) => e.stopPropagation()}
                          href={`http://localhost:5000/${emp.contractFile}`} target="_blank">
                          <UploadFileIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ===== מודל הוספה/עריכה - כאן השימוש ב-renderField המיוצב ===== */}
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 'bold', color: '#5D4037' }}>
          {isEdit ? '✏️ עריכת עובד' : '➕ הוספת עובד חדש'}
        </DialogTitle>
        <Tabs value={tab} onChange={(e, v) => setTab(v)}
          sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable" scrollButtons="auto">
          <Tab label="פרטים בסיסיים" />
          <Tab label="פרטי קשר" />
          <Tab label="פרטי העסקה" />
          <Tab label="בנק וחוזה" />
          {formData.role === 'CARPENTER' && <Tab label="פרטי נגר" />}
          {formData.role === 'WAREHOUSE' && <Tab label="פרטי מחסן" />}
        </Tabs>
        <DialogContent sx={{ pt: 1, minHeight: 350 }}>
          {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}

          <TabPanel value={tab} index={0}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {renderField("שם מלא *", "fullName")}
              {renderField("אימייל *", "email", "email")}
              {renderField(isEdit ? "סיסמה חדשה" : "סיסמה ראשונית *", "password", "password")}
              {renderField("תעודת זהות (9 ספרות)", "idNumber")}
              {renderField("תאריך לידה", "birthDate", "date")}
              {renderField("מגדר", "gender", "text", {
                children: [
                  <MenuItem key="MALE" value="MALE">זכר</MenuItem>,
                  <MenuItem key="FEMALE" value="FEMALE">נקבה</MenuItem>,
                  <MenuItem key="OTHER" value="OTHER">אחר</MenuItem>
                ]
              })}
              {renderField("תפקיד *", "role", "text", {
                children: [
                  <MenuItem key="CARPENTER" value="CARPENTER">נגר</MenuItem>,
                  <MenuItem key="WAREHOUSE" value="WAREHOUSE">מחסנאי</MenuItem>,
                  <MenuItem key="SALES" value="SALES">איש מכירות</MenuItem>,
                  <MenuItem key="DRIVER" value="DRIVER">נהג</MenuItem>,
                  <MenuItem key="MANAGER" value="MANAGER">מנהל</MenuItem>
                ]
              })}
            </Box>
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {renderField("טלפון", "phone")}
              {renderField("כתובת מגורים", "address")}
              <Divider>איש קשר לחירום</Divider>
              {renderField("שם איש קשר לחירום", "emergencyContactName")}
              {renderField("טלפון איש קשר לחירום", "emergencyContactPhone")}
              {renderField("קשר", "emergencyContactRelation")}
            </Box>
          </TabPanel>

          <TabPanel value={tab} index={2}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {renderField("תאריך תחילת עבודה", "startDate", "date")}
              {renderField("סוג העסקה", "employmentType", "text", {
                children: [
                   <MenuItem key="FULL_TIME" value="FULL_TIME">משרה מלאה</MenuItem>,
                   <MenuItem key="PART_TIME" value="PART_TIME">חלקית</MenuItem>,
                   <MenuItem key="FREELANCE" value="FREELANCE">פרילנס</MenuItem>
                ]
              })}
              {renderField("שכר חודשי (₪)", "salary", "number")}
              {renderField("הערות", "notes", "text", { multiline: true, rows: 3 })}
            </Box>
          </TabPanel>

          <TabPanel value={tab} index={3}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Divider>פרטי בנק</Divider>
              {renderField("שם בנק", "bankName")}
              {renderField("מספר סניף", "branchNumber")}
              {renderField("מספר חשבון", "accountNumber")}
              <Divider>חוזה עבודה</Divider>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} sx={{ py: 2 }}>
                {contractFile ? `✅ ${contractFile.name}` : 'העלה קובץ חוזה (PDF / Word)'}
                <input type="file" hidden accept=".pdf,.doc,.docx" onChange={(e) => setContractFile(e.target.files[0])} />
              </Button>
            </Box>
          </TabPanel>

          {formData.role === 'CARPENTER' && (
            <TabPanel value={tab} index={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {renderField("שנות ותק", "seniority", "number")}
                {renderField("התמחות", "specialization")}
              </Box>
            </TabPanel>
          )}

          {formData.role === 'WAREHOUSE' && (
            <TabPanel value={tab} index={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {renderField("בחר מחסן מקושר *", "warehouse", "text", {
                  helperTextOverride: "המחסן שהמחסנאי אחראי עליו",
                  children: warehouses.length === 0 
                    ? <MenuItem key="no-warehouses-option" disabled>אין מחסנים</MenuItem> // נוסף key
                    : warehouses.map(w => <MenuItem key={w._id} value={w._id}>{w.name}</MenuItem>)
                })}
              </Box>
            </TabPanel>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, justifyContent: 'space-between' }}>
          <Button onClick={handleClose} color="inherit">ביטול</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {tab > 0 && <Button onClick={() => setTab(t => t - 1)}>הקודם</Button>}
            {tab < lastTab
              ? <Button variant="outlined" onClick={() => setTab(t => t + 1)}>הבא</Button>
              : <Button variant="contained" onClick={handleSubmit} disabled={submitLoading}>
                  {submitLoading ? <CircularProgress size={20} /> : isEdit ? '💾 שמור' : '✅ צור עובד'}
                </Button>
            }
          </Box>
        </DialogActions>
      </Dialog>
      {/* ===== מודל צפייה ===== */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 'bold', color: '#5D4037', textAlign: 'center' }}>
          👤 {viewEmployee?.fullName}
        </DialogTitle>
        <DialogContent dividers>
          {viewEmployee && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[
                ['תפקיד', getRoleLabel(viewEmployee.role)],
                ['אימייל', viewEmployee.email],
                ['טלפון', viewEmployee.phone || '-'],
                ['כתובת', viewEmployee.address || '-'],
                ['ת.ז.', viewEmployee.idNumber || '-'],
                ['תאריך לידה', viewEmployee.birthDate ? new Date(viewEmployee.birthDate).toLocaleDateString('he-IL') : '-'],
                ['מגדר', { MALE: 'זכר', FEMALE: 'נקבה', OTHER: 'אחר' }[viewEmployee.gender] || '-'], 
                ['תאריך תחילת עבודה', viewEmployee.startDate ? new Date(viewEmployee.startDate).toLocaleDateString('he-IL') : '-'],
                ['סוג העסקה', getEmploymentLabel(viewEmployee.employmentType)],
                ['שכר', viewEmployee.salary ? `₪${viewEmployee.salary.toLocaleString()}` : '-'],
                ['מחסן', viewEmployee.warehouse?.name || '-'],
                ['ותק (נגר)', viewEmployee.role === 'CARPENTER' ? `${viewEmployee.seniority || 0} שנים` : '-'],
                ['התמחות', viewEmployee.specialization || '-'],
                ['איש קשר לחירום', viewEmployee.emergencyContact?.name
                  ? `${viewEmployee.emergencyContact.name} (${viewEmployee.emergencyContact.relation}) — ${viewEmployee.emergencyContact.phone}`
                  : '-'],
                ['הערות', viewEmployee.notes || '-'],
              ].map(([label, value]) => (
                <Box key={label} sx={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid #f0f0f0', py: 1, px: 1,
                  '&:last-of-type': { borderBottom: 'none' }
                }}>
                  <Typography color="text.secondary">{value}</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
                </Box>
              ))}
              {(viewEmployee.role === 'CARPENTER' || viewEmployee.role === 'WAREHOUSE') && (
                <Box sx={{ mt: 1 }}>
                  <Divider sx={{ mb: 1.5 }}>הזמנות פעילות</Divider>
                  {activeOrdersLoadingByEmployee[viewEmployee._id] ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={22} />
                    </Box>
                  ) : (
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>מס' הזמנה</TableCell>
                            <TableCell>לקוח</TableCell>
                            <TableCell>סטטוס</TableCell>
                            <TableCell>אספקה משוערת</TableCell>
                            <TableCell>ימים לאספקה</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(employeeActiveOrders[viewEmployee._id] || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} align="center" sx={{ py: 2.5, color: 'text.secondary' }}>
                                אין הזמנות פעילות לעובד זה
                              </TableCell>
                            </TableRow>
                          ) : (
                            (employeeActiveOrders[viewEmployee._id] || []).map((order) => {
                              const dueDate = order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate) : null;
                              const now = new Date();
                              const msPerDay = 24 * 60 * 60 * 1000;
                              const daysToDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / msPerDay) : null;
                              const isUrgent = daysToDue !== null && daysToDue <= 2;

                              return (
                                <TableRow
                                  key={order._id}
                                  sx={isUrgent ? { bgcolor: '#FFEBEE', '& td': { color: '#B71C1C', fontWeight: 600 } } : {}}
                                >
                                  <TableCell>#{order._id?.slice(-6)}</TableCell>
                                  <TableCell>{order.customer?.name || '-'}</TableCell>
                                  <TableCell>{ORDER_STATUS_LABEL[order.status] || order.status}</TableCell>
                                  <TableCell>
                                    {dueDate ? dueDate.toLocaleDateString('he-IL') : '-'}
                                    {isUrgent ? ' (דחוף)' : ''}
                                  </TableCell>
                                  <TableCell>
                                    {daysToDue === null ? '-' : daysToDue}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}
              {viewEmployee.contractFile && (
                <Button variant="outlined" startIcon={<UploadFileIcon />} sx={{ mt: 1 }}
                  component="a" href={`http://localhost:5000/${viewEmployee.contractFile}`} target="_blank">
                  צפה בחוזה
                </Button>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setViewOpen(false); handleOpenEdit(viewEmployee); }} color="primary">
            ✏️ עבור לעריכה
          </Button>
          <Button onClick={() => setViewOpen(false)}>סגור</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={ordersSpecOpen} onClose={() => setOrdersSpecOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 'bold', color: '#5D4037' }}>
          📋 מפרט הזמנות פעילות — {ordersSpecEmployee?.fullName || ''}
        </DialogTitle>
        <DialogContent dividers>
          {!ordersSpecEmployee ? null : (
            activeOrdersLoadingByEmployee[ordersSpecEmployee._id] ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>מס' הזמנה</TableCell>
                      <TableCell>לקוח</TableCell>
                      <TableCell>סטטוס</TableCell>
                      <TableCell>אספקה משוערת</TableCell>
                      <TableCell>ימים לאספקה</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(employeeActiveOrders[ordersSpecEmployee._id] || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 2.5, color: 'text.secondary' }}>
                          אין הזמנות פעילות לעובד זה
                        </TableCell>
                      </TableRow>
                    ) : (
                      (employeeActiveOrders[ordersSpecEmployee._id] || []).map((order) => {
                        const dueDate = order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate) : null;
                        const now = new Date();
                        const msPerDay = 24 * 60 * 60 * 1000;
                        const daysToDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / msPerDay) : null;
                        const isUrgent = daysToDue !== null && daysToDue <= 2;

                        return (
                          <TableRow
                            key={order._id}
                            sx={isUrgent ? { bgcolor: '#FFEBEE', '& td': { color: '#B71C1C', fontWeight: 600 } } : {}}
                          >
                            <TableCell>#{order._id?.slice(-6)}</TableCell>
                            <TableCell>{order.customer?.name || '-'}</TableCell>
                            <TableCell>{ORDER_STATUS_LABEL[order.status] || order.status}</TableCell>
                            <TableCell>
                              {dueDate ? dueDate.toLocaleDateString('he-IL') : '-'}
                              {isUrgent ? ' (דחוף)' : ''}
                            </TableCell>
                            <TableCell>{daysToDue === null ? '-' : daysToDue}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrdersSpecOpen(false)}>סגור</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Employees;