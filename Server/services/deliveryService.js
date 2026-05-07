import Order from "../models/Order.js";
import User from "../models/User.js";
import DeliveryRun from "../models/DeliveryRun.js";
import NodeGeocoder from "node-geocoder";
import axios from "axios";

// הגדרת הגאו-קודר החינמי (OpenStreetMap / Nominatim)
const geocoder = NodeGeocoder({
  provider: "openstreetmap",
  language: "he",
});

const MAX_STOPS_PER_DRIVER = 10;
const DEFAULT_HOURS_PER_DELIVERY = 1;
const AVG_CITY_SPEED_KMPH = 35;
const STOP_SERVICE_MINUTES = 12;
const OSRM_BASE_URL = "https://router.project-osrm.org";
const WAREHOUSE_ADDRESS_LABEL = "מחסן ראשי";

/**
 * המרת כתובת לקואורדינטות (גרסה חינמית ללא גוגל)
 */
const geocodeAddress = async (address) => {
  try {
    const trimmed = String(address || "").trim();
    if (!trimmed) return null;

    // Nominatim: מגבילים לישראל כדי שלא יוחזר "שמואל הנביא" בעיר אחרת / מחוץ לארץ
    const q =
      /ישראל|israel/i.test(trimmed) ? trimmed : `${trimmed}, Israel`;

    const res = await geocoder.geocode({
      q,
      countrycodes: "il",
      limit: 5,
    });

    if (!res?.length) return null;

    const inIsrael = res.filter((r) => r.countryCode === "IL");
    const pick = inIsrael[0] || res[0];
    const lat = pick?.latitude;
    const lng = pick?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") return null;

    return { lat, lng };
  } catch (error) {
    console.error("Geocoding error:", error.message);
    return null;
  }
};

/**
 * חישוב מרחק בין שתי נקודות (Haversine)
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const estimateLegHours = (km) => km / AVG_CITY_SPEED_KMPH;
const estimateStopServiceHours = () => STOP_SERVICE_MINUTES / 60;

/**
 * אלגוריתם Nearest Neighbor לסידור עצירות
 */
const optimizeRoute = (stops, startLat, startLng) => {
  const optimized = [];
  const remaining = [...stops];
  let currentLat = startLat;
  let currentLng = startLng;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    remaining.forEach((stop, index) => {
      const distance = calculateDistance(currentLat, currentLng, stop.lat, stop.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = index;
      }
    });

    const nearest = remaining.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    currentLat = nearest.lat;
    currentLng = nearest.lng;
  }

  return optimized;
};

const chooseOptimizedStopsWithinHours = (stops, desiredHours, startLat, startLng) => {
  const remaining = [...stops];
  const chosen = [];
  let currentLat = startLat;
  let currentLng = startLng;
  let totalHours = 0;
  let totalDistanceKm = 0;

  while (remaining.length > 0 && chosen.length < MAX_STOPS_PER_DRIVER) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const d = calculateDistance(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearestIndex = i;
      }
    }
    if (nearestIndex === -1) break;

    const candidate = remaining[nearestIndex];
    const nextTotalHours = totalHours + estimateLegHours(nearestDistance) + estimateStopServiceHours();

    // תמיד ניקח לפחות עצירה אחת, גם אם ההערכה חורגת.
    if (chosen.length > 0 && nextTotalHours > desiredHours) {
      break;
    }

    chosen.push(candidate);
    totalHours = nextTotalHours;
    totalDistanceKm += nearestDistance;
    currentLat = candidate.lat;
    currentLng = candidate.lng;
    remaining.splice(nearestIndex, 1);
  }

  return {
    stops: chosen,
    totalHours,
    totalDistanceKm,
  };
};

const optimizeRouteWithOsrm = async (stops, startLat, startLng) => {
  if (!stops.length) {
    return { stops: [], legDurationsHours: [], legDistancesKm: [] };
  }

  const indexedStops = stops.map((s, idx) => ({ ...s, __idx: idx + 1 })); // +1 כי 0 שמור למחסן
  const coords = [{ lat: startLat, lng: startLng }, ...indexedStops]
    .map((p) => `${p.lng},${p.lat}`)
    .join(";");

  const url = `${OSRM_BASE_URL}/trip/v1/driving/${coords}?source=first&roundtrip=false&overview=false&steps=false`;
  const res = await axios.get(url, { timeout: 12000 });
  const trip = res.data?.trips?.[0];
  const waypoints = res.data?.waypoints;
  if (!trip || !Array.isArray(waypoints)) {
    throw new Error("OSRM trip response missing");
  }

  const inputOrderToTripOrder = new Map();
  for (let i = 0; i < waypoints.length; i += 1) {
    inputOrderToTripOrder.set(i, waypoints[i].waypoint_index);
  }

  const sortedStops = indexedStops
    .slice()
    .sort((a, b) => (inputOrderToTripOrder.get(a.__idx) || 0) - (inputOrderToTripOrder.get(b.__idx) || 0))
    .map(({ __idx, ...rest }) => rest);

  const legs = trip.legs || [];
  const legDurationsHours = legs.map((l) => Number(l.duration || 0) / 3600);
  const legDistancesKm = legs.map((l) => Number(l.distance || 0) / 1000);

  return { stops: sortedStops, legDurationsHours, legDistancesKm };
};

