import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Link,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import RouteIcon from "@mui/icons-material/Route";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import MarkChatUnreadIcon from "@mui/icons-material/MarkChatUnread";
import {
  fetchPendingDeliveries,
  fetchMyTodayRun,
  fetchMyMonthlyDeliveries,
  completeDeliveryStop,
  clearDeliveryError,
  clearDeliveryInfo,
  clearDriverReleaseNotice,
} from "../store/slices/deliverySlice";
import { fetchNotifications } from "../store/slices/notificationsSlice";
import { fetchActiveChatPartners } from "../store/slices/chatSlice";
import { useFeedbackSnackbar } from "../hooks/useFeedbackSnackbar";
import { useOrderLiveRefresh } from "../hooks/useOrderLiveRefresh";
import PageHeader from "../components/PageHeader.jsx";
import { dashboardStatColor } from "../utils/dashboardStatPalette.js";

const typeLabel = {
  TO_CARPENTER: "הובלה לנגר",
  TO_CUSTOMER: "הובלה לבית הלקוח",
};
const pointTypeLabel = {
  WAREHOUSE: "מחסן",
  CARPENTER: "נגר",
  CUSTOMER: "לקוח",
};
const getOrderCode = (stop) => {
  const rawId = stop?.order?._id || stop?.order;
  if (!rawId) return "—";
  const idStr = String(rawId);
  return `#${idStr.slice(-6)}`;
};

const isStopDelivered = (s) => s?.status === "COMPLETED" || !!s?.completedAt;
const getSourceLine = (s) => {
  const type = pointTypeLabel[s?.sourceType] || "מוצא";
  const addr = s?.sourceAddress || "—";
  return `${type}: ${addr}`;
};
const getDestinationLine = (s) => {
  const type = pointTypeLabel[s?.destinationType] || "יעד";
  const addr = s?.destinationAddress || s?.address || "—";
  return `${type}: ${addr}`;
};

