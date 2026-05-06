import Order from "../models/Order.js";
import User from "../models/User.js";
import DeliveryRun from "../models/DeliveryRun.js";
import NodeGeocoder from "node-geocoder";
import axios from "axios";

// הגדרת הגאו-קודר החינמי (OpenStreetMap)
const geocoder = NodeGeocoder({
  provider: "openstreetmap"
});

const MAX_STOPS_PER_DRIVER = 10;
const DEFAULT_HOURS_PER_DELIVERY = 1;
const AVG_CITY_SPEED_KMPH = 35;
const STOP_SERVICE_MINUTES = 12;
const OSRM_BASE_URL = "https://router.project-osrm.org";

/**
 * המרת כתובת לקואורדינטות (גרסה חינמית ללא גוגל)
 */
const geocodeAddress = async (address) => {
  try {
    // הוספת "ישראל" לכתובת כדי לדייק את החיפוש
    const fullAddress = `${address}, Israel`;
    const res = await geocoder.geocode(fullAddress);
    
    if (res.length > 0) {
      return { lat: res[0].latitude, lng: res[0].longitude };
    }
    return null;
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
        address: order.deliveryAddress,
        lat: coords.lat,
        lng: coords.lng,
        wazeUrl: `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`
      });
    } else {
      // אם לא מצא קואורדינטות, נשים ברירת מחדל של מרכז הארץ כדי שלא יקרוס
      stopsWithCoords.push({
        order: order._id,
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
  return await DeliveryRun.findOne({
    driver: driverId,
    status: { $in: ["PENDING", "IN_PROGRESS"] }
  }).populate("stops.order");
};

export const completeStop = async (runId, stopIndex) => {
  const run = await DeliveryRun.findById(runId);
  run.stops[stopIndex].status = "COMPLETED";
  run.stops[stopIndex].completedAt = new Date();
  run.currentStopIndex = stopIndex + 1;

  if (run.currentStopIndex >= run.stops.length) {
    run.status = "COMPLETED";
  } else {
    run.status = "IN_PROGRESS";
  }

  await run.save();
  const stop = run.stops[stopIndex];
  if (stop.deliveryType === "TO_CARPENTER") {
    await Order.findByIdAndUpdate(stop.order, {
      receivedByCarpenter: true,
      status: "IN_PROGRESS",
    });
  } else {
    await Order.findByIdAndUpdate(stop.order, { status: "DONE" });
  }
  return run;
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

const classifyOrderAsStop = async (order) => {
  const isToCarpenter =
    order.status === "READY_FOR_SHIPPING" &&
    !order.receivedByCarpenter &&
    !order.carpenterCompletedAt;
  const isToCustomer =
    order.status === "READY_FOR_SHIPPING" &&
    !!order.carpenterCompletedAt &&
    !!order.isPaid;

  if (!isToCarpenter && !isToCustomer) return null;

  if (isToCarpenter) {
    const targetAddress = order.assignedCarpenter?.address || "";
    if (!targetAddress.trim()) return null;
    const coords = await geocodeAddress(targetAddress);
    return {
      order: order._id,
      deliveryType: "TO_CARPENTER",
      address: targetAddress,
      contactName: order.assignedCarpenter?.fullName || "נגר",
      contactPhone: order.assignedCarpenter?.phone || "",
      lat: coords?.lat || null,
      lng: coords?.lng || null,
      wazeUrl: buildWazeUrl(coords?.lat, coords?.lng, targetAddress),
    };
  }

  const customerAddress = order.customer?.deliveryAddress || "";
  if (!customerAddress.trim()) return null;
  const coords = await geocodeAddress(customerAddress);
  return {
    order: order._id,
    deliveryType: "TO_CUSTOMER",
    address: customerAddress,
    contactName: order.customer?.name || "לקוח",
    contactPhone: order.customer?.phone1 || "",
    lat: coords?.lat || null,
    lng: coords?.lng || null,
    wazeUrl: buildWazeUrl(coords?.lat, coords?.lng, customerAddress),
  };
};

export const getPendingDeliveriesPool = async () => {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const claimedRuns = await DeliveryRun.find({
    date: { $gte: todayStart, $lte: todayEnd },
    status: { $in: ["PENDING", "IN_PROGRESS"] },
  }).select("stops.order");

  const claimedOrderIds = new Set(
    claimedRuns.flatMap((r) => r.stops.map((s) => String(s.order)))
  );

  const candidateOrders = await Order.find({ status: "READY_FOR_SHIPPING" })
    .populate("assignedCarpenter", "fullName address phone")
    .sort({ readyForShippingAt: 1, createdAt: 1 });

  const stops = [];
  for (const order of candidateOrders) {
    if (claimedOrderIds.has(String(order._id))) continue;
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
  const enriched = pool.map((s) => ({
    ...s,
    lat: s.lat ?? warehouseCoords.lat,
    lng: s.lng ?? warehouseCoords.lng,
  }));
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

  const run = await DeliveryRun.create({
    driver: driverId,
    date: new Date(),
    status: "PENDING",
    estimatedDuration: Math.round(totalHours * 100) / 100,
    totalDistance: Math.round(totalDistanceKm * 10) / 10,
    stops: optimizedStops,
  });

  return run;
};

export const getDriverTodayRun = async (driverId) => {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  return DeliveryRun.findOne({
    driver: driverId,
    date: { $gte: todayStart, $lte: todayEnd },
    status: { $in: ["PENDING", "IN_PROGRESS"] },
  }).populate("stops.order");
};