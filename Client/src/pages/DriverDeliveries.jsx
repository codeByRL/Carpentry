import React, { useEffect, useMemo, useState } from "react";
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
  TextField,
  Typography,
} from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import RouteIcon from "@mui/icons-material/Route";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import API from "../services/api";

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

const DriverDeliveries = () => {
  const [loading, setLoading] = useState(true);
  const [claimLoading, setClaimLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [pendingPool, setPendingPool] = useState([]);
  const [myRun, setMyRun] = useState(null);
  const [desiredHours, setDesiredHours] = useState("8");
  /** ברירת מחדל: הובלות שאני מבצע היום */
  const [tab, setTab] = useState(1);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [pendingRes, myRunRes] = await Promise.all([
        API.get("/delivery/pending"),
        API.get("/delivery/my-today"),
      ]);
      setPendingPool(Array.isArray(pendingRes.data) ? pendingRes.data : []);
      setMyRun(myRunRes.data || null);
    } catch (e) {
      setError(e.response?.data?.message || "שגיאה בטעינת נתוני משלוחים");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClaim = async () => {
    try {
      setClaimLoading(true);
      setError("");
      await API.post("/delivery/claim-my-today", { desiredHours: Number(desiredHours) });
      await loadData();
    } catch (e) {
      setError(e.response?.data?.message || "שגיאה בתפיסת הובלות להיום");
    } finally {
      setClaimLoading(false);
    }
  };

  const handleCompleteStop = async (stopId) => {
    if (!myRun?._id) return;
    try {
      setCompleteLoading(true);
      setError("");
      await API.post("/delivery/complete-stop", { runId: myRun._id, stopId });
      await loadData();
    } catch (e) {
      setError(e.response?.data?.message || "שגיאה בסימון הובלה כהושלמה");
    } finally {
      setCompleteLoading(false);
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

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress sx={{ color: "#D2691E" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color: "#3E2723", mb: 2 }}>
        דף מוביל - הובלות
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ borderRadius: 3, mb: 2, border: "1px solid #E8C9B0" }}>
        <CardContent>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>תפיסת הובלות להיום לפי שעות עבודה</Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <TextField
              label="שעות עבודה מתוכננות"
              type="number"
              size="small"
              value={desiredHours}
              onChange={(e) => setDesiredHours(e.target.value)}
              sx={{ width: 180 }}
            />
            <Button
              variant="contained"
              startIcon={<RouteIcon />}
              onClick={handleClaim}
              disabled={claimLoading}
              sx={{ bgcolor: "#D2691E", "&:hover": { bgcolor: "#A0522D" } }}
            >
              {claimLoading ? "טוען..." : "תפוס לי הובלות להיום"}
            </Button>
          </Box>
          {myRun && (
            <Typography sx={{ fontSize: 12, color: "#7B6A5F", mt: 1 }}>
              תכנון היום: כ-{myRun.estimatedDuration || 0} שעות | מרחק משוער: {myRun.totalDistance || 0} ק"מ
            </Typography>
          )}
        </CardContent>
      </Card>

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
        <Tab label={`כל ההובלות הממתינות (${pendingPool.length})`} />
        <Tab label={`הובלות שאני מבצע היום (${myStops.length})`} />
        <Tab label={`בתהליך מסירה לנגר (${myCarpenterStops.length})`} />
        <Tab label={`בתהליך מסירה ללקוח (${myCustomerStops.length})`} />
      </Tabs>

      {tab === 0 && (
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
                    <Typography sx={{ fontSize: 13 }}>{getSourceLine(s)}</Typography>
                    <Typography sx={{ fontSize: 13 }}>{getDestinationLine(s)}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#7B6A5F" }}>
                      {s.contactName} {s.contactPhone ? `| ${s.contactPhone}` : ""}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {tab > 0 && (
        <Grid container spacing={1.5}>
          {(tab === 1 ? myStops : tab === 2 ? myCarpenterStops : myCustomerStops).length === 0 ? (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">אין הובלות בתצוגה זו</Alert>
            </Grid>
          ) : (
            (tab === 1 ? myStops : tab === 2 ? myCarpenterStops : myCustomerStops).map((s, i) => (
              <Grid size={{ xs: 12, md: 6 }} key={`${s.order?._id || s.order}-${i}`}>
                <Card sx={{ borderRadius: 2, border: "1px solid #E8C9B0" }}>
                  <CardContent>
                    <Typography sx={{ fontWeight: 700 }}>{typeLabel[s.deliveryType]}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#A1887F", mb: 0.4 }}>
                      מספר הזמנה: {getOrderCode(s)}
                    </Typography>
                    <Typography sx={{ fontSize: 13 }}>{getSourceLine(s)}</Typography>
                    <Typography sx={{ fontSize: 13 }}>{getDestinationLine(s)}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#7B6A5F", mb: 1 }}>
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
                      <Link href={s.wazeUrl} target="_blank" underline="none">
                        <Button size="small" variant="outlined" startIcon={<LocalShippingIcon />}>
                          פתח Waze
                        </Button>
                      </Link>
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
      )}
    </Box>
  );
};

export default DriverDeliveries;