const DeliveryStations = ({ stop, showWaze = true }) => {
  const s1 = stop?.station1;
  const s2 = stop?.station2;
  if (s1 && s2) {
    return (
      <Box sx={{ mt: 0.5 }}>
        {[s1, s2].map((st, i) => (
          <Box
            key={`${st.type}-${i}`}
            sx={{
              mb: 1,
              p: 1,
              bgcolor: "#FFF8F3",
              borderRadius: 1.5,
              border: "1px solid #E8D5C8",
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
              תחנה {i + 1} — {st.label}
              {st.name && st.name !== st.label ? `: ${st.name}` : ""}
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#5D4037" }}>{st.address || "—"}</Typography>
            {showWaze && st.wazeUrl && (
              <Link href={st.wazeUrl} target="_blank" underline="none" sx={{ display: "inline-block", mt: 0.5 }}>
                <Button size="small" variant="outlined" startIcon={<LocalShippingIcon />}>
                  Waze לתחנה {i + 1}
                </Button>
              </Link>
            )}
          </Box>
        ))}
      </Box>
    );
  }
  return (
    <>
      <Typography sx={{ fontSize: 13 }}>{getSourceLine(stop)}</Typography>
      <Typography sx={{ fontSize: 13 }}>{getDestinationLine(stop)}</Typography>
    </>
  );
};

const DriverDeliveries = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showSuccess, showError, FeedbackSnackbar } = useFeedbackSnackbar();
  const { user } = useSelector((s) => s.auth);
  const { notifications } = useSelector((s) => s.notifications);
  const chatState = useSelector((s) => s.chat);
  const {
    pendingPool,
    myRun,
    myMonthly,
    loading,
    completeLoading,
    error,
    info,
    driverReleaseNotice,
  } = useSelector((s) => s.delivery);

  /** ברירת מחדל: הובלות במסלול היום (תכנון מסלול בדף נפרד בתפריט) */
  const [tab, setTab] = useState(0);

  const loadData = () => {
    dispatch(fetchPendingDeliveries());
    dispatch(fetchMyTodayRun());
    dispatch(fetchMyMonthlyDeliveries());
    dispatch(fetchNotifications());
    dispatch(fetchActiveChatPartners());
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useOrderLiveRefresh(loadData);

  const handleCompleteStop = async (stopId) => {
    if (!myRun?._id) {
      showError('אין מסלול פעיל לסימון ההובלה');
      return;
    }
    const result = await dispatch(completeDeliveryStop({ runId: myRun._id, stopId }));
    if (!result.error) {
      loadData();
      const run = result.payload?.run;
      const allDone =
        run?.status === "COMPLETED" ||
        (run?.stops?.length > 0 && run.stops.every((s) => s.status === "COMPLETED"));
      if (allDone) {
        showSuccess("סיימת להיום — כל ההובלות במסלול הושלמו");
      } else {
        showSuccess("ההובלה סומנה כהושלמה");
      }
    } else {
      showError(typeof result.payload === 'string' ? result.payload : 'שגיאה בסימון ההובלה כהושלמה');
    }
  };

  const myStops = myRun?.stops || [];
  const myCarpenterStops = useMemo(
    () => myStops.filter((s) => s.deliveryType === "TO_CARPENTER"),
    [myStops]
  );
  const myCustomerStops = useMemo(
    () => myStops.filter((s) => s.deliveryType === "TO_CUSTOMER"),
    [myStops]
  );

  const { activeStops, emptyHint } = useMemo(() => {
    if (tab === 0) {
      return {
        activeStops: myStops,
        emptyHint: 'אין הובלות בתצוגה זו — תכנון המסלול מתבצע מתפריט «תכנון מסלול יומי».',
      };
    }
    if (tab === 1) return { activeStops: myCarpenterStops, emptyHint: "אין הובלות בתצוגה זו" };
    return { activeStops: myCustomerStops, emptyHint: "אין הובלות בתצוגה זו" };
  }, [tab, myStops, myCarpenterStops, myCustomerStops]);

  const unreadNotif = useMemo(
    () => (notifications || []).filter((n) => !n.isRead && n.type !== "CHAT").length,
    [notifications]
  );
  const chatUnread = useMemo(
    () =>
      (chatState?.activeChatPartners || []).reduce((a, p) => a + (Number(p.unreadCount) || 0), 0) || 0,
    [chatState?.activeChatPartners]
  );

  const name = user?.fullName || user?.username || "מוביל";
  const dateStr = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const pendingInRun = myStops.filter((s) => s.status !== "COMPLETED").length;
  const doneInRun = myStops.filter((s) => s.status === "COMPLETED").length;
  const alertTotal = unreadNotif + chatUnread;

  const quickCards = [
    {
      title: "תכנון מסלול יומי",
      value: pendingPool.length,
      sub: "ממתינות בבריכה",
      icon: <LocalShippingIcon sx={{ fontSize: 26 }} />,
      color: dashboardStatColor(0),
      onClick: () => navigate("/driver/claim-today"),
    },
    {
      title: "מסלול היום",
      value: myRun ? pendingInRun : "—",
      sub: myRun ? `${doneInRun} הושלמו מתוך ${myStops.length}` : "לא תפסת מסלול",
      icon: <RouteIcon sx={{ fontSize: 26 }} />,
      color: dashboardStatColor(1),
      onClick: () => setTab(0),
    },
    {
      title: "הובלות החודש",
      value: myMonthly?.count ?? 0,
      sub: "עצירות שהושלמו",
      icon: <CalendarMonthIcon sx={{ fontSize: 26 }} />,
      color: dashboardStatColor(2),
      onClick: () => navigate("/driver/monthly"),
    },
    {
      title: "התראות וצ׳אט",
      value: alertTotal,
      sub: chatUnread > 0 ? `${chatUnread} הודעות צ׳אט` : unreadNotif > 0 ? "התראות מערכת" : "אין חדש",
      icon: <MarkChatUnreadIcon sx={{ fontSize: 26 }} />,
      color: dashboardStatColor(3),
      onClick: () => navigate("/chat"),
    },
  ];

  if (loading && !pendingPool.length && !myRun) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <PageHeader
        title="לוח מחוונים"
        description={`שלום, ${name} — מסלול היום, ספירת בריכה, הובלות החודש והתראות.\n${dateStr}`}
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {quickCards.map((c, i) => (
          <Grid key={c.title} size={{ xs: 6, md: 3 }}>
            <Box
              onClick={c.onClick}
              sx={{
                bgcolor: c.color,
                borderRadius: 3,
                p: 2.5,
                minHeight: 130,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "transform 0.15s ease, opacity 0.15s ease",
                "&:hover": { transform: "translateY(-2px)", opacity: 0.94 },
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>
                  {c.title}
                </Typography>
                <Box sx={{ color: "rgba(255,255,255,0.75)" }}>{c.icon}</Box>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 32, fontWeight: 800, color: "white", lineHeight: 1 }}>
                  {c.value}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.72)", mt: 0.5 }}>{c.sub}</Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => {
            dispatch(clearDeliveryError());
          }}
        >
          {error}
        </Alert>
      )}
      {info && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => dispatch(clearDeliveryInfo())}>
          {info}
        </Alert>
      )}
      {driverReleaseNotice && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          onClose={() => dispatch(clearDriverReleaseNotice())}
        >
          {driverReleaseNotice}
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          mb: 2,
          borderBottom: '1px solid #E8C9B0',
          '& .MuiTab-root': { fontSize: { xs: 11.5, sm: 13 }, minHeight: 44 },
        }}
      >
        <Tab label={`הובלות שאני מבצע היום (${myStops.length})`} />
        <Tab label={`בתהליך מסירה לנגר (${myCarpenterStops.length})`} />
        <Tab label={`בתהליך מסירה ללקוח (${myCustomerStops.length})`} />
      </Tabs>

      <Grid container spacing={1.5}>
        {activeStops.length === 0 ? (
          <Grid size={{ xs: 12 }}>
            <Alert severity="info">{emptyHint}</Alert>
          </Grid>
        ) : (
          activeStops.map((s, i) => (
            <Grid size={{ xs: 12, md: 6 }} key={`${s.order?._id || s.order}-${i}`}>
              <Card sx={{ borderRadius: 2, border: "1px solid #E8C9B0" }}>
                <CardContent>
                  <Typography sx={{ fontWeight: 700 }}>{typeLabel[s.deliveryType]}</Typography>
                  <Typography sx={{ fontSize: 12, color: "#A1887F", mb: 0.4 }}>
                    מספר הזמנה: {getOrderCode(s)}
                  </Typography>
                  <DeliveryStations stop={s} />
                  <Typography sx={{ fontSize: 12, color: "#7B6A5F", mb: 1, mt: 0.5 }}>
                    {s.contactName} {s.contactPhone ? `| ${s.contactPhone}` : ""}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                    {isStopDelivered(s) && (
                      <Typography
                        component="span"
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          color: "#2E7D32",
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        <CheckCircleIcon sx={{ fontSize: 20 }} />
                        נמסר
                      </Typography>
                    )}
                    {!isStopDelivered(s) && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => handleCompleteStop(s._id)}
                        disabled={completeLoading}
                        sx={{ bgcolor: "#2E7D32", "&:hover": { bgcolor: "#1B5E20" } }}
                      >
                        סמן כהושלם
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <FeedbackSnackbar />
    </Box>
  );
};

export { DeliveryStations };
export default DriverDeliveries;
