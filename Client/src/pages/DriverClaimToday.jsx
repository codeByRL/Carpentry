import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import RouteIcon from "@mui/icons-material/Route";
import {
  fetchPendingDeliveries,
  fetchMyTodayRun,
  claimDeliveriesForToday,
  clearDeliveryError,
  clearDeliveryInfo,
} from "../store/slices/deliverySlice";
import { useFeedbackSnackbar } from "../hooks/useFeedbackSnackbar";
import { useOrderLiveRefresh } from "../hooks/useOrderLiveRefresh";
import PageHeader from "../components/PageHeader.jsx";
import {
  DRIVER_START_CITIES,
  buildClaimStartPayload,
  getDriverStartLabel,
} from "../utils/driverClaimConstants.js";
import { DeliveryStations } from "./DriverDeliveries.jsx";

const typeLabel = {
  TO_CARPENTER: "הובלה לנגר",
  TO_CUSTOMER: "הובלה לבית הלקוח",
};

const getOrderCode = (stop) => {
  const rawId = stop?.order?._id || stop?.order;
  if (!rawId) return "—";
  const idStr = String(rawId);
  return `#${idStr.slice(-6)}`;
};

const DriverClaimToday = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showSuccess, showError, FeedbackSnackbar } = useFeedbackSnackbar();
  const { user } = useSelector((s) => s.auth);
  const { pendingPool, myRun, loading, claimLoading, error, info } = useSelector((s) => s.delivery);

  const [desiredHours, setDesiredHours] = useState("8");
  const [startCityId, setStartCityId] = useState("beitar");
  const [localError, setLocalError] = useState("");

  const loadData = () => {
    dispatch(fetchPendingDeliveries());
    dispatch(fetchMyTodayRun());
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useOrderLiveRefresh(loadData);

  const handleClaim = async () => {
    setLocalError("");
    const hours = Number(desiredHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      setLocalError("יש להזין שעות עבודה מתוכננות (מספר גדול מ־0)");
      dispatch(clearDeliveryInfo());
      return;
    }
    const start = buildClaimStartPayload(startCityId);
    if (!start) {
      setLocalError("יש לבחור עיר יציאה");
      dispatch(clearDeliveryInfo());
      return;
    }
    dispatch(clearDeliveryError());
    dispatch(clearDeliveryInfo());
    setLocalError("");
    const payload = { desiredHours: hours, ...start };
    const result = await dispatch(claimDeliveriesForToday(payload));
    if (!result.error) {
      loadData();
      const count = result.payload?.run?.stops?.length || 0;
      showSuccess(count > 0 ? `נשבצו ${count} הובלות למסלול היום` : "המסלול ליום עודכן");
      navigate("/driver/deliveries");
    } else {
      dispatch(fetchMyTodayRun());
      showError(typeof result.payload === "string" ? result.payload : "שגיאה בתכנון המסלול");
    }
  };

  const name = user?.fullName || user?.username || "מוביל";
  const dateStr = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
        title="תכנון מסלול יומי"
        description={`שלום, ${name} — בחר שעות ועיר יציאה, שלב הובלות מהבריכה למסלול היום, ועיין ברשימה לפני האישור.\n${dateStr}`}
      />

      {(error || localError) && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => {
            setLocalError("");
            dispatch(clearDeliveryError());
          }}
        >
          {localError || error}
        </Alert>
      )}
      {info && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => dispatch(clearDeliveryInfo())}>
          {info}
        </Alert>
      )}

      <Card sx={{ borderRadius: 3, mb: 2, border: "1px solid #E8C9B0" }}>
        <CardContent>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>תכנון מסלול יומי לפי שעות עבודה</Typography>
          <Box
            sx={{
              display: "flex",
              gap: 1,
              alignItems: "stretch",
              flexWrap: "wrap",
              flexDirection: { xs: "column", sm: "row" },
            }}
          >
            <TextField
              label="שעות עבודה מתוכננות"
              type="number"
              size="small"
              value={desiredHours}
              onChange={(e) => setDesiredHours(e.target.value)}
              sx={{ width: { xs: "100%", sm: 180 }, flexShrink: 0 }}
            />
            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 200 }, flex: { sm: "0 0 auto" } }}>
              <InputLabel id="claim-start-city-label">מאיפה יוצאים?</InputLabel>
              <Select
                labelId="claim-start-city-label"
                label="מאיפה יוצאים?"
                value={startCityId}
                onChange={(e) => setStartCityId(e.target.value)}
              >
                {DRIVER_START_CITIES.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              color="primary"
              startIcon={<RouteIcon />}
              onClick={handleClaim}
              disabled={claimLoading}
              sx={{
                width: { xs: "100%", sm: "auto" },
                alignSelf: { sm: "center" },
              }}
            >
              {claimLoading ? "טוען..." : "שבץ מסלול להיום"}
            </Button>
          </Box>
          {myRun && (
            <Typography sx={{ fontSize: 12, color: "#7B6A5F", mt: 1 }}>
              תכנון היום: כ-{myRun.estimatedDuration || 0} שעות | מרחק משוער: {myRun.totalDistance || 0} ק״מ
            </Typography>
          )}
          {startCityId && (
            <Typography sx={{ fontSize: 11.5, color: "#5D4037", mt: 0.75 }}>
              נקודת התחלה לחישוב: {getDriverStartLabel(startCityId)}
            </Typography>
          )}
          <Typography sx={{ fontSize: 11.5, color: "#7B6A5F", mt: 1 }}>
            בחר עיר יציאה. כל הובלה כוללת 2 תחנות (מחסן→נגר או נגר→לקוח). החישוב: נסיעה לתחנה 1 + 15 דק׳ + נסיעה לתחנה 2 + 15 דק׳.
          </Typography>
        </CardContent>
      </Card>

      <Typography sx={{ fontWeight: 700, mb: 1.5 }}>כל ההובלות הממתינות ({pendingPool.length})</Typography>
      <Grid container spacing={1.5}>
        {pendingPool.length === 0 ? (
          <Grid size={{ xs: 12 }}>
            <Alert severity="info">אין כרגע הובלות ממתינות</Alert>
          </Grid>
        ) : (
          pendingPool.map((s, i) => (
            <Grid size={{ xs: 12, md: 6 }} key={`${s.order}-${i}`}>
              <Card sx={{ borderRadius: 2, border: "1px solid #E8C9B0" }}>
                <CardContent>
                  <Typography sx={{ fontWeight: 700 }}>{typeLabel[s.deliveryType]}</Typography>
                  <Typography sx={{ fontSize: 12, color: "#A1887F", mb: 0.4 }}>
                    מספר הזמנה: {getOrderCode(s)}
                  </Typography>
                  <DeliveryStations stop={s} />
                  <Typography sx={{ fontSize: 12, color: "#7B6A5F", mt: 0.5 }}>
                    {s.contactName} {s.contactPhone ? `| ${s.contactPhone}` : ""}
                  </Typography>
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

export default DriverClaimToday;