const trimStopsByHours = (orderedStops, legDurationsHours, legDistancesKm, desiredHours) => {
  const trimmed = [];
  let totalHours = 0;
  let totalDistanceKm = 0;

  for (let i = 0; i < orderedStops.length; i += 1) {
    const driveHours = Number(legDurationsHours[i] || 0);
    const serviceHours = estimateStopServiceHours();
    const nextTotal = totalHours + driveHours + serviceHours;

    if (trimmed.length > 0 && nextTotal > desiredHours) break;

    trimmed.push(orderedStops[i]);
    totalHours = nextTotal;
    totalDistanceKm += Number(legDistancesKm[i] || 0);
  }

  return {
    stops: trimmed,
    totalHours,
    totalDistanceKm,
  };
};

/**
 * יצירת משמרות נהגים (Dispatch)
 */
export const dispatchDeliveries = async () => {
  const orders = await Order.find({ status: "READY_FOR_SHIPPING" })
    .populate("catalogProduct")
    .sort({ orderDate: 1 });

  if (orders.length === 0) {
    return { message: "No orders ready for shipping" };
  }

  const stopsWithCoords = [];
  for (const order of orders) {
    const coords = await geocodeAddress(order.deliveryAddress);
    if (coords) {
      stopsWithCoords.push({
        order: order._id,
        deliveryType: "TO_CUSTOMER",
        address: order.deliveryAddress,
        lat: coords.lat,
        lng: coords.lng,
        wazeUrl: `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`
      });
    } else {
      // אם לא מצא קואורדינטות, נשים ברירת מחדל של מרכז הארץ כדי שלא יקרוס
      stopsWithCoords.push({
        order: order._id,
        deliveryType: "TO_CUSTOMER",
        address: order.deliveryAddress,
        lat: 32.0853,
        lng: 34.7818,
        wazeUrl: `https://waze.com/ul?q=${encodeURIComponent(order.deliveryAddress)}&navigate=yes`
      });
    }
  }

  const drivers = await User.find({ role: "DRIVER" });
  if (drivers.length === 0) throw new Error("No drivers available");

  const runs = [];
  const warehouseCoords = { lat: 32.0853, lng: 34.7818 }; // כתובת המחסן

  for (let i = 0; i < stopsWithCoords.length; i += MAX_STOPS_PER_DRIVER) {
    const batch = stopsWithCoords.slice(i, i + MAX_STOPS_PER_DRIVER);
    const driverIndex = Math.floor(i / MAX_STOPS_PER_DRIVER) % drivers.length;
    const driver = drivers[driverIndex];

    const optimizedStops = optimizeRoute(batch, warehouseCoords.lat, warehouseCoords.lng);

    const run = new DeliveryRun({
      driver: driver._id,
      stops: optimizedStops,
      status: "PENDING"
    });

    await run.save();

    const orderIds = optimizedStops.map(s => s.order);
    await Order.updateMany(
      { _id: { $in: orderIds } },
      { assignedDriver: driver._id }
    );

    runs.push(run);
  }

  return runs;
};

export const getDriverRoute = async (driverId) => {
  const run = await DeliveryRun.findOne({
    driver: driverId,
    status: { $in: ["PENDING", "IN_PROGRESS"] },
  }).populate(DRIVER_RUN_ORDER_POPULATE);
  return formatRunForDriverApi(run);
};

