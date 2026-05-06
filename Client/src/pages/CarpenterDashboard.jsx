import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ChatIcon from "@mui/icons-material/Chat";
import API from "../services/api";
import { fetchNotifications, markNotificationRead } from "../store/slices/notificationsSlice";
import { fetchActiveChatPartners } from "../store/slices/chatSlice";

const C = {
  primary: "#D2691E",
  dark: "#3E2723",
  medium: "#A0522D",
  light: "#FBF0E9",
  border: "#E5D5C8",
};

const STAT_COLORS = ["#D2691E", "#6B3520", "#A0522D", "#2E7D32"];
const STAT_ICONS = [
  <HourglassEmptyIcon sx={{ fontSize: 26 }} />,
  <AssignmentIcon sx={{ fontSize: 26 }} />,
  <PauseCircleOutlineIcon sx={{ fontSize: 26 }} />,
  <LocalShippingIcon sx={{ fontSize: 26 }} />,
];

const cardSx = {
  borderRadius: 3,
  border: "1px solid #E5D5C8",
  height: "100%",
  bgcolor: "#fff",
};

const sectionTitleSx = { fontWeight: 700, fontSize: 16, color: "#4E342E", mb: 1.5 };
const BASE_URL = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5001";
const HOURS_PER_WORK_WEEK = 40;

