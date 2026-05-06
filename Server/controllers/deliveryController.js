import * as deliveryService from "../services/deliveryService.js";

/**
 * מנהל: יצירת משמרות נהגים
 */
export const createDeliveryRuns = async (req, res) => {
  try {
    const runs = await deliveryService.dispatchDeliveries();
    res.json({ message: "Delivery runs created", runs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * נהג: קבלת המסלול שלי
 */
export const getMyRoute = async (req, res) => {
  try {
    const route = await deliveryService.getDriverRoute(req.user.id);
    
    if (!route) {
      return res.json({ message: "No active route" });
    }

    res.json(route);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * נהג: סימון עצירה כהושלמה
 */
export const markStopCompleted = async (req, res) => {
  try {
    const { runId, stopIndex } = req.body;
    const updatedRun = await deliveryService.completeStop(runId, stopIndex);
    res.json({ message: "Stop completed", run: updatedRun });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPendingDeliveries = async (req, res) => {
  try {
    const deliveries = await deliveryService.getPendingDeliveriesPool();
    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const claimMyDeliveries = async (req, res) => {
  try {
    const { desiredHours } = req.body;
    const run = await deliveryService.claimDeliveriesForToday(req.user.id, desiredHours);
    res.json({ message: "Deliveries claimed successfully", run });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getMyTodayDeliveries = async (req, res) => {
  try {
    const run = await deliveryService.getDriverTodayRun(req.user.id);
    res.json(run || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