export const completeStop = async (runId, stopRef, driverId) => {
  const run = await DeliveryRun.findById(runId);
  if (!run) throw new Error("Delivery run not found");
  if (String(run.driver) !== String(driverId)) {
    throw new Error("Not authorized to update this delivery run");
  }

  let stopIndex = -1;
  if (typeof stopRef === "number" || /^\d+$/.test(String(stopRef))) {
    const parsed = Number(stopRef);
    if (Number.isInteger(parsed)) stopIndex = parsed;
  } else {
    stopIndex = run.stops.findIndex((s) => String(s._id) === String(stopRef));
  }
  if (stopIndex < 0 || stopIndex >= run.stops.length) {
    throw new Error("Stop not found in run");
  }
  if (run.stops[stopIndex].status === "COMPLETED") {
    await run.populate(DRIVER_RUN_ORDER_POPULATE);
    return formatRunForDriverApi(run);
  }

  run.stops[stopIndex].status = "COMPLETED";
  run.stops[stopIndex].completedAt = new Date();
  run.currentStopIndex = Math.max(run.currentStopIndex || 0, stopIndex + 1);

  if (run.currentStopIndex >= run.stops.length) {
    run.status = "COMPLETED";
  } else {
    run.status = "IN_PROGRESS";
  }

  await run.save();
  const stop = run.stops[stopIndex];
  const orderId = stop.order?._id ?? stop.order;
  if (!orderId) {
    throw new Error("עצירה ללא הפניה להזמנה");
  }
  if (stop.deliveryType === "TO_CARPENTER") {
    await Order.findByIdAndUpdate(orderId, {
      driverMarkedDeliveredToCarpenterAt: new Date(),
      deliveryClaimedBy: null,
      deliveryClaimedAt: null,
    });
  } else {
    await Order.findByIdAndUpdate(orderId, {
      status: "DONE",
      deliveryClaimedBy: null,
      deliveryClaimedAt: null,
    });
  }
  await run.populate(DRIVER_RUN_ORDER_POPULATE);
  return formatRunForDriverApi(run);
};

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const buildWazeUrl = (lat, lng, address) =>
  lat && lng
    ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;

/** כמו ב-pool הממתין: כתובת לקוח / כתובת נגר מהמסמכים העדכניים, לא מעותק בשכבת העצירה */
const DRIVER_RUN_ORDER_POPULATE = {
  path: "stops.order",
  populate: { path: "assignedCarpenter", select: "fullName address phone" },
};

const refreshStopDisplayFromOrder = (stop) => {
  const out = { ...stop };
  const order = out.order;
  if (!order || typeof order !== "object") return out;

  if (out.deliveryType === "TO_CUSTOMER") {
    const addr = order.customer?.deliveryAddress
      ? String(order.customer.deliveryAddress).trim()
      : "";
    if (addr) {
      const sourceAddress =
        order.assignedCarpenter?.address != null
          ? String(order.assignedCarpenter.address).trim()
          : "";
      out.address = addr;
      out.sourceType = "CARPENTER";
      out.sourceAddress = sourceAddress || out.sourceAddress || "";
      out.destinationType = "CUSTOMER";
      out.destinationAddress = addr;
      out.contactName = order.customer?.name || out.contactName || "לקוח";
      out.contactPhone =
        order.customer?.phone1 != null
          ? String(order.customer.phone1)
          : out.contactPhone || "";
      out.lat = null;
      out.lng = null;
      out.wazeUrl = buildWazeUrl(null, null, addr);
    }
    return out;
  }

  if (out.deliveryType === "TO_CARPENTER") {
    const c = order.assignedCarpenter;
    if (c && typeof c === "object") {
      const addr = c.address ? String(c.address).trim() : "";
      if (addr) {
        out.address = addr;
        out.sourceType = "WAREHOUSE";
        out.sourceAddress = out.sourceAddress || WAREHOUSE_ADDRESS_LABEL;
        out.destinationType = "CARPENTER";
        out.destinationAddress = addr;
        out.contactName = c.fullName || out.contactName || "נגר";
        out.contactPhone =
          c.phone != null ? String(c.phone) : out.contactPhone || "";
        out.lat = null;
        out.lng = null;
        out.wazeUrl = buildWazeUrl(null, null, addr);
      }
    }
    return out;
  }

  return out;
};

const formatRunForDriverApi = (run) => {
  if (!run) return null;
  const o = run.toObject ? run.toObject() : { ...run };
  o.stops = (o.stops || []).map((s) => refreshStopDisplayFromOrder(s));
  return o;
};

/**
 * סיווג עצירה למוביל:
 * - שלב ב׳ (ללקוח): אחרי שסימנו סיום עבודה אצל הנגר — תמיד לפני שלב א׳, כדי שלא יסומן בטעות שוב «הובלה לנגר».
 * - שלב א׳ (לנגר): חומרים מהמחסן לנגר — רק לפני קבלה אצל הנגר ולפני סיום נגר.
 * הערה: תשלום (isPaid) לא חוסם משלוח ללקוח; אחרת הזמנות «מוכנות למוביל» נתקעות בבריכה.
 */
