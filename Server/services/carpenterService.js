import Order from "../models/Order.js";
import CatalogProduct from "../models/CatalogProduct.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

/**
 * קבלת כל ההזמנות של נגר ספציפי
 */
const getCarpenterOrders = async (carpenterId) => {
  return Order.find({ 
    assignedCarpenter: carpenterId,
    status: { $in: ["READY_FOR_SHIPPING", "IN_PROGRESS"] }
  }).sort({ estimatedDeliveryDate: 1 });
};

/**
 * נגר מסמן שקיבל את המשלוח מהנהג - מתחיל עבודה
 */
const startWork = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  order.status = "IN_PROGRESS";
  order.receivedByCarpenter = new Date();
  await order.save();

  return order;
};

/**
 * נגר מסיים הזמנה
 */
const completeOrder = async (orderId) => {
  const order = await Order.findById(orderId).populate("catalogProduct");
  if (!order) throw new Error("Order not found");

  order.status = "DONE";
  order.actualFinishDate = new Date();
  await order.save();

  // עדכון עומס העבודה של הנגר (הפחתת שעות העבודה של המוצר שסיים)
  await User.findByIdAndUpdate(order.assignedCarpenter, {
    $inc: { 
      currentWorkloadHours: -order.catalogProduct.estimatedWorkTime,
      activeOrdersCount: -1 
    }
  });

  return order;
};

/**
 * אפיון מוצר חדש על ידי נגר
 */
const characterizeProduct = async (productId, data) => {
  const { baseProducts, estimatedWorkTime } = data;

  const product = await CatalogProduct.findById(productId);
  if (!product) throw new Error("Product not found");

  product.baseProducts = baseProducts; // מערך של { product, quantity }
  product.estimatedWorkTime = estimatedWorkTime;
  product.status = "WAITING_ADMIN_APPROVAL"; // עובר לאישור מנהל
  
  await product.save();
  return product;
};

/**
 * בדיקת התראות איחור לנגרים (לרוץ פעם ביום/שעה)
 */
const checkDeadlines = async () => {
  const activeOrders = await Order.find({ status: "IN_PROGRESS" }).populate("catalogProduct assignedCarpenter");
  
  const alerts = [];
  const now = new Date();

  for (const order of activeOrders) {
    const timeSpent = (now - order.receivedByCarpenter) / (1000 * 60 * 60); // שעות שעברו
    
    // אם עבר יותר זמן מהזמן המשוער של המוצר
    if (timeSpent > order.catalogProduct.estimatedWorkTime) {
      const msg = `Order #${order.orderNumber} is taking longer than expected!`;
      
      // יצירת התראה לנגר ולמנהל
      const notification = new Notification({
        user: order.assignedCarpenter._id,
        message: msg,
        type: "DELAY_ALERT"
      });
      await notification.save();
      alerts.push({ orderId: order._id, msg });
    }
  }
  return alerts;
};

export {
  getCarpenterOrders,
  startWork,
  completeOrder,
  characterizeProduct,
  checkDeadlines
};