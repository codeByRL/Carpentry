import Order from "../models/Order.js";
import { broadcastOrderUpdated } from "../utils/realtimeEvents.js";
import User from "../models/User.js";
import DeliveryRun from "../models/DeliveryRun.js";
import Warehouse from "../models/Warehouse.js";
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
const STOP_SERVICE_MINUTES = 15;
const OSRM_BASE_URL = "https://router.project-osrm.org";
const WAREHOUSE_ADDRESS_LABEL = "מחסן ראשי";
/** לא משמש כברירת מחדל לתכנון מסלול נהג — רק לגאו-קוד של עצירות ללא כתובת */
const FALLBACK_MAP_CENTER = { lat: 32.0853, lng: 34.7818 };

let cachedPrimaryWarehouse = null;
let warehouseCacheAt = 0;
const WAREHOUSE_CACHE_MS = 5 * 60 * 1000;

const getPrimaryWarehouse = async () => {
  if (cachedPrimaryWarehouse && Date.now() - warehouseCacheAt < WAREHOUSE_CACHE_MS) {
    return cachedPrimaryWarehouse;
  }
  const wh = await Warehouse.findOne({ isActive: true }).sort({ createdAt: 1 }).lean();
  cachedPrimaryWarehouse = wh
    ? { name: wh.name, address: wh.address }
    : { name: WAREHOUSE_ADDRESS_LABEL, address: WAREHOUSE_ADDRESS_LABEL };
  warehouseCacheAt = Date.now();
  return cachedPrimaryWarehouse;
};

/** מזהה מחרוזות כמו "31.69700, 35.11500" או "31.697, 35.115 (מיקום נוכחי)" */
const parseLatLngFromText = (text) => {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  const m = trimmed.match(
    /^(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/
  );
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
};

const resolveDriverStartCoords = async (startOverride) => {
  if (!startOverride) return null;

  const lat = Number(startOverride.lat);
  const lng = Number(startOverride.lng);
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    return { lat, lng };
  }

  const addr = cleanAddressForGeocode(startOverride.address);
  if (!addr) return null;

  const parsed = parseLatLngFromText(addr);
  if (parsed) return parsed;

  const geo = await geocodeAddress(addr);
  if (geo) return geo;

  const known = lookupKnownCityCoords(addr);
  if (known) return known;

  const err = new Error(
    `לא הצלחנו לאתר את הכתובת «${addr}». נסה לפרט עיר ורחוב (למשל: ביתר עילית / הרצל 10, בני ברק), או הזן קואורדינטות.`
  );
  err.kind = "GEOCODE_FAILED";
  throw err;
};

/** גיבוי פשוט ללא אינטרנט — התאמה לשם עיר מהרשימה בקליינט */
const KNOWN_START_CITIES = [
  { label: "ביתר עילית", lat: 31.697, lng: 35.105 },
  { label: "בני ברק", lat: 32.087, lng: 34.832 },
  { label: "ירושלים", lat: 31.768, lng: 35.214 },
  { label: "תל אביב", lat: 32.085, lng: 34.781 },
  { label: "מודיעין עילית", lat: 31.932, lng: 35.038 },
  { label: "אלעד", lat: 32.052, lng: 34.952 },
  { label: "בית שמש", lat: 31.747, lng: 34.988 },
  { label: "אשדוד", lat: 31.804, lng: 34.655 },
  { label: "אשקלון", lat: 31.669, lng: 34.574 },
  { label: "חיפה", lat: 32.794, lng: 34.989 },
  { label: "באר שבע", lat: 31.252, lng: 34.791 },
  { label: "פתח תקווה", lat: 32.084, lng: 34.887 },
  { label: "רמת גן", lat: 32.068, lng: 34.824 },
  { label: "נתניה", lat: 32.321, lng: 34.853 },
  { label: "מודיעין", lat: 31.898, lng: 35.01 },
];

const lookupKnownCityCoords = (text) => {
  const norm = String(text || "").trim();
  if (!norm) return null;
  if (hasSubstantialStreetDetail(norm)) return null;
  const hit = KNOWN_START_CITIES.find(
    (c) => norm === c.label || norm.includes(c.label) || c.label.includes(norm)
  );
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
};

/** כתובת עם רחוב/מספר — לא להחליף במרכז עיר */
const hasSubstantialStreetDetail = (text) => {
  const t = String(text || "").trim();
  if (!t) return false;
  if (/\d/.test(t)) return true;
  if (/רחו['\u05f3]?ב|רח׳|שדרות|שד['\u05f3]?|דרך|סמט|מבוא|כיכר|בניין|קומה/i.test(t)) return true;
  const parts = t.split(/[,،]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const isKnownCity = (p) =>
      KNOWN_START_CITIES.some(
        (c) => p === c.label || p.includes(c.label) || c.label.includes(p)
      );
    if (parts.some((p) => !isKnownCity(p) && p.length > 1)) return true;
  }
  return false;
};