const classifyOrderAsStop = async (order) => {
  if (order.status !== "READY_FOR_SHIPPING") return null;

  if (order.carpenterCompletedAt) {
    if (!order.isPaid) return null;
    const customerAddress = order.customer?.deliveryAddress || "";
    if (!customerAddress.trim()) return null;
    const coords = await geocodeAddress(customerAddress);
    return {
      order: order._id,
      deliveryType: "TO_CUSTOMER",
      address: customerAddress,
      sourceType: "CARPENTER",
      sourceAddress: order.assignedCarpenter?.address || "",
      destinationType: "CUSTOMER",
      destinationAddress: customerAddress,
      contactName: order.customer?.name || "לקוח",
      contactPhone: order.customer?.phone1 || "",
      lat: coords?.lat || null,
      lng: coords?.lng || null,
      wazeUrl: buildWazeUrl(coords?.lat, coords?.lng, customerAddress),
    };
  }

  if (order.receivedByCarpenter) return null;
  if (order.driverMarkedDeliveredToCarpenterAt) return null;

  const targetAddress = order.assignedCarpenter?.address || "";
  if (!targetAddress.trim()) return null;
  const coords = await geocodeAddress(targetAddress);
  return {
    order: order._id,
    deliveryType: "TO_CARPENTER",
    address: targetAddress,
    sourceType: "WAREHOUSE",
    sourceAddress: WAREHOUSE_ADDRESS_LABEL,
    destinationType: "CARPENTER",
    destinationAddress: targetAddress,
    contactName: order.assignedCarpenter?.fullName || "נגר",
    contactPhone: order.assignedCarpenter?.phone || "",
    lat: coords?.lat || null,
    lng: coords?.lng || null,
    wazeUrl: buildWazeUrl(coords?.lat, coords?.lng, targetAddress),
  };
};

export const getPendingDeliveriesPool = async () => {
  const candidateOrders = await Order.find({
    status: "READY_FOR_SHIPPING",
    $or: [{ deliveryClaimedBy: null }, { deliveryClaimedBy: { $exists: false } }],
  })
    .populate("assignedCarpenter", "fullName address phone")
    .sort({ readyForShippingAt: 1, createdAt: 1 });

  const stops = [];
  for (const order of candidateOrders) {
    const stop = await classifyOrderAsStop(order);
    if (stop) stops.push(stop);
  }

  return stops;
};