const StatCard = ({ title, value, sub, color, icon, onClick, active }) => (
  <Box
    onClick={onClick}
    sx={{
      bgcolor: color,
      borderRadius: 3,
      p: 2.5,
      height: 130,
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      transition: "0.15s",
      outline: active ? "2px solid rgba(255,255,255,0.75)" : "none",
      "&:hover": { transform: "translateY(-2px)", opacity: 0.92 },
    }}
  >
    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
      <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
        {title}
      </Typography>
      <Box sx={{ color: "rgba(255,255,255,0.7)" }}>{icon}</Box>
    </Box>
    <Box>
      <Typography sx={{ fontSize: 32, fontWeight: 700, color: "white", lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.7)", mt: 0.4 }}>
        {sub}
      </Typography>
    </Box>
  </Box>
);

const CarpenterDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pauseDialogOrder, setPauseDialogOrder] = useState(null);
  const [pauseReason, setPauseReason] = useState("");
  const [characterizeProduct, setCharacterizeProduct] = useState(null);
  const [newMaterialDialogOpen, setNewMaterialDialogOpen] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState("");
  const [newMaterialUnit, setNewMaterialUnit] = useState("יח׳");
  const [newMaterialSupplier, setNewMaterialSupplier] = useState("");
  const [newMaterialDescription, setNewMaterialDescription] = useState("");
  const { notifications } = useSelector((s) => s.notifications);
  const chatState = useSelector((s) => s.chat);
  const [ordersTab, setOrdersTab] = useState(null); // WAITING | ACTIVE | PAUSED | DONE
  const [characterizeForm, setCharacterizeForm] = useState({
    estimatedWorkWeeks: "",
    baseProducts: [{ product: "", quantity: 1 }],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [ordersRes, catalogRes, materialsRes] = await Promise.all([
        API.get("/carpenter/my-orders"),
        API.get("/carpenter/products-for-characterization"),
        API.get("/base-products?limit=5000"),
      ]);
      setOrders(ordersRes.data || []);
      setCatalogProducts(catalogRes.data || []);
      setMaterials(materialsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "שגיאה בטעינת נתוני נגר");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    dispatch(fetchActiveChatPartners());
    dispatch(fetchNotifications());
  }, [dispatch]);

  const totalUnreadChatCount =
    chatState?.activeChatPartners?.reduce((acc, p) => acc + (Number(p.unreadCount) || 0), 0) || 0;
  const unreadNotif = (notifications || []).filter((n) => !n.isRead && n.type !== "CHAT").length;

  const waitingForWork = useMemo(
    () => orders.filter((o) => o.status === "READY_FOR_SHIPPING" && !o.receivedByCarpenter && !o.carpenterCompletedAt),
    [orders]
  );
  const activeWork = useMemo(
    () => orders.filter((o) => o.status === "IN_PROGRESS" && !o.carpenterPaused),
    [orders]
  );
  const pausedWork = useMemo(
    () => orders.filter((o) => o.carpenterPaused),
    [orders]
  );
  const doneWaitingDriver = useMemo(
    () => orders.filter((o) => o.status === "READY_FOR_SHIPPING" && !!o.carpenterCompletedAt),
    [orders]
  );

  const stats = [
    { key: "WAITING", title: "ממתינות להתחלה", value: waitingForWork.length, sub: "מוכנות להתחלת עבודה" },
    { key: "ACTIVE", title: "בעבודה", value: activeWork.length, sub: "עבודות פעילות" },
    { key: "PAUSED", title: "מושהות", value: pausedWork.length, sub: "תקלה/המתנה" },
    { key: "DONE", title: "ממתינות למוביל", value: doneWaitingDriver.length, sub: "הושלמו אצל הנגר" },
  ];

  const runAction = async (requestFn) => {
    try {
      setSubmitLoading(true);
      await requestFn();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "שגיאה בביצוע הפעולה");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleMarkReceived = (orderId) =>
    runAction(() => API.patch(`/carpenter/orders/${orderId}/received`));

  const handleMarkDone = (orderId) =>
    runAction(() => API.patch(`/carpenter/orders/${orderId}/done`));

  const handlePauseOrder = async () => {
    if (!pauseDialogOrder || !pauseReason.trim()) return;
    await runAction(() =>
      API.patch(`/carpenter/orders/${pauseDialogOrder.orderId}/pause`, { reason: pauseReason.trim() })
    );
    setPauseDialogOrder(null);
    setPauseReason("");
  };

  const handleResumeOrder = (orderId) =>
    runAction(() => API.patch(`/carpenter/orders/${orderId}/resume`));

  const printCustomerDeliveryLabel = (order) => {
    const customerName = order?.customerName || "—";
    const customerAddress = order?.deliveryAddress || "—";
    const orderCode = order?.orderId ? `#${String(order.orderId).slice(-6)}` : "—";
    const printDate = new Date().toLocaleString("he-IL");
    const html = `
      <html dir="rtl" lang="he">
        <head>
          <title>תווית משלוח ${orderCode}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #222; }
            .label { border: 2px dashed #444; border-radius: 8px; padding: 16px; max-width: 520px; }
            .title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
            .meta { font-size: 12px; color: #666; margin-bottom: 12px; }
            .line { margin: 4px 0; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="title">תווית הובלה ללקוח ${orderCode}</div>
            <div class="meta">הודפס בתאריך: ${printDate}</div>
            <div class="line"><b>לקוח:</b> ${customerName}</div>
            <div class="line"><b>כתובת:</b> ${customerAddress}</div>
          </div>
        </body>
      </html>
    `;
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 250);
  };

  const openCharacterizeDialog = (product) => {
    setCharacterizeProduct(product);
    setCharacterizeForm({
      estimatedWorkWeeks: product.estimatedWorkTime
        ? Number(product.estimatedWorkTime) / HOURS_PER_WORK_WEEK
        : "",
      baseProducts: product.baseProducts?.length
        ? product.baseProducts.map((b) => ({
            product: b.product?._id || b.product || "",
            quantity: b.quantity || 1,
          }))
        : [{ product: "", quantity: 1 }],
    });
  };

  const updateBaseProduct = (index, key, value) => {
    setCharacterizeForm((prev) => {
      const next = [...prev.baseProducts];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, baseProducts: next };
    });
  };

  const addBaseProduct = () => {
    setCharacterizeForm((prev) => ({
      ...prev,
      baseProducts: [...prev.baseProducts, { product: "", quantity: 1 }],
    }));
  };

  const removeBaseProduct = (index) => {
    setCharacterizeForm((prev) => ({
      ...prev,
      baseProducts: prev.baseProducts.filter((_, i) => i !== index),
    }));
  };

  const handleSubmitCharacterization = async () => {
    if (!characterizeProduct) return;
    const cleanedBaseProducts = characterizeForm.baseProducts
      .filter((b) => b.product && Number(b.quantity) > 0)
      .map((b) => ({ product: b.product, quantity: Number(b.quantity) }));

    if (!cleanedBaseProducts.length || !Number(characterizeForm.estimatedWorkWeeks)) {
      setError("יש למלא זמן עבודה בשבועות ולהוסיף לפחות חומר גלם אחד");
      return;
    }

    await runAction(() =>
      API.post(`/carpenter/characterize/${characterizeProduct._id}`, {
        baseProducts: cleanedBaseProducts,
        estimatedWorkTime: Number(characterizeForm.estimatedWorkWeeks) * HOURS_PER_WORK_WEEK,
      })
    );

    setCharacterizeProduct(null);
  };

  const handleCreateNewMaterial = async () => {
    if (!newMaterialName.trim() || !newMaterialUnit.trim()) {
      setError("יש למלא שם חומר ויחידת מידה");
      return;
    }
    try {
      setSubmitLoading(true);
      const res = await API.post("/carpenter/base-products", {
        name: newMaterialName.trim(),
        unit: newMaterialUnit.trim(),
        supplier: newMaterialSupplier.trim(),
        description: newMaterialDescription.trim(),
      });

      const newProduct = res.data;
      setMaterials((prev) => [...prev, newProduct].sort((a, b) => (a.name || "").localeCompare(b.name || "", "he")));

      setCharacterizeForm((prev) => {
        const next = [...prev.baseProducts];
        const firstEmptyIdx = next.findIndex((b) => !b.product);
        if (firstEmptyIdx !== -1) {
          next[firstEmptyIdx] = { ...next[firstEmptyIdx], product: newProduct._id };
        } else {
          next.push({ product: newProduct._id, quantity: 1 });
        }
        return { ...prev, baseProducts: next };
      });

      setNewMaterialDialogOpen(false);
      setNewMaterialName("");
      setNewMaterialUnit("יח׳");
      setNewMaterialSupplier("");
      setNewMaterialDescription("");
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || "שגיאה ביצירת חומר גלם חדש");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress sx={{ color: "#D2691E" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", mx: "auto", boxSizing: "border-box" }}>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color: "#3E2723", mb: 3 }}>
        דשבורד נגר
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ריבועי סטטוס להזמנות (לחיץ) */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {stats.map((s, i) => (
          <Grid key={s.key} size={{ xs: 6, md: 3 }}>
            <StatCard
              title={s.title}
              value={s.value}
              sub={s.sub}
              color={STAT_COLORS[i]}
              icon={STAT_ICONS[i]}
              active={ordersTab === s.key}
              onClick={() => setOrdersTab(s.key)}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.2} sx={{ mb: 2.2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ ...cardSx, height: 250 }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <Typography sx={sectionTitleSx}>התראות וצ'אט</Typography>
              {totalUnreadChatCount > 0 && (
                <Box
                  onClick={() => navigate("/chat")}
                  sx={{
                    mb: 2,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "#D2691E",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(210, 105, 30, 0.3)",
                  }}
                >
                  <ChatIcon />
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>הודעות צ'אט חדשות!</Typography>
                    <Typography sx={{ fontSize: 12, opacity: 0.9 }}>
                      יש לך {totalUnreadChatCount} הודעות שמחכות לך
                    </Typography>
                  </Box>
                </Box>
              )}
              <Box sx={{ flex: 1, overflowY: "auto" }}>
              {unreadNotif === 0 && totalUnreadChatCount === 0 ? (
                <Alert severity="info">אין התראות חדשות</Alert>
              ) : (
                (notifications || [])
                  .filter((n) => !n.isRead && n.type !== "CHAT")
                  .map((n) => (
                    <Box
                      key={n._id || n.id}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        py: 1.2,
                        borderBottom: "1px solid #EFE0D4",
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: 12.5 }}>{n.message || n.text}</Typography>
                        <Typography sx={{ fontSize: 10, color: "#A1887F" }}>
                          {new Date(n.createdAt).toLocaleString("he-IL")}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        sx={{ color: "#D2691E" }}
                        onClick={() => dispatch(markNotificationRead(n._id || n.id))}
                      >
                        ✓
                      </IconButton>
                    </Box>
                  ))
              )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ ...cardSx, height: 250 }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <Typography sx={sectionTitleSx}>
                מוצרי קטלוג הממתינים לאפיון ({catalogProducts.length})
              </Typography>
              <Box sx={{ flex: 1, overflowY: "auto" }}>
              {catalogProducts.length === 0 ? (
                <Alert severity="info">אין כרגע מוצרים שממתינים לאפיון (0)</Alert>
              ) : (
                catalogProducts.map((p) => (
                  <Box key={p._id} sx={{ p: 1.2, mb: 1.2, border: "1px solid #EFE0D4", borderRadius: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{p.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#7B6A5F", mb: 1 }}>{p.description || "ללא תיאור"}</Typography>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={submitLoading}
                      onClick={() => openCharacterizeDialog(p)}
                      sx={{ bgcolor: "#6D4C41", "&:hover": { bgcolor: "#4E342E" } }}
                    >
                      אפיין מוצר
                    </Button>
                  </Box>
                ))
              )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.2} sx={{ justifyContent: "center" }}>
        {!ordersTab && (
          <Grid size={{ xs: 12 }}>
            <Alert severity="info">בחרי ריבוע סטטוס למעלה כדי לצפות ברשימת ההזמנות.</Alert>
          </Grid>
        )}
        {ordersTab === "WAITING" && (
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography sx={sectionTitleSx}>הזמנות שממתינות לתחילת עבודה</Typography>
              {waitingForWork.length === 0 ? (
                <Alert severity="info">אין כרגע הזמנות שממתינות להתחלה</Alert>
              ) : (
                waitingForWork.map((o) => (
                  <Box key={o.orderId} sx={{ p: 1.2, mb: 1.2, border: "1px solid #EFE0D4", borderRadius: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{o.customerName}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#7B6A5F", mb: 1 }}>
                      הזמנה #{o.orderId}
                    </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={submitLoading}
                      sx={{ bgcolor: "#A0522D", "&:hover": { bgcolor: "#7B3F1A" } }}
                      onClick={() => handleMarkReceived(o.orderId)}
                    >
                      אישור קבלת סחורה (מעבר ל"בעבודה")
                    </Button>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>
        )}

        {ordersTab === "ACTIVE" && (
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography sx={sectionTitleSx}>עבודות פעילות (בעבודה)</Typography>
              {activeWork.length === 0 ? (
                <Alert severity="info">אין כרגע עבודות פעילות</Alert>
              ) : (
                activeWork.map((o) => (
                  <Box key={o.orderId} sx={{ p: 1.2, mb: 1.2, border: "1px solid #EFE0D4", borderRadius: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{o.customerName}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#7B6A5F", mb: 1 }}>
                      הזמנה #{o.orderId}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => printCustomerDeliveryLabel(o)}
                      >
                        הדפס כתובת לקוח
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={submitLoading}
                        sx={{ bgcolor: "#2E7D32", "&:hover": { bgcolor: "#1B5E20" } }}
                        onClick={() => handleMarkDone(o.orderId)}
                      >
                        סיום עבודה (ממתין למוביל)
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={submitLoading}
                        color="error"
                        onClick={() => setPauseDialogOrder(o)}
                      >
                        השהיה בשל תקלה
                      </Button>
                    </Box>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>
        )}

        {ordersTab === "DONE" && (
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography sx={sectionTitleSx}>עבודות שסיימתי וממתינות למוביל</Typography>
              {doneWaitingDriver.length === 0 ? (
                <Alert severity="info">אין כרגע עבודות שממתינות למוביל</Alert>
              ) : (
                doneWaitingDriver.map((o) => (
                  <Box key={o.orderId} sx={{ p: 1.2, mb: 1.2, border: "1px solid #EFE0D4", borderRadius: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{o.customerName}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#7B6A5F" }}>
                      הזמנה #{o.orderId}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ mt: 1 }}
                      onClick={() => printCustomerDeliveryLabel(o)}
                    >
                      הדפס כתובת לקוח
                    </Button>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>
        )}

        {ordersTab === "PAUSED" && (
        <Grid size={{ xs: 12 }}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography sx={sectionTitleSx}>עבודות מושהות בשל תקלה</Typography>
              {pausedWork.length === 0 ? (
                <Alert severity="info">אין כרגע עבודות מושהות</Alert>
              ) : (
                pausedWork.map((o) => (
                  <Box key={o.orderId} sx={{ p: 1.2, mb: 1.2, border: "1px solid #F5C6CB", borderRadius: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{o.customerName}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#7B6A5F" }}>הזמנה #{o.orderId}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#B00020", mt: 0.6 }}>
                      סיבת תקלה: {o.carpenterPauseReason || "לא צוינה"}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ mt: 1 }}
                      disabled={submitLoading}
                      onClick={() => handleResumeOrder(o.orderId)}
                    >
                      חידוש עבודה
                    </Button>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>
        )}
      </Grid>

      <Dialog open={!!pauseDialogOrder} onClose={() => setPauseDialogOrder(null)} maxWidth="sm" fullWidth>
        <DialogTitle>השהיית עבודה בשל תקלה</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            label="סיבת התקלה"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPauseDialogOrder(null)}>ביטול</Button>
          <Button variant="contained" color="error" onClick={handlePauseOrder} disabled={submitLoading || !pauseReason.trim()}>
            אשר השהיה
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!characterizeProduct}
        onClose={() => setCharacterizeProduct(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>אפיון מוצר: {characterizeProduct?.name}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            {characterizeProduct?.image && (
              <Box
                sx={{
                  borderRadius: 2,
                  overflow: "hidden",
                  height: { xs: 260, md: 420 },
                  border: "1px solid #E5D5C8",
                  bgcolor: "#fff",
                }}
              >
                <img
                  src={`${BASE_URL}${characterizeProduct.image}`}
                  alt={characterizeProduct.name}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </Box>
            )}
            <TextField
              label="תיאור מוצר (מהמנהל)"
              value={characterizeProduct?.description || ""}
              multiline
              minRows={2}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="זמן עבודה משוער (שבועות)"
              type="number"
              inputProps={{ min: 0, step: 0.5 }}
              value={characterizeForm.estimatedWorkWeeks}
              onChange={(e) => setCharacterizeForm((prev) => ({ ...prev, estimatedWorkWeeks: e.target.value }))}
            />

            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>חומרי גלם נדרשים</Typography>
                <Button size="small" variant="outlined" onClick={() => setNewMaterialDialogOpen(true)}>
                  הוסף חומר גלם חדש
                </Button>
              </Box>
              {characterizeForm.baseProducts.map((item, index) => (
                <Box key={`bp-${index}`} sx={{ display: "flex", gap: 1, mb: 1 }}>
                  <Autocomplete
                    fullWidth
                    options={materials}
                    value={materials.find((m) => String(m._id) === String(item.product)) || null}
                    onChange={(_, selected) => updateBaseProduct(index, "product", selected?._id || "")}
                    isOptionEqualToValue={(option, value) => String(option._id) === String(value._id)}
                    getOptionLabel={(option) =>
                      option?.code
                        ? `${option.code} - ${option.name}${option.unit ? ` (${option.unit})` : ""}`
                        : `${option?.name || ""}${option?.unit ? ` (${option.unit})` : ""}`
                    }
                    filterOptions={(options, state) => {
                      const q = (state.inputValue || "").trim().toLowerCase();
                      if (!q) return options.slice(0, 100);
                      return options.filter((m) =>
                        [m.name, m.code, m.description]
                          .filter(Boolean)
                          .some((v) => String(v).toLowerCase().includes(q))
                      );
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="חומר גלם (חיפוש מהיר)" />
                    )}
                  />
                  <TextField
                    label="כמות"
                    type="number"
                    sx={{ width: 120 }}
                    value={item.quantity}
                    onChange={(e) => updateBaseProduct(index, "quantity", e.target.value)}
                  />
                  <IconButton
                    color="error"
                    onClick={() => removeBaseProduct(index)}
                    disabled={characterizeForm.baseProducts.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
              <Button startIcon={<AddIcon />} onClick={addBaseProduct} size="small">
                הוסף חומר גלם
              </Button>
            </Box>


          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCharacterizeProduct(null)}>ביטול</Button>
          <Button variant="contained" disabled={submitLoading} onClick={handleSubmitCharacterization}>
            שמירה ושליחה לאישור מנהל
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={newMaterialDialogOpen} onClose={() => setNewMaterialDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>הוספת חומר גלם חדש (לאספקה ראשונית)</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
            <TextField
              label="שם חומר גלם"
              fullWidth
              value={newMaterialName}
              onChange={(e) => setNewMaterialName(e.target.value)}
            />
            <TextField
              label="יחידת מידה"
              fullWidth
              value={newMaterialUnit}
              onChange={(e) => setNewMaterialUnit(e.target.value)}
              placeholder='למשל: יח׳ / מטר / ק"ג'
            />
            <TextField
              label="ספק (אופציונלי)"
              fullWidth
              value={newMaterialSupplier}
              onChange={(e) => setNewMaterialSupplier(e.target.value)}
            />
            <TextField
              label="תיאור (אופציונלי)"
              fullWidth
              multiline
              minRows={2}
              value={newMaterialDescription}
              onChange={(e) => setNewMaterialDescription(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewMaterialDialogOpen(false)}>ביטול</Button>
          <Button variant="contained" onClick={handleCreateNewMaterial} disabled={submitLoading}>
            שמור חומר חדש
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CarpenterDashboard;