const formatAddressForWaze = (address) => {
  const addr = cleanAddressForGeocode(address);
  if (!addr) return "";
  if (!/ישראל|israel/i.test(addr)) return `${addr}, ישראל`;
  return addr;
};

const rankGeocodeHit = (pick) => {
  const type = String(pick?.type || pick?.raw?.type || "").toLowerCase();
  const cls = String(pick?.class || pick?.raw?.class || "").toLowerCase();
  let score = Number(pick?.importance ?? pick?.raw?.importance) || 0;
  if (cls === "highway" || /house|residential|street|road|building/.test(type)) score += 10;
  if (/city|town|village|administrative/.test(type)) score -= 5;
  return score;
};

const geocodeCache = new Map();

/** קואורדינטות לחישוב מסלול — עיר ידועה קודם, גאו-קוד רק אם צריך */
const coordsForAddress = async (address, existing = null) => {
  if (
    existing?.lat != null &&
    existing?.lng != null &&
    Number.isFinite(existing.lat) &&
    Number.isFinite(existing.lng)
  ) {
    return { lat: existing.lat, lng: existing.lng };
  }
  const cleaned = cleanAddressForGeocode(address);
  if (!cleaned) return null;

  const known = lookupKnownCityCoords(cleaned);
  if (known) return known;

  if (geocodeCache.has(cleaned)) return geocodeCache.get(cleaned);

  const geo = await geocodeAddress(cleaned);
  if (geo) {
    geocodeCache.set(cleaned, geo);
    return geo;
  }

  const fallback = lookupKnownCityCoords(cleaned);
  if (fallback) geocodeCache.set(cleaned, fallback);
  return fallback;
};

