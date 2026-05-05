import Order from "../models/Order.js";
import User from "../models/User.js";
import DeliveryRun from "../models/DeliveryRun.js";
import NodeGeocoder from "node-geocoder";

// הגדרת הגאו-קודר החינמי (OpenStreetMap)
const geocoder = NodeGeocoder({
  provider: "openstreetmap"
});

const MAX_STOPS_PER_DRIVER = 10;

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
  await Order.findByIdAndUpdate(run.stops[stopIndex].order, { status: "DONE" });
  return run;
};