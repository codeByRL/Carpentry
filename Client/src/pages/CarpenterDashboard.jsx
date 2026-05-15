import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ChatIcon from "@mui/icons-material/Chat";
import API from "../services/api";
import { useFeedbackSnackbar } from "../hooks/useFeedbackSnackbar";
import { fetchNotifications, markNotificationRead } from "../store/slices/notificationsSlice";
import { fetchActiveChatPartners } from "../store/slices/chatSlice";
import { useOrderLiveRefresh } from "../hooks/useOrderLiveRefresh";
import PageHeader from "../components/PageHeader.jsx";
import { dashboardStatColor } from "../utils/dashboardStatPalette.js";

const C = {
  primary: "#D2691E",
  dark: "#3E2723",
  medium: "#A0522D",
  light: "#FBF0E9",
  border: "#E5D5C8",
};

const STAT_ICONS = [
  <HourglassEmptyIcon sx={{ fontSize: 26 }} />,
  <Inventory2Icon sx={{ fontSize: 26 }} />,
  <AssignmentIcon sx={{ fontSize: 26 }} />,
  <PauseCircleOutlineIcon sx={{ fontSize: 26 }} />,
  <LocalShippingIcon sx={{ fontSize: 26 }} />,
];

const sectionTitleSx = { fontWeight: 700, fontSize: 16, color: "#4E342E", mb: 1.5 };
const BASE_URL = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5001";
import { hoursToWeeks, weeksToHours, HOURS_PER_WORK_DAY, WORK_DAYS_PER_WEEK } from "../utils/workCalendar";

/** כתובת מלאה לתמונת קטלוג (יחסית או מלאה) */
const catalogProductImageSrc = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = BASE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
};

/** המרה בטוחה של כמות מטקסט למספר (כולל תמיכה בפסיק עשרוני) */
const parseQuantity = (value) => {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return value;
  const normalized = String(value).trim().replace(",", ".");
  return Number(normalized);
};