/** מסיר שאריות מ-GPS ותווי כיווניות לפני גאו-קוד */
const cleanAddressForGeocode = (text) =>
  String(text || "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\(מיקום נוכחי\)/gi, "")
    .replace(/^-?\d{1,3}(?:\.\d+)?\s*[,;\s]\s*-?\d{1,3}(?:\.\d+)?\s*/g, "")
    .trim();

const geocodeWithNominatim = async (query) => {
  const url = "https://nominatim.openstreetmap.org/search";
  const res = await axios.get(url, {
    params: {
      q: query,
      format: "json",
      limit: 5,
      countrycodes: "il",
      "accept-language": "he",
    },
    headers: {
      "User-Agent": "CarpentryDeliveryApp/1.0 (warehouse routing)",
    },
    timeout: 12000,
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  if (!rows.length) return null;
  rows.sort((a, b) => rankGeocodeHit(b) - rankGeocodeHit(a));
  const pick = rows[0];
  const lat = Number(pick.lat);
  const lng = Number(pick.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

/**
 * המרת כתובת לקואורדינטות (גרסה חינמית ללא גוגל)
 */
const geocodeAddress = async (address) => {
  try {
    const trimmed = cleanAddressForGeocode(address);
    if (!trimmed) return null;

    const queries = [
      /ישראל|israel/i.test(trimmed) ? trimmed : `${trimmed}, ישראל`,
      /ישראל|israel/i.test(trimmed) ? trimmed : `${trimmed}, Israel`,
      trimmed,
    ];
    const seen = new Set();

    for (const q of queries) {
      if (!q || seen.has(q)) continue;
      seen.add(q);

      try {
        const res = await geocoder.geocode({
          q,
          countrycodes: "il",
          limit: 5,
        });
        if (res?.length) {
          const inIsrael = res.filter((r) => r.countryCode === "IL");
          const candidates = inIsrael.length ? inIsrael : res;
          candidates.sort((a, b) => rankGeocodeHit(b) - rankGeocodeHit(a));
          const pick = candidates[0];
          const lat = pick?.latitude;
          const lng = pick?.longitude;
          if (typeof lat === "number" && typeof lng === "number") {
            return { lat, lng };
          }
        }
      } catch (inner) {
        console.warn("Geocoder provider failed for:", q, inner.message);
      }

      const nominatim = await geocodeWithNominatim(q);
      if (nominatim) return nominatim;
    }

    return lookupKnownCityCoords(trimmed);
  } catch (error) {
    console.error("Geocoding error:", error.message);
    return lookupKnownCityCoords(cleanAddressForGeocode(address));
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

const stationCoords = (station) => {
  if (
    station?.lat != null &&
    station?.lng != null &&
    Number.isFinite(station.lat) &&
    Number.isFinite(station.lng)
  ) {
    return { lat: station.lat, lng: station.lng };
  }
  return lookupKnownCityCoords(station?.address);
};

const driveHoursBetweenCoords = (from, to) => {
  if (!from || !to) return Infinity;
  const km = calculateDistance(from.lat, from.lng, to.lat, to.lng);
  return estimateLegHours(km);
};

/** זמן מלא להובלה: נסיעה→תחנה1 + עצירה + נסיעה→תחנה2 + עצירה */
const estimateJobHoursFrom = (fromCoords, stop) => {
  const s1 = stationCoords(stop.station1);
  const s2 = stationCoords(stop.station2);
  if (!s1 || !s2) return Infinity;
  const leg1 = driveHoursBetweenCoords(fromCoords, s1);
  const leg2 = driveHoursBetweenCoords(s1, s2);
  const service = estimateStopServiceHours();
  return leg1 + service + leg2 + service;
};

const estimateJobDistanceKmFrom = (fromCoords, stop) => {
  const s1 = stationCoords(stop.station1);
  const s2 = stationCoords(stop.station2);
  if (!s1 || !s2) return 0;
  return (
    calculateDistance(fromCoords.lat, fromCoords.lng, s1.lat, s1.lng) +
    calculateDistance(s1.lat, s1.lng, s2.lat, s2.lng)
  );
};

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

    if (nextTotalHours > desiredHours) {
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

/**
 * מטריצת זמני נסיעה (שעות) ומרחקים (ק"מ) בין כל הנקודות, באמצעות OSRM Table API.
 * הנקודה הראשונה היא נקודת המוצא של הנהג; שאר הנקודות הן ההובלות.
 * מחזיר null אם OSRM לא מגיב או לא מחזיר מטריצה תקינה.
 */
const buildOsrmTimeMatrix = async (points) => {
  if (!Array.isArray(points) || points.length < 2) return null;
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_BASE_URL}/table/v1/driving/${coords}?annotations=duration,distance`;
  try {
    const res = await axios.get(url, { timeout: 12000 });
    const durations = res.data?.durations;
    const distances = res.data?.distances;
    if (!Array.isArray(durations) || !Array.isArray(distances)) return null;
    const durationHours = durations.map((row) =>
      row.map((sec) => (sec == null ? Infinity : Number(sec) / 3600))
    );
    const distanceKm = distances.map((row) =>
      row.map((m) => (m == null ? Infinity : Number(m) / 1000))
    );
    return { durationHours, distanceKm };
  } catch (err) {
    console.warn("OSRM table failed:", err.message);
    return null;
  }
};

/**
 * fallback למטריצה: Haversine + מהירות ממוצעת בעיר.
 */
const buildHaversineTimeMatrix = (points) => {
  const n = points.length;
  const durationHours = Array.from({ length: n }, () => Array(n).fill(0));
  const distanceKm = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const km = calculateDistance(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
      distanceKm[i][j] = km;
      durationHours[i][j] = estimateLegHours(km);
    }
  }
  return { durationHours, distanceKm };
};

/**
 * Greedy חכם:
 * בכל איטרציה נבחר את ההובלה הקרובה ביותר מהנקודה הנוכחית שעדיין נכנסת בזמן הנותר.
 * אם הקרובה לא נכנסת — נדלג עליה ונבדוק את הבאה (לפי קרבה).
 * נמשיך עד שאף הובלה לא נכנסת או שעברנו את MAX_STOPS_PER_DRIVER.
 */
const greedyChooseWithinHours = (stops, matrix, desiredHours) => {
  const chosen = [];
  const chosenIndices = [];
  const remaining = stops.map((_, idx) => idx);
  let currentMatrixIdx = 0; // אינדקס 0 במטריצה = נקודת ההתחלה של הנהג
  let totalHours = 0;
  let totalDistanceKm = 0;
  const serviceHours = estimateStopServiceHours();

  while (remaining.length && chosen.length < MAX_STOPS_PER_DRIVER) {
    // מסדרים את שאריות לפי משך נסיעה מהנקודה הנוכחית
    const sortedByTime = [...remaining].sort((a, b) => {
      // matrix index של הובלה k הוא k+1 (כי 0 שמור לנקודת מוצא)
      const aTime = matrix.durationHours[currentMatrixIdx][a + 1];
      const bTime = matrix.durationHours[currentMatrixIdx][b + 1];
      return aTime - bTime;
    });

    let picked = -1;
    for (const stopIdx of sortedByTime) {
      const driveHours = matrix.durationHours[currentMatrixIdx][stopIdx + 1];
      if (!Number.isFinite(driveHours)) continue;
      const nextTotal = totalHours + driveHours + serviceHours;
      if (nextTotal <= desiredHours) {
        picked = stopIdx;
        totalHours = nextTotal;
        totalDistanceKm += matrix.distanceKm[currentMatrixIdx][stopIdx + 1] || 0;
        break;
      }
    }

    if (picked === -1) break;
    chosen.push(stops[picked]);
    chosenIndices.push(picked);
    currentMatrixIdx = picked + 1;
    remaining.splice(remaining.indexOf(picked), 1);
  }

  return { stops: chosen, totalHours, totalDistanceKm };
};

const trimStopsByHours = (orderedStops, legDurationsHours, legDistancesKm, desiredHours) => {
  const trimmed = [];
  let totalHours = 0;
  let totalDistanceKm = 0;

  for (let i = 0; i < orderedStops.length; i += 1) {
    const driveHours = Number(legDurationsHours[i] || 0);
    const serviceHours = estimateStopServiceHours();
    const nextTotal = totalHours + driveHours + serviceHours;

    if (nextTotal > desiredHours) break;

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
        lat: FALLBACK_MAP_CENTER.lat,
        lng: FALLBACK_MAP_CENTER.lng,
        wazeUrl: `https://waze.com/ul?q=${encodeURIComponent(order.deliveryAddress)}&navigate=yes`
      });
    }
  }

  const drivers = await User.find({ role: "DRIVER" });
  if (drivers.length === 0) throw new Error("No drivers available");

  const runs = [];
  const warehouseCoords = { ...FALLBACK_MAP_CENTER };

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
  return await formatRunForDriverApi(run);
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
    return await formatRunForDriverApi(run);
  }

  run.stops[stopIndex].status = "COMPLETED";
  run.stops[stopIndex].completedAt = new Date();
  run.currentStopIndex = Math.max(run.currentStopIndex || 0, stopIndex + 1);

  // המסלול ייסגר רק כשבאמת *כל* העצירות בוצעו — לא מספיק ש-currentStopIndex
  // הגיע לסוף הרשימה (זה יקרה גם אם הנהג סימן עצירות בסדר לא רציף, וישאיר
  // אחורה עצירות תקועות ב-PENDING).
  const allStopsCompleted = run.stops.every((s) => s.status === "COMPLETED");
  if (allStopsCompleted) {
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
  broadcastOrderUpdated({ orderId: String(orderId), kind: "delivery_stop_completed" });
  return await formatRunForDriverApi(run);
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

const buildWazeUrl = (_lat, _lng, address) => {
  const wazeAddr = formatAddressForWaze(address);
  if (wazeAddr) {
    return `https://waze.com/ul?q=${encodeURIComponent(wazeAddr)}&navigate=yes`;
  }
  const lat = Number(_lat);
  const lng = Number(_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  return "";
};

const buildStation = (stationType, label, name, address, coords) => ({
  stationType,
  label,
  name: name || label,
  address: address || "—",
  lat: coords?.lat ?? null,
  lng: coords?.lng ?? null,
  wazeUrl: buildWazeUrl(coords?.lat, coords?.lng, address),
});

/** שתי תחנות לכל הובלה: מחסן→נגר או נגר→לקוח */
const enrichStopStations = async (stop) => {
  const wh = await getPrimaryWarehouse();
  const whAddr = String(wh.address || WAREHOUSE_ADDRESS_LABEL).trim();
  const whName = String(wh.name || WAREHOUSE_ADDRESS_LABEL).trim();
  const order =
    stop.orderDoc ||
    (stop.order && typeof stop.order === "object" ? stop.order : null);

  if (stop.deliveryType === "TO_CARPENTER") {
    const destAddr = String(
      stop.destinationAddress || stop.address || order?.assignedCarpenter?.address || ""
    ).trim();
    const contactName = stop.contactName || order?.assignedCarpenter?.fullName || "נגר";
    const contactPhone = stop.contactPhone || order?.assignedCarpenter?.phone || "";
    const whCoords = await coordsForAddress(whAddr);
    const destCoords = await coordsForAddress(destAddr, {
      lat: stop.lat,
      lng: stop.lng,
    });
    const station1 = buildStation("WAREHOUSE", "מחסן", whName, whAddr, whCoords);
    const station2 = buildStation("CARPENTER", "נגר", contactName, destAddr, destCoords);
    return {
      ...stop,
      station1,
      station2,
      sourceType: "WAREHOUSE",
      sourceAddress: whAddr,
      destinationType: "CARPENTER",
      destinationAddress: destAddr,
      address: destAddr,
      lat: station2.lat,
      lng: station2.lng,
      contactName,
      contactPhone,
      wazeUrl: station2.wazeUrl,
      orderDoc: undefined,
    };
  }

  if (stop.deliveryType === "TO_CUSTOMER") {
    const carpenterAddr = String(
      stop.sourceAddress || order?.assignedCarpenter?.address || ""
    ).trim();
    const customerAddr = String(
      stop.destinationAddress || stop.address || order?.customer?.deliveryAddress || ""
    ).trim();
    const carpenterName = order?.assignedCarpenter?.fullName || "נגר";
    const customerName = stop.contactName || order?.customer?.name || "לקוח";
    const customerPhone = stop.contactPhone || order?.customer?.phone1 || "";
    const carpenterCoords = carpenterAddr ? await coordsForAddress(carpenterAddr) : null;
    const customerCoords = await coordsForAddress(customerAddr, {
      lat: stop.lat,
      lng: stop.lng,
    });
    const station1 = buildStation("CARPENTER", "נגר", carpenterName, carpenterAddr, carpenterCoords);
    const station2 = buildStation("CUSTOMER", "לקוח", customerName, customerAddr, customerCoords);
    return {
      ...stop,
      station1,
      station2,
      sourceType: "CARPENTER",
      sourceAddress: carpenterAddr,
      destinationType: "CUSTOMER",
      destinationAddress: customerAddr,
      address: customerAddr,
      lat: station2.lat,
      lng: station2.lng,
      contactName: customerName,
      contactPhone: customerPhone,
      wazeUrl: station2.wazeUrl,
      orderDoc: undefined,
    };
  }

  return stop;
};

const greedyChooseJobsWithinHours = (stops, driverStart, desiredHours) => {
  const chosen = [];
  const remaining = stops.map((_, i) => i);
  let current = driverStart;
  let totalHours = 0;
  let totalDistanceKm = 0;

  while (remaining.length && chosen.length < MAX_STOPS_PER_DRIVER) {
    const ranked = [...remaining].sort(
      (a, b) => estimateJobHoursFrom(current, stops[a]) - estimateJobHoursFrom(current, stops[b])
    );
    let picked = -1;
    for (const idx of ranked) {
      const jobHours = estimateJobHoursFrom(current, stops[idx]);
      if (!Number.isFinite(jobHours) || jobHours === Infinity) continue;
      if (totalHours + jobHours <= desiredHours) {
        picked = idx;
        totalHours += jobHours;
        totalDistanceKm += estimateJobDistanceKmFrom(current, stops[idx]);
        break;
      }
    }
    if (picked === -1) break;
    chosen.push(stops[picked]);
    const s2 = stationCoords(stops[picked].station2);
    if (s2) current = s2;
    remaining.splice(remaining.indexOf(picked), 1);
  }

  return { stops: chosen, totalHours, totalDistanceKm };
};

/** כמו ב-pool הממתין: כתובת לקוח / כתובת נגר מהמסמכים העדכניים, לא מעותק בשכבת העצירה */
const DRIVER_RUN_ORDER_POPULATE = {
  path: "stops.order",
  populate: { path: "assignedCarpenter", select: "fullName address phone" },
};

const refreshStopDisplayFromOrder = async (stop) => {
  const out = stop?.toObject ? stop.toObject() : { ...stop };
  const order =
    out.order && typeof out.order === "object"
      ? out.order
      : out.orderDoc && typeof out.orderDoc === "object"
        ? out.orderDoc
        : null;

  if (order) {
    if (out.deliveryType === "TO_CUSTOMER") {
      out.sourceAddress = order.assignedCarpenter?.address || out.sourceAddress || "";
      out.destinationAddress =
        order.customer?.deliveryAddress || out.destinationAddress || out.address || "";
      out.contactName = order.customer?.name || out.contactName || "לקוח";
      out.contactPhone = order.customer?.phone1 || out.contactPhone || "";
    }
    if (out.deliveryType === "TO_CARPENTER") {
      out.destinationAddress =
        order.assignedCarpenter?.address || out.destinationAddress || out.address || "";
      out.contactName = order.assignedCarpenter?.fullName || out.contactName || "נגר";
      out.contactPhone = order.assignedCarpenter?.phone || out.contactPhone || "";
    }
  }

  if (out.station1?.address && out.station2?.address) {
    out.station1 = {
      ...out.station1,
      wazeUrl: buildWazeUrl(out.station1.lat, out.station1.lng, out.station1.address),
    };
    out.station2 = {
      ...out.station2,
      wazeUrl: buildWazeUrl(out.station2.lat, out.station2.lng, out.station2.address),
    };
    delete out.orderDoc;
    return out;
  }

  return enrichStopStations({ ...out, orderDoc: order });
};

const formatRunForDriverApi = async (run) => {
  if (!run) return null;
  const o = run.toObject ? run.toObject() : { ...run };
  o.stops = await Promise.all(
    (o.stops || []).map(async (s) => {
      try {
        return await refreshStopDisplayFromOrder(s);
      } catch (err) {
        console.warn("refreshStopDisplayFromOrder:", err?.message || err);
        return s?.toObject ? s.toObject() : { ...s };
      }
    })
  );
  return o;
};

/** סוגר מסלולים פתוחים של הנהג להיום — רק לפני יצירת מסלול חדש מוצלח */
const closeDriverOpenRunsToday = async (driverId, todayStart, todayEnd) => {
  const openRunsToday = await DeliveryRun.find({
    driver: driverId,
    date: { $gte: todayStart, $lte: todayEnd },
    status: { $in: ["PENDING", "IN_PROGRESS"] },
  })
    .select("_id stops")
    .lean();

  for (const run of openRunsToday) {
    const orderIds = (run.stops || [])
      .filter((s) => s.status !== "COMPLETED")
      .map((s) => s.order)
      .filter(Boolean);
    if (orderIds.length) {
      await Order.updateMany(
        { _id: { $in: orderIds }, deliveryClaimedBy: driverId },
        { $set: { deliveryClaimedBy: null, deliveryClaimedAt: null } }
      );
    }
  }
  if (openRunsToday.length) {
    await DeliveryRun.updateMany(
      { _id: { $in: openRunsToday.map((r) => r._id) } },
      { $set: { status: "COMPLETED" } }
    );
  }
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
    return enrichStopStations({
      order: order._id,
      deliveryType: "TO_CUSTOMER",
      address: customerAddress,
      sourceType: "CARPENTER",
      sourceAddress: order.assignedCarpenter?.address || "",
      destinationType: "CUSTOMER",
      destinationAddress: customerAddress,
      contactName: order.customer?.name || "לקוח",
      contactPhone: order.customer?.phone1 || "",
      orderDoc: order,
    });
  }

  if (order.receivedByCarpenter) return null;
  if (order.driverMarkedDeliveredToCarpenterAt) return null;

  const targetAddress = order.assignedCarpenter?.address || "";
  if (!targetAddress.trim()) return null;
  return enrichStopStations({
    order: order._id,
    deliveryType: "TO_CARPENTER",
    address: targetAddress,
    sourceType: "WAREHOUSE",
    sourceAddress: WAREHOUSE_ADDRESS_LABEL,
    destinationType: "CARPENTER",
    destinationAddress: targetAddress,
    contactName: order.assignedCarpenter?.fullName || "נגר",
    contactPhone: order.assignedCarpenter?.phone || "",
    orderDoc: order,
  });
};

/**
 * שחרור אוטומטי של הובלות שלא בוצעו — חוזרות לבריכה בלי התערבות ידנית.
 *
 * כלל יחיד: מסלול מיום קודם (או ישן יותר) שלא הושלם → נסגר, תפיסות משוחררות.
 * מסלול של היום נשאר תפוס עד סיום או עד מעבר תאריך לוח (גם אם התחיל בבוקר וסיים בצהריים).
 */
const ABANDONED_RUN_AGE_MS = 24 * 60 * 60 * 1000;

export const DRIVER_DAY_MISSED_NOTICE =
  "לא ביצעת את מטלותיך ביום המיועד. המערכת לא שומרת נסיעות שמורות ליותר מיממה — תפוס לעצמך שוב נסיעות להיום.";

const releaseOrdersFromRun = async (run) => {
  const orderIds = (run.stops || [])
    .filter((s) => s.status !== "COMPLETED")
    .map((s) => s.order)
    .filter(Boolean);
  if (orderIds.length) {
    await Order.updateMany(
      { _id: { $in: orderIds }, deliveryClaimedBy: run.driver },
      { $set: { deliveryClaimedBy: null, deliveryClaimedAt: null } }
    );
  }
  await DeliveryRun.updateOne({ _id: run._id }, { $set: { status: "COMPLETED" } });
  const hadOpenWork = (run.stops || []).some((s) => s.status !== "COMPLETED");
  return { orderCount: orderIds.length, driverId: run.driver, hadOpenWork };
};

const notifyDriversDayMissed = async (driverIds) => {
  const unique = [...new Set(driverIds.filter(Boolean).map(String))];
  if (!unique.length) return;
  await User.updateMany(
    { _id: { $in: unique } },
    { $set: { driverDeliveryNotice: DRIVER_DAY_MISSED_NOTICE } }
  );
};

const releaseExpiredDeliveryRuns = async () => {
  const todayStart = startOfDay();

  let releasedOrders = 0;
  const driversToNotify = [];

  const pastRuns = await DeliveryRun.find({
    date: { $lt: todayStart },
    status: { $in: ["PENDING", "IN_PROGRESS"] },
  })
    .select("_id driver stops")
    .lean();

  for (const run of pastRuns) {
    const result = await releaseOrdersFromRun(run);
    releasedOrders += result.orderCount;
    if (result.hadOpenWork && result.driverId) driversToNotify.push(result.driverId);
  }

  await notifyDriversDayMissed(driversToNotify);

  if (releasedOrders > 0) {
    broadcastOrderUpdated({ kind: "delivery_runs_released", count: releasedOrders });
  }

  return releasedOrders;
};

/** גיבוי: מסלולים PENDING ישנים מאוד (24ש+) שלא נתפסו ע״י הלוגיקה למעלה */
const releaseAbandonedRuns = async () => {
  const cutoff = new Date(Date.now() - ABANDONED_RUN_AGE_MS);
  const abandoned = await DeliveryRun.find({
    status: "PENDING",
    $or: [
      { currentStopIndex: { $lte: 0 } },
      { currentStopIndex: { $exists: false } },
    ],
    date: { $lt: cutoff },
  })
    .select("_id driver stops")
    .lean();

  for (const run of abandoned) {
    const result = await releaseOrdersFromRun(run);
    if (result.hadOpenWork && result.driverId) {
      await notifyDriversDayMissed([result.driverId]);
    }
  }
};

/**
 * משחרר תפיסות על הזמנות READY_FOR_SHIPPING שאין להן עצירה פתוחה במסלול פעיל.
 * קורה כשמסלול נסגר בלי לסיים עצירות, או כשנהג תפס הובלות ולא המשיך.
 */
const releaseStaleDeliveryClaims = async () => {
  const claimedReady = await Order.find({
    status: "READY_FOR_SHIPPING",
    deliveryClaimedBy: { $ne: null },
  })
    .select("_id carpenterCompletedAt")
    .lean();

  for (const o of claimedReady) {
    const expectedType = o.carpenterCompletedAt ? "TO_CUSTOMER" : "TO_CARPENTER";
    const activeRun = await DeliveryRun.findOne({
      status: { $in: ["PENDING", "IN_PROGRESS"] },
      stops: {
        $elemMatch: {
          order: o._id,
          deliveryType: expectedType,
          status: { $ne: "COMPLETED" },
        },
      },
    })
      .select("_id")
      .lean();

    if (!activeRun) {
      await Order.updateOne(
        { _id: o._id },
        { $set: { deliveryClaimedBy: null, deliveryClaimedAt: null } }
      );
    }
  }
};

export const getPendingDeliveriesPool = async () => {
  await releaseExpiredDeliveryRuns();
  await releaseAbandonedRuns();
  await releaseStaleDeliveryClaims();

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

export const claimDeliveriesForToday = async (
  driverId,
  desiredHours,
  startOverride = null
) => {
  const hours = Math.max(Number(desiredHours || 0), 0);
  if (!hours) {
    throw new Error("יש להזין שעות עבודה מתוכננות");
  }

  await releaseExpiredDeliveryRuns();

  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const pool = await getPendingDeliveriesPool();
  if (!pool.length) {
    throw new Error("אין כרגע הובלות זמינות לתפיסה. בדוק שוב בהמשך היום.");
  }

  // נקודת התחלה של הנהג — חובה; בלי ברירת מחדל שקטה (מרכז ת"א היה מעוות מרחקים לבני ברק וכו').
  let startCoords;
  try {
    startCoords = await resolveDriverStartCoords(startOverride);
  } catch (err) {
    if (err?.kind === "GEOCODE_FAILED") throw err;
    throw err;
  }
  if (!startCoords) {
    throw new Error(
      "יש לבחור עיר יציאה לפני תפיסת הובלות"
    );
  }

  // בוחרים הובלות לפי שתי תחנות: יציאה→תחנה1→תחנה2 (מחסן→נגר או נגר→לקוח)
  const greedy = greedyChooseJobsWithinHours(pool, startCoords, hours);
  let optimizedStops = greedy.stops;
  let totalHours = greedy.totalHours;
  let totalDistanceKm = greedy.totalDistanceKm;

  if (!optimizedStops.length) {
    let minHoursForOne = Infinity;
    for (const stop of pool) {
      const total = estimateJobHoursFrom(startCoords, stop);
      if (Number.isFinite(total) && total < minHoursForOne) minHoursForOne = total;
    }
    const extraNeeded = Number.isFinite(minHoursForOne)
      ? Math.max(Math.ceil((minHoursForOne - hours) * 10) / 10, 0.1)
      : null;
    const message = extraNeeded
      ? `אף הובלה לא נכנסת בשעות שבחרת. הוסף לפחות עוד ${extraNeeded} שעות כדי שתהיה לפחות הובלה אחת מתאימה.`
      : Number.isFinite(minHoursForOne)
        ? `אף הובלה לא נכנסת בשעות שבחרת (נדרשות לפחות ~${Math.round(minHoursForOne * 100) / 100} שעות).`
        : "לא ניתן לחשב זמן נסיעה — ודאו שכתובות המחסן והנגר/לקוח כוללות שם עיר מוכר.";
    const err = new Error(message);
    err.kind = "NO_FIT";
    err.minHoursNeeded = Number.isFinite(minHoursForOne) ? Math.round(minHoursForOne * 100) / 100 : null;
    throw err;
  }

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

  if (!optimizedStops.length) {
    throw new Error("אין הובלות מתאימות להקצאה כעת.");
  }

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
    const { orderDoc, ...base } = stop;
    return {
      order: base.order?._id ?? base.order,
      deliveryType: base.deliveryType,
      address: base.address,
      contactName: base.contactName,
      contactPhone: base.contactPhone,
      lat: base.lat,
      lng: base.lng,
      wazeUrl: base.wazeUrl,
      station1: base.station1,
      station2: base.station2,
      sourceType: base.sourceType,
      sourceAddress: base.sourceAddress,
      destinationType: base.destinationType,
      destinationAddress: base.destinationAddress,
    };
  });
  if (!optimizedStops.length) {
    throw new Error("ההובלות שנבחרו נתפסו ע\"י נהג אחר באותו רגע. נסה שוב.");
  }

  await closeDriverOpenRunsToday(driverId, todayStart, todayEnd);

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
  await User.findByIdAndUpdate(driverId, { $set: { driverDeliveryNotice: null } });
  broadcastOrderUpdated({ kind: "delivery_claimed", driverId: String(driverId) });
  return await formatRunForDriverApi(run);
};

/**
 * סיכום ההובלות של נהג לחודש מסוים (ברירת מחדל: החודש הנוכחי).
 * מחזיר ספירה ורשימת עצירות שהושלמו (לפי `status==="COMPLETED"`),
 * כל עצירה עם נתוני ההזמנה והכתובות לעיון.
 */
const startOfMonth = (d = new Date()) => {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfNextMonth = (d = new Date()) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const getDriverMonthlyDeliveries = async (driverId, monthDate = new Date()) => {
  const periodStart = startOfMonth(monthDate);
  const periodEnd = startOfNextMonth(monthDate);

  // מסלולים שבוצעה בהם לפחות עצירה אחת בחודש הנבחר.
  // לוקחים גם מסלולים שעדיין IN_PROGRESS כי הם נספרים על השלמות בפועל.
  const runs = await DeliveryRun.find({
    driver: driverId,
    date: { $gte: periodStart, $lt: periodEnd },
  })
    .populate(DRIVER_RUN_ORDER_POPULATE)
    .sort({ date: -1 })
    .lean();

  const completedStops = [];
  for (const run of runs) {
    for (const rawStop of run.stops || []) {
      if (rawStop.status !== "COMPLETED") continue;
      const completedAt = rawStop.completedAt ? new Date(rawStop.completedAt) : null;
      if (completedAt && (completedAt < periodStart || completedAt >= periodEnd)) continue;
      const enriched = await refreshStopDisplayFromOrder(rawStop);
      completedStops.push({
        runId: run._id,
        runDate: run.date,
        deliveryType: enriched.deliveryType,
        completedAt: enriched.completedAt || null,
        orderId: enriched.order?._id || enriched.order || null,
        contactName: enriched.contactName || "",
        station1: enriched.station1 || null,
        station2: enriched.station2 || null,
        sourceType: enriched.sourceType || null,
        sourceAddress: enriched.sourceAddress || "",
        destinationType: enriched.destinationType || null,
        destinationAddress: enriched.destinationAddress || enriched.address || "",
      });
    }
  }

  completedStops.sort((a, b) => {
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bTime - aTime;
  });

  return {
    driverId: String(driverId),
    periodStart,
    periodEnd,
    count: completedStops.length,
    stops: completedStops,
  };
};

export const getDriverTodayRun = async (driverId) => {
  await releaseExpiredDeliveryRuns();
  await releaseStaleDeliveryClaims();

  const user = await User.findById(driverId).select("driverDeliveryNotice").lean();
  const releaseNotice = user?.driverDeliveryNotice || null;

  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const run = await DeliveryRun.findOne({
    driver: driverId,
    date: { $gte: todayStart, $lte: todayEnd },
    status: { $in: ["PENDING", "IN_PROGRESS"] },
  })
    .sort({ createdAt: -1 })
    .populate(DRIVER_RUN_ORDER_POPULATE);

  return {
    run: await formatRunForDriverApi(run),
    releaseNotice,
  };
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