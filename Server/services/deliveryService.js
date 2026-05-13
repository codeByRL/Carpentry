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
const STOP_SERVICE_MINUTES = 15;
const OSRM_BASE_URL = "https://router.project-osrm.org";
const WAREHOUSE_ADDRESS_LABEL = "מחסן ראשי";
/** לא משמש כברירת מחדל לתכנון מסלול נהג — רק לגאו-קוד של עצירות ללא כתובת */
const FALLBACK_MAP_CENTER = { lat: 32.0853, lng: 34.7818 };

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
  const hit = KNOWN_START_CITIES.find(
    (c) => norm === c.label || norm.includes(c.label) || c.label.includes(norm)
  );
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
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
          const pick = inIsrael[0] || res[0];
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
      // תמיד ניקח לפחות אחת — גם אם חרגנו במעט. אחרי הראשונה אכוף את התקרה.
      if (chosen.length === 0 || nextTotal <= desiredHours) {
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

/**
 * ניקוי "תקיעות": מסלולי הובלה ב-PENDING ללא תזוזה במשך יותר מ-ABANDONED_RUN_AGE_MS
 * נחשבים נטושים — סוגרים אותם ומשחררים את ה-claims על ההזמנות, כדי שיחזרו לבריכה.
 * רץ כתופעת לוואי שקטה לפני קריאה לבריכה, כדי שהמערכת תרפא את עצמה.
 */
const ABANDONED_RUN_AGE_MS = 24 * 60 * 60 * 1000;
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
  // ניקוי הגנה: שחרור claims תקועים לפני בניית הבריכה.
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

  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  // סגירת מסלולים פתוחים של היום + שחרור תפיסות על עצירות שלא הושלמו.
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
      "יש לקבוע נקודת התחלה — הזן כתובת (עיר/רחוב) או לחץ «השתמש במיקום שלי» לפני תפיסת הובלות"
    );
  }

  // קואורדינטות עזר משמשות רק לחישוב סדר ב-OSRM כשאין geocode להובלה; לא לשמור אותן במסלול —
  // אחרת Waze/Google מציגים את ת"א במקום הכתובת האמיתית.
  const enriched = pool.map((s) => {
    const hasCoords =
      typeof s.lat === "number" &&
      typeof s.lng === "number" &&
      !Number.isNaN(s.lat) &&
      !Number.isNaN(s.lng);
    return {
      ...s,
      lat: hasCoords ? s.lat : startCoords.lat,
      lng: hasCoords ? s.lng : startCoords.lng,
      _coordsAreEstimated: !hasCoords,
    };
  });

  // בוחרים הובלות בעזרת greedy חכם עם מטריצת זמנים (OSRM ואם לא — Haversine).
  // המטריצה כוללת את נקודת המוצא באינדקס 0, ואת ההובלות אחריה.
  const matrixPoints = [startCoords, ...enriched.map((s) => ({ lat: s.lat, lng: s.lng }))];
  let matrix = await buildOsrmTimeMatrix(matrixPoints);
  if (!matrix) {
    matrix = buildHaversineTimeMatrix(matrixPoints);
  }

  const greedy = greedyChooseWithinHours(enriched, matrix, hours);
  let optimizedStops = greedy.stops;
  let totalHours = greedy.totalHours;
  let totalDistanceKm = greedy.totalDistanceKm;

  if (!optimizedStops.length) {
    // חישוב כמה שעות צריך להוסיף כדי שלפחות הובלה אחת תיכנס (הקרובה ביותר).
    const serviceHours = estimateStopServiceHours();
    let minHoursForOne = Infinity;
    for (let i = 0; i < enriched.length; i += 1) {
      const driveHours = matrix.durationHours[0][i + 1];
      if (Number.isFinite(driveHours)) {
        const total = driveHours + serviceHours;
        if (total < minHoursForOne) minHoursForOne = total;
      }
    }
    const extraNeeded = Number.isFinite(minHoursForOne)
      ? Math.max(Math.ceil((minHoursForOne - hours) * 10) / 10, 0.1)
      : null;
    const message = extraNeeded
      ? `אף הובלה לא נכנסת בשעות שבחרת. הוסף לפחות עוד ${extraNeeded} שעות כדי שתהיה לפחות הובלה אחת מתאימה.`
      : "אף הובלה לא נכנסת בשעות שבחרת ממיקום ההתחלה.";
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
  if (!optimizedStops.length) {
    throw new Error("ההובלות שנבחרו נתפסו ע\"י נהג אחר באותו רגע. נסה שוב.");
  }

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
      const enriched = refreshStopDisplayFromOrder(rawStop);
      completedStops.push({
        runId: run._id,
        runDate: run.date,
        deliveryType: enriched.deliveryType,
        completedAt: enriched.completedAt || null,
        orderId: enriched.order?._id || enriched.order || null,
        contactName: enriched.contactName || "",
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