export const claimDeliveriesForToday = async (driverId, desiredHours) => {
  const hours = Math.max(Number(desiredHours || 0), 0);
  if (!hours) {
    throw new Error("יש להזין שעות עבודה מתוכננות");
  }

  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  // Close previous open runs for today of this driver.
  await DeliveryRun.updateMany(
    { driver: driverId, date: { $gte: todayStart, $lte: todayEnd }, status: { $in: ["PENDING", "IN_PROGRESS"] } },
    { status: "COMPLETED" }
  );

  const pool = await getPendingDeliveriesPool();
  if (!pool.length) return null;

  const warehouseCoords = { lat: 32.0853, lng: 34.7818 };
  // קואורדינטות ממחסן משמשות רק לחישוב סדר ב-OSRM כשאין geocode; לא לשמור אותן במסלול —
  // אחרת Waze/Google מציגים את ת"א במקום הכתובת האמיתית.
  const enriched = pool.map((s) => {
    const hasCoords =
      typeof s.lat === "number" &&
      typeof s.lng === "number" &&
      !Number.isNaN(s.lat) &&
      !Number.isNaN(s.lng);
    return {
      ...s,
      lat: hasCoords ? s.lat : warehouseCoords.lat,
      lng: hasCoords ? s.lng : warehouseCoords.lng,
      _coordsAreEstimated: !hasCoords,
    };
  });
  let optimizedStops = [];
  let totalHours = 0;
  let totalDistanceKm = 0;

  try {
    const osrm = await optimizeRouteWithOsrm(enriched, warehouseCoords.lat, warehouseCoords.lng);
    const trimmed = trimStopsByHours(osrm.stops, osrm.legDurationsHours, osrm.legDistancesKm, hours);
    optimizedStops = trimmed.stops;
    totalHours = trimmed.totalHours;
    totalDistanceKm = trimmed.totalDistanceKm;
  } catch {
    // Fallback פנימי אם שירות OSRM לא זמין.
    const fallback = chooseOptimizedStopsWithinHours(
      enriched,
      hours,
      warehouseCoords.lat,
      warehouseCoords.lng
    );
    optimizedStops = fallback.stops;
    totalHours = fallback.totalHours;
    totalDistanceKm = fallback.totalDistanceKm;
  }

  if (!optimizedStops.length) return null;

  /** אותה הזמנה לא אמורה להופיע פעמיים; אם כן — עדיפות לרגל ללקוח */
  const stopRank = (t) => (t === "TO_CUSTOMER" ? 2 : t === "TO_CARPENTER" ? 1 : 0);
  const byOrderId = new Map();
  for (const s of optimizedStops) {
    const oid = String(s.order?._id ?? s.order);
    if (!oid || oid === "undefined") continue;
    const prev = byOrderId.get(oid);
    if (!prev || stopRank(s.deliveryType) > stopRank(prev.deliveryType)) {
      byOrderId.set(oid, s);
    }
  }
  const firstIdx = new Map();
  optimizedStops.forEach((s, i) => {
    const oid = String(s.order?._id ?? s.order);
    if (oid && !firstIdx.has(oid)) firstIdx.set(oid, i);
  });
  optimizedStops = Array.from(byOrderId.entries())
    .sort((a, b) => (firstIdx.get(a[0]) ?? 0) - (firstIdx.get(b[0]) ?? 0))
    .map(([, s]) => s);

  if (!optimizedStops.length) return null;

  // תפיסה אטומית של הזמנות כדי למנוע כפילות בין מובילים מקבילים.
  const claimedStops = [];
  const now = new Date();
  for (const stop of optimizedStops) {
    const claimedOrder = await Order.findOneAndUpdate(
      {
        _id: stop.order,
        status: "READY_FOR_SHIPPING",
        $or: [{ deliveryClaimedBy: null }, { deliveryClaimedBy: { $exists: false } }],
      },
      { $set: { deliveryClaimedBy: driverId, deliveryClaimedAt: now } },
      { new: true }
    ).select("_id");
    if (claimedOrder) {
      claimedStops.push(stop);
    }
  }
  optimizedStops = claimedStops.map((stop) => {
    const { _coordsAreEstimated, ...base } = stop;
    if (_coordsAreEstimated) {
      return {
        ...base,
        lat: null,
        lng: null,
        wazeUrl: buildWazeUrl(null, null, stop.address),
      };
    }
    return base;
  });
  if (!optimizedStops.length) return null;

  let run;
  try {
    run = await DeliveryRun.create({
      driver: driverId,
      date: new Date(),
      status: "PENDING",
      estimatedDuration: Math.round(totalHours * 100) / 100,
      totalDistance: Math.round(totalDistanceKm * 10) / 10,
      stops: optimizedStops,
    });
  } catch (e) {
    await Order.updateMany(
      { _id: { $in: optimizedStops.map((s) => s.order) }, deliveryClaimedBy: driverId },
      { $set: { deliveryClaimedBy: null, deliveryClaimedAt: null } }
    );
    throw e;
  }

  await run.populate(DRIVER_RUN_ORDER_POPULATE);
  return formatRunForDriverApi(run);
};

export const getDriverTodayRun = async (driverId) => {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const run = await DeliveryRun.findOne({
    driver: driverId,
    date: { $gte: todayStart, $lte: todayEnd },
    status: { $in: ["PENDING", "IN_PROGRESS"] },
  }).populate(DRIVER_RUN_ORDER_POPULATE);
  return formatRunForDriverApi(run);
};

/**
 * הזמנות עם עצירת TO_CARPENTER במסלול מוביל פעיל, שעדיין לא סומנה כהושלמה.
 * משלים את deliveryClaimedBy כדי שדשבורד הנגר יסווג "בדרך" בצורה עקבית.
 */
export const getOrderIdsPendingCarpenterStopsInActiveRuns = async (orderIds) => {
  if (!orderIds?.length) return new Set();
  const ids = orderIds.filter(Boolean);
  const runs = await DeliveryRun.find({
    status: { $in: ["PENDING", "IN_PROGRESS"] },
    stops: {
      $elemMatch: {
        order: { $in: ids },
        deliveryType: "TO_CARPENTER",
        status: { $ne: "COMPLETED" },
      },
    },
  })
    .select("stops")
    .lean();

  const out = new Set();
  for (const run of runs) {
    for (const s of run.stops || []) {
      if (s.deliveryType !== "TO_CARPENTER") continue;
      if (s.status === "COMPLETED") continue;
      const oid = s.order?._id ?? s.order;
      if (oid) out.add(String(oid));
    }
  }
  return out;
};