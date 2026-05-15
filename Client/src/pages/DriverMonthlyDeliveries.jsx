import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import PageHeader from "../components/PageHeader.jsx";
import { fetchMyMonthlyDeliveries } from "../store/slices/deliverySlice";
import { useOrderLiveRefresh } from "../hooks/useOrderLiveRefresh";
import { DeliveryStations } from "./DriverDeliveries.jsx";

const typeLabel = {
  TO_CARPENTER: "הובלה לנגר",
  TO_CUSTOMER: "הובלה לבית הלקוח",
};

const DriverMonthlyDeliveries = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { myMonthly, myMonthlyLoading } = useSelector((s) => s.delivery);

  const load = () => {
    dispatch(fetchMyMonthlyDeliveries());
  };

  useEffect(() => {
    load();
  }, [dispatch]);

  useOrderLiveRefresh(load);

  const name = user?.fullName || user?.username || "מוביל";

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      <PageHeader
        title="הובלות החודש"
        description={`שלום, ${name} — רשימת עצירות שהושלמו בחודש הנוכחי (לצפייה בלבד).`}
      />

      {myMonthlyLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress color="secondary" />
        </Box>
      ) : (myMonthly?.stops || []).length === 0 ? (
        <Alert severity="info">עדיין לא ביצעת הובלות החודש.</Alert>
      ) : (
        <Grid container spacing={1.5}>
          {(myMonthly.stops || []).map((s, i) => {
            const completed = s.completedAt ? new Date(s.completedAt) : null;
            return (
              <Grid size={{ xs: 12, md: 6 }} key={`${s.orderId}-${i}`}>
                <Card sx={{ borderRadius: 2, border: "1px solid #E8C9B0" }}>
                  <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>{typeLabel[s.deliveryType]}</Typography>
                      <Typography
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          color: "#2E7D32",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        <CheckCircleIcon sx={{ fontSize: 18 }} />
                        נמסר
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 12, color: "#A1887F", mb: 0.4 }}>
                      מספר הזמנה: {s.orderId ? `#${String(s.orderId).slice(-6)}` : "—"}
                    </Typography>
                    <DeliveryStations stop={s} showWaze={false} />
                    <Typography sx={{ fontSize: 12, color: "#7B6A5F", mt: 0.5 }}>
                      {s.contactName || "—"}
                    </Typography>
                    {completed && (
                      <Typography sx={{ fontSize: 11.5, color: "#5D4037", mt: 0.4 }}>
                        הושלם ב-{completed.toLocaleString("he-IL")}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default DriverMonthlyDeliveries;