/** תצוגת פריטי הזמנה + איך המוצר אמור להיראות (תמונה מהקטלוג) */
const CarpenterOrderItemsPreview = ({ order }) => {
  const items = order?.items || [];
  if (!items.length) return null;
  return (
    <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#6D4C41" }}>מוצרים בהזמנה</Typography>
      {items.map((item, idx) => {
        const img = item.productImage ? catalogProductImageSrc(item.productImage) : "";
        return (
          <Box
            key={idx}
            sx={{
              display: "flex",
              gap: 1.25,
              alignItems: "flex-start",
              p: 1,
              bgcolor: "#FFFBF8",
              borderRadius: 2,
              border: "1px solid #EFE0D4",
            }}
          >
            {img ? (
              <Box
                component="img"
                src={img}
                alt=""
                sx={{
                  width: 72,
                  height: 72,
                  objectFit: "cover",
                  borderRadius: 1.5,
                  border: "1px solid #E5D5C8",
                  flexShrink: 0,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: 1.5,
                  bgcolor: "#EEE",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "#9E9E9E",
                  textAlign: "center",
                  px: 0.5,
                  border: "1px dashed #E0E0E0",
                }}
              >
                אין תמונה בקטלוג
              </Box>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#4E342E" }}>
                {item.productName || "מוצר"}
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: "#7B6A5F", mt: 0.3 }}>כמות: {item.quantity}</Typography>
              {item.customization?.wood?.description && (
                <Typography sx={{ fontSize: 11, color: "#5D4037" }}>עץ: {item.customization.wood.description}</Typography>
              )}
              {item.customization?.fabric?.description && (
                <Typography sx={{ fontSize: 11, color: "#5D4037" }}>בד: {item.customization.fabric.description}</Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

/** לשוניות תוכן תחת הכרטיס הגדול (כמו דשבורד מחסן) */
const DASHBOARD_TAB_KEYS = ["WAITING", "ON_THE_WAY", "ACTIVE", "PAUSED", "DONE", "CATALOG", "ALERTS"];
/** סטטוסים שמופיעים תחת «הזמנות משויכות» — לפני שההזמנה יוצאת לדרך אליך. */
const PRE_WORK_STATUSES = [
  "ORDERED",
  "WAITING_FOR_WAREHOUSE",
  "WAITING_FOR_PICKING",
  "WAITING_FOR_SUPPLY",
];
const PRE_WORK_STATUS_LABELS = {
  ORDERED: "הוזמן — לפני טיפול מחסן",
  WAITING_FOR_WAREHOUSE: "ממתין למחסנאי",
  WAITING_FOR_PICKING: "ממתין לליקוט",
  WAITING_FOR_SUPPLY: "ממתין להשלמת מלאי",
  READY_FOR_SHIPPING: "מוכן לאיסוף ע״י מוביל",
};

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
  const { showSuccess, showError, FeedbackSnackbar } = useFeedbackSnackbar();
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
  /** כתובת/טלפון מהמסד (לא תמיד ב־localStorage אחרי login ישן) */
  const [carpenterProfile, setCarpenterProfile] = useState(null);
  const { notifications } = useSelector((s) => s.notifications);
  const chatState = useSelector((s) => s.chat);
  // המשתמש המחובר (הנגר) — נחוץ להדפסת תווית ההובלה ללקוח בסיום העבודה.
  const user = useSelector((s) => s.auth?.user);
  /** ברירת מחדל: בעבודה — הזמנות פעילות אצל הנגר */
  const [ordersTab, setOrdersTab] = useState("ACTIVE"); // WAITING | ON_THE_WAY | ACTIVE | PAUSED | DONE | CATALOG | ALERTS
  const [characterizeForm, setCharacterizeForm] = useState({
    estimatedWorkWeeks: "",
    baseProducts: [{ product: "", quantity: 1 }],
    needsFabricSelection: false,
    fabricQuantityPerUnit: "",
    needsFormicaSelection: false,
    formicaQuantityPerUnit: "",
    needsHandleSelection: false,
    handleQuantityPerUnit: "",
  });

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const [ordersRes, profileRes, catalogRes, materialsRes] = await Promise.all([
        API.get("/carpenter/my-orders"),
        API.get("/carpenter/profile"),
        API.get("/carpenter/products-for-characterization"),
        API.get("/base-products?limit=5000"),
      ]);
      setCarpenterProfile(profileRes.data || null);
      setOrders(ordersRes.data || []);
      setCatalogProducts(catalogRes.data || []);
      setMaterials(materialsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "שגיאה בטעינת נתוני נגר");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useOrderLiveRefresh(() => loadData(true));

  useEffect(() => {
    dispatch(fetchActiveChatPartners());
    dispatch(fetchNotifications());
  }, [dispatch]);

  const totalUnreadChatCount =
    chatState?.activeChatPartners?.reduce((acc, p) => acc + (Number(p.unreadCount) || 0), 0) || 0;
  const unreadNotif = (notifications || []).filter((n) => !n.isRead && n.type !== "CHAT").length;

  /** מוביל בדרך לנגר / סיים מסירה וממתין לאישור קבלה — כולל סנכרון ממסלול מוביל פעיל */
  const enRouteToCarpenter = (o) =>
    !!(o.deliveryClaimedBy || o.driverMarkedDeliveredToCarpenterAt || o.inActiveDeliveryRunToCarpenter);

  /** אישור קבלה מותר רק אחרי שהמוביל סימן «הושלם» במסירה לנגר */
  const canConfirmReceiptFromDriver = (o) => !!o.driverMarkedDeliveredToCarpenterAt;

  /**
   * «הזמנות משויכות אליך» — כל ההזמנות שכבר שויכו אליך אבל עדיין לא יצאו
   * לדרך אליך (כולל ORDERED, ממתינות מחסן/ליקוט/אספקה, וגם READY_FOR_SHIPPING
   * שעוד לא נתפסה ע״י מוביל). תווית הסטטוס בכרטיס מציינת את השלב המדויק.
   */
  const waitingForWork = useMemo(
    () =>
      orders.filter((o) => {
        if (o.receivedByCarpenter || o.carpenterCompletedAt) return false;
        if (PRE_WORK_STATUSES.includes(o.status)) return true;
        if (o.status === "READY_FOR_SHIPPING" && !enRouteToCarpenter(o)) return true;
        return false;
      }),
    [orders]
  );
  const onTheWay = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "READY_FOR_SHIPPING" &&
          !o.receivedByCarpenter &&
          !o.carpenterCompletedAt &&
          enRouteToCarpenter(o)
      ),
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
    {
      key: "WAITING",
      title: "הזמנות משויכות אליך",
      value: waitingForWork.length,
      sub: "כל ההזמנות שלך לפני יציאת המוביל אליך",
    },
    {
      key: "ON_THE_WAY",
      title: "בדרך",
      value: onTheWay.length,
      sub: "עדיין לא אישרת את קבלת המשלוח",
    },
    {
      key: "ACTIVE",
      title: "בעבודה",
      value: activeWork.length,
      sub: "עבודות פעילות אצלך",
    },
    { key: "PAUSED", title: "מושהות", value: pausedWork.length, sub: "תקלה/המתנה" },
    {
      key: "DONE",
      title: "ממתינות למוביל",
      value: doneWaitingDriver.length,
      sub: "העבודה הושלמה - ממתינות להובלה ללקוח",
    },
  ];

  const failValidation = (message) => {
    setError(message);
    showError(message);
  };

  const runAction = async (requestFn, successMessage) => {
    try {
      setSubmitLoading(true);
      await requestFn();
      await loadData();
      if (successMessage) showSuccess(successMessage);
    } catch (err) {
      const msg = err.response?.data?.message || "שגיאה בביצוע הפעולה";
      setError(msg);
      showError(msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleMarkReceived = (orderId) =>
    runAction(() => API.patch(`/carpenter/orders/${orderId}/received`), "החומרים התקבלו — העבודה החלה");

  const handleMarkDone = async (order) => {
    await runAction(async () => {
      await API.patch(`/carpenter/orders/${order.orderId}/done`);
      try {
        printCustomerDeliveryLabel(order);
      } catch (printErr) {
        console.error("Failed to print customer delivery label:", printErr);
      }
    }, "העבודה הושלמה — ההזמנה הועברה לממתינות למוביל");
  };

  const handlePauseOrder = async () => {
    if (!pauseDialogOrder || !pauseReason.trim()) {
      showError('יש להזין סיבת השהיה לפני שמירה');
      return;
    }
    await runAction(
      () =>
        API.patch(`/carpenter/orders/${pauseDialogOrder.orderId}/pause`, {
          reason: pauseReason.trim(),
        }),
      "העבודה הושהתה"
    );
    setPauseDialogOrder(null);
    setPauseReason("");
  };

  const handleResumeOrder = (orderId) =>
    runAction(() => API.patch(`/carpenter/orders/${orderId}/resume`), "העבודה חודשה");

  const resolveCarpenterAddress = (order) => {
    const addr =
      order?.carpenterAddress?.trim() ||
      carpenterProfile?.address?.trim() ||
      user?.address?.trim() ||
      "";
    return addr || "לא הוגדרה כתובת לנגר — עדכני בניהול עובדים";
  };

  const printCustomerDeliveryLabel = (order) => {
    const customerName = order?.customerName || "—";
    const customerAddress = order?.deliveryAddress || "—";
    const carpenterName =
      carpenterProfile?.fullName || user?.fullName || "נגר";
    const carpenterAddress = resolveCarpenterAddress(order);
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
            <div class="line"><b>מוצא:</b> נגר — ${carpenterName}</div>
            <div class="line"><b>כתובת מוצא:</b> ${carpenterAddress}</div>
            <div class="line"><b>יעד:</b> לקוח — ${customerName}</div>
            <div class="line"><b>לקוח:</b> ${customerName}</div>
            <div class="line"><b>כתובת יעד:</b> ${customerAddress}</div>
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
        ? hoursToWeeks(product.estimatedWorkTime)
        : "",
      baseProducts: product.baseProducts?.length
        ? product.baseProducts.map((b) => ({
            product: b.product?._id || b.product || "",
            quantity: b.quantity || 1,
          }))
        : [{ product: "", quantity: 1 }],
      needsFabricSelection: product.needsFabricSelection === true,
      fabricQuantityPerUnit:
        product.needsFabricSelection && Number(product.fabricQuantityPerUnit) > 0
          ? String(product.fabricQuantityPerUnit)
          : "",
      needsFormicaSelection: product.needsFormicaSelection === true,
      formicaQuantityPerUnit:
        product.needsFormicaSelection && Number(product.formicaQuantityPerUnit) > 0
          ? String(product.formicaQuantityPerUnit)
          : "",
      needsHandleSelection: product.needsHandleSelection === true,
      handleQuantityPerUnit:
        product.needsHandleSelection && Number(product.handleQuantityPerUnit) > 0
          ? String(product.handleQuantityPerUnit)
          : "",
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

    const cleanedBaseProducts = [];
    for (let i = 0; i < characterizeForm.baseProducts.length; i += 1) {
      const row = characterizeForm.baseProducts[i];
      const rowNumber = i + 1;

      if (!row?.product) {
        failValidation(`בשורת חומר גלם ${rowNumber} לא נבחר מוצר מהרשימה`);
        return;
      }

      const qty = parseQuantity(row.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        failValidation(`בשורת חומר גלם ${rowNumber} הכמות חייבת להיות מספר גדול מ-0`);
        return;
      }

      cleanedBaseProducts.push({ product: row.product, quantity: qty });
    }

    if (!cleanedBaseProducts.length || !Number(characterizeForm.estimatedWorkWeeks)) {
      failValidation("יש למלא זמן עבודה בשבועות ולהוסיף לפחות חומר גלם אחד");
      return;
    }
    const workWeeks = Number(characterizeForm.estimatedWorkWeeks);
    if (!Number.isFinite(workWeeks) || workWeeks <= 0) {
      failValidation("זמן עבודה בשבועות חייב להיות מספר גדול מ־0");
      return;
    }

    const needsFabric = characterizeForm.needsFabricSelection === true;
    let fabricQty = 0;
    if (needsFabric) {
      fabricQty = Number(characterizeForm.fabricQuantityPerUnit);
      if (!Number.isFinite(fabricQty) || fabricQty <= 0) {
        failValidation("כשהמוצר דורש בחירת בד יש להזין כמות בד נדרשת ליחידה (במטרים, גדולה מ־0)");
        return;
      }
    }

    const needsFormica = characterizeForm.needsFormicaSelection === true;
    let formicaQty = 0;
    if (needsFormica) {
      formicaQty = Number(characterizeForm.formicaQuantityPerUnit);
      if (!Number.isFinite(formicaQty) || formicaQty <= 0) {
        failValidation("כשהמוצר דורש בחירת פורמייקה יש להזין כמות פורמייקה נדרשת ליחידה (גדולה מ־0)");
        return;
      }
    }

    const needsHandle = characterizeForm.needsHandleSelection === true;
    let handleQty = 0;
    if (needsHandle) {
      handleQty = Number(characterizeForm.handleQuantityPerUnit);
      if (!Number.isFinite(handleQty) || handleQty <= 0) {
        failValidation("כשהמוצר דורש בחירת ידית יש להזין כמות ידיות נדרשת ליחידה (גדולה מ־0)");
        return;
      }
    }

    await runAction(
      () =>
        API.post(`/carpenter/characterize/${characterizeProduct._id}`, {
          baseProducts: cleanedBaseProducts,
          estimatedWorkTime: weeksToHours(characterizeForm.estimatedWorkWeeks),
          needsFabricSelection: needsFabric,
          fabricQuantityPerUnit: needsFabric ? fabricQty : 0,
          needsFormicaSelection: needsFormica,
          formicaQuantityPerUnit: needsFormica ? formicaQty : 0,
          needsHandleSelection: needsHandle,
          handleQuantityPerUnit: needsHandle ? handleQty : 0,
        }),
      "אפיונך נשלח למנהל לאישור סופי"
    );

    setCharacterizeProduct(null);
  };

  const handleCreateNewMaterial = async () => {
    if (!newMaterialName.trim() || !newMaterialUnit.trim()) {
      failValidation("יש למלא שם חומר ויחידת מידה");
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
      showSuccess("חומר גלם חדש נוסף בהצלחה");
    } catch (err) {
      const msg = err.response?.data?.message || "שגיאה ביצירת חומר גלם חדש";
      setError(msg);
      showError(msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", mx: "auto", boxSizing: "border-box", minWidth: 0 }}>
      <PageHeader
        title="לוח מחוונים"
        description={`שלום, ${user?.fullName || user?.username || 'נגר'} — הזמנות לפי שלב, אפיון מוצרים, חומרים והובלות — כל מה שצריך ליום עבודה.\n${new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ריבועי סטטוס להזמנות (לחיץ) */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {stats.map((s, i) => (
          <Grid key={s.key} size={{ xs: 6, sm: 4, md: 2 }}>
            <StatCard
              title={s.title}
              value={s.value}
              sub={s.sub}
              color={dashboardStatColor(i)}
              icon={STAT_ICONS[i]}
              active={ordersTab === s.key}
              onClick={() => setOrdersTab(s.key)}
            />
          </Grid>
        ))}
      </Grid>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: `1px solid ${C.border}`,
          overflow: "hidden",
          mb: 2,
        }}
      >
        <Tabs
          value={
            ordersTab && DASHBOARD_TAB_KEYS.includes(ordersTab) ? ordersTab : false
          }
          onChange={(_, v) => setOrdersTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            borderBottom: `1px solid ${C.border}`,
            bgcolor: "#FFFBF8",
            "& .MuiTab-root": { fontSize: 12.5, fontWeight: 600, minHeight: 48 },
            "& .Mui-selected": { color: C.primary },
            "& .MuiTabs-indicator": { bgcolor: C.primary },
          }}
        >
          <Tab label={`הזמנות משויכות (${waitingForWork.length})`} value="WAITING" />
          <Tab label={`בדרך (${onTheWay.length})`} value="ON_THE_WAY" />
          <Tab label={`בעבודה (${activeWork.length})`} value="ACTIVE" />
          <Tab label={`מושהות (${pausedWork.length})`} value="PAUSED" />
          <Tab label={`ממתינות למוביל (${doneWaitingDriver.length})`} value="DONE" />
          <Tab label={`מוצרים לאפיון (${catalogProducts.length})`} value="CATALOG" />
          <Tab
            label={
              unreadNotif + totalUnreadChatCount > 0
                ? `התראות וצ'אט (${unreadNotif + totalUnreadChatCount})`
                : "התראות וצ'אט"
            }
            value="ALERTS"
          />
        </Tabs>

        <Box sx={{ p: 2.5, minHeight: 280 }}>
          {ordersTab === "WAITING" && (
            <Box>
              <Typography sx={sectionTitleSx}>הזמנות משויכות אליך</Typography>
              <Typography sx={{ fontSize: 12, color: "#7B6A5F", mb: 1.5, lineHeight: 1.45 }}>
                כל ההזמנות ששויכו אליך לפני יציאת המוביל — כולל הזמנות שעדיין במחסן.
                תווית הסטטוס בכל כרטיס מציינת את השלב המדויק.
              </Typography>
              {waitingForWork.length === 0 ? (
                <Alert severity="info">אין כרגע הזמנות בקטגוריה זו.</Alert>
              ) : (
                waitingForWork.map((o) => {
                  const statusLabel = PRE_WORK_STATUS_LABELS[o.status] || o.status;
                  const isReadyForShipping = o.status === "READY_FOR_SHIPPING";
                  const isMissingStock = o.status === "WAITING_FOR_SUPPLY";
                  return (
                    <Box
                      key={o.orderId}
                      sx={{
                        p: 1.2,
                        mb: 1.2,
                        border: "1px solid #EFE0D4",
                        borderRadius: 2,
                        bgcolor: isReadyForShipping ? "#FFFFFF" : "#FFFBF8",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 0.6 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{o.customerName}</Typography>
                        <Chip
                          size="small"
                          label={statusLabel}
                          sx={{
                            bgcolor: isMissingStock
                              ? "#FDE8E8"
                              : isReadyForShipping
                              ? "#E8F5E9"
                              : "#F5EDE8",
                            color: isMissingStock
                              ? "#8B0000"
                              : isReadyForShipping
                              ? "#1B5E20"
                              : "#5D4037",
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: 12, color: "#7B6A5F", mb: 1 }}>
                        הזמנה #{o.orderId}
                      </Typography>
                      <CarpenterOrderItemsPreview order={o} />
                      {o.estimatedDeliveryDate && (
                        <Typography sx={{ fontSize: 11.5, color: "#5D4037", mt: 0.8 }}>
                          אספקה משוערת ללקוח:{" "}
                          {new Date(o.estimatedDeliveryDate).toLocaleDateString("he-IL")}
                        </Typography>
                      )}
                      {isMissingStock && (
                        <Typography sx={{ fontSize: 11.5, color: "#8B0000", mt: 0.4 }}>
                          חסר חומר גלם במחסן — ההזמנה תזוז לליקוט ברגע שהמלאי יתחדש.
                        </Typography>
                      )}
                      {isReadyForShipping ? (
                        <>
                          {!canConfirmReceiptFromDriver(o) && (
                            <Typography sx={{ fontSize: 12, color: "#B45309", mt: 1, lineHeight: 1.45 }}>
                              עוד לא הגיע אליך בפועל — לא ניתן לאשר קבלה לפני שהמוביל מסמן במערכת שהמסירה הושלמה (ההזמנה
                              תופיע בלשונית «בדרך» עם סימון המוביל).
                            </Typography>
                          )}
                          <Button
                            size="small"
                            variant="contained"
                            disabled={submitLoading || !canConfirmReceiptFromDriver(o)}
                            sx={{ mt: 1.5, bgcolor: "#A0522D", "&:hover": { bgcolor: "#7B3F1A" } }}
                            onClick={() => handleMarkReceived(o.orderId)}
                          >
                            סמן כהגיע והתחל עבודה
                          </Button>
                        </>
                      ) : (
                        <Typography sx={{ fontSize: 11.5, color: "#7B6A5F", mt: 0.8, fontStyle: "italic" }}>
                          המידע כאן לתכנון מראש — אין פעולה לבצע עד שהמחסן והמוביל יסיימו את שלהם.
                        </Typography>
                      )}
                    </Box>
                  );
                })
              )}
            </Box>
          )}

          {ordersTab === "ON_THE_WAY" && (
            <Box>
              <Typography sx={sectionTitleSx}>בדרך</Typography>
              <Typography sx={{ fontSize: 12, color: "#7B6A5F", mb: 1.5, lineHeight: 1.45 }}>
                עדיין לא אישרת את קבלת המשלוח
              </Typography>
              {onTheWay.length === 0 ? (
                <Alert severity="info">אין כרגע הובלות בדרך.</Alert>
              ) : (
                onTheWay.map((o) => (
                  <Box key={o.orderId} sx={{ p: 1.2, mb: 1.2, border: "1px solid #EFE0D4", borderRadius: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{o.customerName}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#7B6A5F", mb: 0.5 }}>
                      הזמנה #{o.orderId}
                    </Typography>
                    <CarpenterOrderItemsPreview order={o} />
                    <Typography sx={{ fontSize: 12, color: "#5D4037", mb: 1 }}>
                      {o.driverMarkedDeliveredToCarpenterAt
                        ? "המוביל סימן סיום מסירה — יש לאשר שהחומרים הגיעו."
                        : "מוביל תפס את ההובלה — בדרך אליך."}
                    </Typography>
                    {!canConfirmReceiptFromDriver(o) && (
                      <Typography sx={{ fontSize: 12, color: "#B45309", mb: 1, lineHeight: 1.45 }}>
                        עוד לא הגיע אליך בפועל — יש להמתין שסימון המוביל על סיום המסירה לפני אישור קבלה.
                      </Typography>
                    )}
                    <Button
                      size="small"
                      variant="contained"
                      disabled={submitLoading || !canConfirmReceiptFromDriver(o)}
                      sx={{ mt: 0.5, bgcolor: "#795548", "&:hover": { bgcolor: "#5D4037" } }}
                      onClick={() => handleMarkReceived(o.orderId)}
                    >
                      סמן כהגיע והתחל עבודה
                    </Button>
                  </Box>
                ))
              )}
            </Box>
          )}

          {ordersTab === "ACTIVE" && (
            <Box>
              <Typography sx={sectionTitleSx}>עבודות פעילות (בעבודה)</Typography>
              {activeWork.length === 0 ? (
                <Alert severity="info">אין כרגע עבודות פעילות. אחרי אישור קבלת חומרים — ההזמנה תופיע כאן.</Alert>
              ) : (
                activeWork.map((o) => (
                  <Box key={o.orderId} sx={{ p: 1.2, mb: 1.2, border: "1px solid #EFE0D4", borderRadius: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{o.customerName}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#7B6A5F", mb: 1 }}>
                      הזמנה #{o.orderId}
                    </Typography>
                    <CarpenterOrderItemsPreview order={o} />
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5 }}>
                      <Button size="small" variant="outlined" onClick={() => printCustomerDeliveryLabel(o)}>
                        הדפס כתובת לקוח
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={submitLoading}
                        sx={{ bgcolor: "#2E7D32", "&:hover": { bgcolor: "#1B5E20" } }}
                        onClick={() => handleMarkDone(o)}
                      >
                        סיום עבודה (ממתין למוביל)
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={submitLoading}
                        onClick={() => setPauseDialogOrder(o)}
                        sx={{
                          borderColor: "#D2691E",
                          color: "#D2691E",
                          "&:hover": { borderColor: "#A0522D", bgcolor: "rgba(210, 105, 30, 0.06)" },
                        }}
                      >
                        השהיה בשל תקלה
                      </Button>
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          )}

          {ordersTab === "DONE" && (
            <Box>
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
                    <CarpenterOrderItemsPreview order={o} />
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
            </Box>
          )}

          {ordersTab === "PAUSED" && (
            <Box>
              <Typography sx={sectionTitleSx}>עבודות מושהות בשל תקלה</Typography>
              {pausedWork.length === 0 ? (
                <Alert severity="info">אין כרגע עבודות מושהות</Alert>
              ) : (
                pausedWork.map((o) => (
                  <Box
                    key={o.orderId}
                    sx={{
                      p: 1.2,
                      mb: 1.2,
                      border: "1px solid #E8C9B0",
                      borderRadius: 2,
                      bgcolor: "#FFF8F0",
                      boxShadow: "inset 3px 0 0 #D2691E",
                    }}
                  >
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{o.customerName}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#7B6A5F" }}>הזמנה #{o.orderId}</Typography>
                    <CarpenterOrderItemsPreview order={o} />
                    <Typography sx={{ fontSize: 12.5, color: "#D2691E", fontWeight: 700, mt: 0.6 }}>
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
            </Box>
          )}

          {ordersTab === "CATALOG" && (
            <Box>
              <Typography sx={sectionTitleSx}>מוצרים לאפיון ({catalogProducts.length})</Typography>
              {catalogProducts.length === 0 ? (
                <Alert severity="info">אין כרגע מוצרים לאפיון</Alert>
              ) : (
                catalogProducts.map((p) => {
                  const imgSrc = catalogProductImageSrc(p.image);
                  return (
                    <Box
                      key={p._id}
                      sx={{
                        p: 1.2,
                        mb: 1.2,
                        border: "1px solid #EFE0D4",
                        borderRadius: 2,
                        display: "flex",
                        gap: 1.5,
                        alignItems: "stretch",
                      }}
                    >
                      <Box
                        sx={{
                          flex: "0 0 auto",
                          width: { xs: 96, sm: 140 },
                          height: { xs: 96, sm: 140 },
                          borderRadius: 2,
                          overflow: "hidden",
                          border: "1px solid #E5D5C8",
                          bgcolor: "#FFFBF8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={p.name}
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          <Typography sx={{ fontSize: 11, color: "#A1887F" }}>אין תמונה</Typography>
                        )}
                      </Box>
                      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <Box>
                          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{p.name}</Typography>
                          {p.category && (
                            <Typography sx={{ fontSize: 11, color: "#A0522D", fontWeight: 600, mb: 0.4 }}>
                              קטגוריה: {p.category}
                            </Typography>
                          )}
                          <Typography sx={{ fontSize: 12, color: "#7B6A5F", mb: 1 }}>
                            {p.description || "ללא תיאור"}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={submitLoading}
                          onClick={() => openCharacterizeDialog(p)}
                          sx={{
                            bgcolor: "#6D4C41",
                            color: "#fff",
                            alignSelf: "flex-start",
                            "&:hover": { bgcolor: "#4E342E", color: "#fff" },
                          }}
                        >
                          אפיין מוצר
                        </Button>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>
          )}

          {ordersTab === "ALERTS" && (
            <Box>
              <Typography sx={sectionTitleSx}>התראות וצ&apos;אט</Typography>
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
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>הודעות צ&apos;אט חדשות!</Typography>
                    <Typography sx={{ fontSize: 12, opacity: 0.9 }}>
                      יש לך {totalUnreadChatCount} הודעות שמחכות לך
                    </Typography>
                  </Box>
                </Box>
              )}
              <Box sx={{ maxHeight: 420, overflowY: "auto" }}>
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
            </Box>
          )}
        </Box>
      </Paper>

      <Dialog
        open={!!pauseDialogOrder}
        onClose={() => setPauseDialogOrder(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            border: "1px solid #E8C9B0",
            borderRadius: 2,
            overflow: "hidden",
            boxShadow: "inset 0 4px 0 #D2691E",
          },
        }}
      >
        <DialogTitle sx={{ color: "#D2691E", fontWeight: 800 }}>השהיית עבודה בשל תקלה</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            label="סיבת התקלה"
            sx={{
              mt: 1,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E8C9B0" },
            }}
            InputLabelProps={{ sx: { "&.Mui-focused": { color: "#D2691E" } } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPauseDialogOrder(null)}>ביטול</Button>
          <Button
            variant="contained"
            onClick={handlePauseOrder}
            disabled={submitLoading || !pauseReason.trim()}
            sx={{
              bgcolor: "#D2691E",
              "&:hover": { bgcolor: "#A0522D" },
            }}
          >
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
        <DialogTitle>
          אפיון מוצר: {characterizeProduct?.name}
          {characterizeProduct?.category && (
            <Typography component="span" sx={{ ml: 1, fontSize: 13, color: "#A0522D" }}>
              ({characterizeProduct.category})
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <Box
              sx={{
                borderRadius: 2,
                overflow: "hidden",
                height: { xs: 260, md: 420 },
                border: "1px solid #E5D5C8",
                bgcolor: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {catalogProductImageSrc(characterizeProduct?.image) ? (
                <img
                  src={catalogProductImageSrc(characterizeProduct?.image)}
                  alt={characterizeProduct?.name || "מוצר"}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <Typography sx={{ fontSize: 13, color: "#A1887F" }}>
                  אין תמונה למוצר זה — ניתן לפנות למנהל להוספה
                </Typography>
              )}
            </Box>
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
              helperText={`שבוע = ${WORK_DAYS_PER_WEEK} ימי עבודה × ${HOURS_PER_WORK_DAY} שעות ליום`}
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

            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: `1px solid ${C.border}`,
                bgcolor: "#FFFBF8",
                display: "flex",
                flexDirection: "column",
                gap: 1.2,
              }}
            >
              <Typography sx={{ fontWeight: 700, color: C.dark, fontSize: 14 }}>
                בחירת בד ע״י הלקוח
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={characterizeForm.needsFabricSelection}
                    onChange={(e) =>
                      setCharacterizeForm((prev) => ({
                        ...prev,
                        needsFabricSelection: e.target.checked,
                        fabricQuantityPerUnit: e.target.checked ? prev.fabricQuantityPerUnit : "",
                      }))
                    }
                    sx={{ "& .MuiSwitch-thumb": { bgcolor: C.primary } }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: 13, color: C.dark }}>
                    האם המוצר דורש בחירת בד?{" "}
                    <Box
                      component="span"
                      sx={{
                        fontWeight: 700,
                        color: characterizeForm.needsFabricSelection ? "#2E7D32" : "#8B0000",
                      }}
                    >
                      {characterizeForm.needsFabricSelection ? "כן — דורש בחירת בד" : "לא — לא דורש בחירת בד"}
                    </Box>
                  </Typography>
                }
              />
              {characterizeForm.needsFabricSelection && (
                <TextField
                  label="כמות בד נדרשת ליחידה (במטרים)"
                  type="number"
                  inputProps={{ min: 0, step: 0.1 }}
                  value={characterizeForm.fabricQuantityPerUnit}
                  onChange={(e) =>
                    setCharacterizeForm((prev) => ({
                      ...prev,
                      fabricQuantityPerUnit: e.target.value,
                    }))
                  }
                  helperText="כמה מטרים של בד צורך מוצר אחד"
                />
              )}
            </Box>

            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: `1px solid ${C.border}`,
                bgcolor: "#FFFBF8",
                display: "flex",
                flexDirection: "column",
                gap: 1.2,
              }}
            >
              <Typography sx={{ fontWeight: 700, color: C.dark, fontSize: 14 }}>
                בחירת פורמייקה ע״י הלקוח
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={characterizeForm.needsFormicaSelection}
                    onChange={(e) =>
                      setCharacterizeForm((prev) => ({
                        ...prev,
                        needsFormicaSelection: e.target.checked,
                        formicaQuantityPerUnit: e.target.checked ? prev.formicaQuantityPerUnit : "",
                      }))
                    }
                    sx={{ "& .MuiSwitch-thumb": { bgcolor: C.primary } }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: 13, color: C.dark }}>
                    האם המוצר דורש בחירת פורמייקה?{" "}
                    <Box
                      component="span"
                      sx={{
                        fontWeight: 700,
                        color: characterizeForm.needsFormicaSelection ? "#2E7D32" : "#8B0000",
                      }}
                    >
                      {characterizeForm.needsFormicaSelection ? "כן — דורש בחירת פורמייקה" : "לא — לא דורש בחירת פורמייקה"}
                    </Box>
                  </Typography>
                }
              />
              {characterizeForm.needsFormicaSelection && (
                <TextField
                  label="כמות פורמייקה נדרשת ליחידה (במ״ר)"
                  type="number"
                  inputProps={{ min: 0, step: 0.1 }}
                  value={characterizeForm.formicaQuantityPerUnit}
                  onChange={(e) =>
                    setCharacterizeForm((prev) => ({
                      ...prev,
                      formicaQuantityPerUnit: e.target.value,
                    }))
                  }
                  helperText="כמה מ״ר פורמייקה צורך מוצר אחד"
                />
              )}
            </Box>

            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: `1px solid ${C.border}`,
                bgcolor: "#FFFBF8",
                display: "flex",
                flexDirection: "column",
                gap: 1.2,
              }}
            >
              <Typography sx={{ fontWeight: 700, color: C.dark, fontSize: 14 }}>
                בחירת ידית ע״י הלקוח
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={characterizeForm.needsHandleSelection}
                    onChange={(e) =>
                      setCharacterizeForm((prev) => ({
                        ...prev,
                        needsHandleSelection: e.target.checked,
                        handleQuantityPerUnit: e.target.checked ? prev.handleQuantityPerUnit : "",
                      }))
                    }
                    sx={{ "& .MuiSwitch-thumb": { bgcolor: C.primary } }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: 13, color: C.dark }}>
                    האם המוצר דורש בחירת ידית?{" "}
                    <Box
                      component="span"
                      sx={{
                        fontWeight: 700,
                        color: characterizeForm.needsHandleSelection ? "#2E7D32" : "#8B0000",
                      }}
                    >
                      {characterizeForm.needsHandleSelection ? "כן — דורש בחירת ידית" : "לא — לא דורש בחירת ידית"}
                    </Box>
                  </Typography>
                }
              />
              {characterizeForm.needsHandleSelection && (
                <TextField
                  label="כמות ידיות נדרשת ליחידה"
                  type="number"
                  inputProps={{ min: 0, step: 1 }}
                  value={characterizeForm.handleQuantityPerUnit}
                  onChange={(e) =>
                    setCharacterizeForm((prev) => ({
                      ...prev,
                      handleQuantityPerUnit: e.target.value,
                    }))
                  }
                  helperText="כמה ידיות צורך מוצר אחד"
                />
              )}
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
      <FeedbackSnackbar />
    </Box>
  );
};

export default CarpenterDashboard;
