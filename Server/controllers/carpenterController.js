import Order from "../models/Order.js";
import CatalogProduct from "../models/CatalogProduct.js";
import BaseProduct from "../models/BaseProduct.js";
import User from "../models/User.js";
import { getUserNotifications, markAsRead } from "../services/notificationService.js";
import * as carpenterService from "../services/carpenterService.js";

/**
 * קבלת כל ההזמנות הפעילות של הנגר המחובר
 * כולל פרטי התאמה אישית (קוד עץ/בד)
 */
export const getMyOrders = async (req, res) => {
  try {
    const carpenterId = req.user.id;
    
    // מושכים הזמנות פעילות שמשויכות לנגר
    const orders = await Order.find({ 
      assignedCarpenter: carpenterId,
      status: { $in: ["READY_FOR_SHIPPING", "IN_PROGRESS"] } 
    })
    .populate("items.catalogProduct", "name image estimatedWorkTime")
    .sort({ estimatedDeliveryDate: 1 }); // ממוין לפי דחיפות

    // מעבדים את הנתונים כדי שיהיה קל לקליינט להציג
    const formattedOrders = orders.map(order => ({
      orderId: order._id,
      customerName: order.customer.name,
      deliveryAddress: order.customer.deliveryAddress,
      status: order.status,
      orderDate: order.orderDate,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      receivedByCarpenter: order.receivedByCarpenter,
      carpenterPaused: order.carpenterPaused,
      carpenterPauseReason: order.carpenterPauseReason,
      carpenterCompletedAt: order.carpenterCompletedAt,
      items: order.items.map(item => ({
        productName: item.catalogProduct.name,
        productImage: item.catalogProduct.image,
        quantity: item.quantity,
        estimatedWorkTime: item.catalogProduct.estimatedWorkTime,
        // 🆕 כאן הנגר רואה את הקודים!
        customization: {
          wood: item.selectedCustomization?.wood || null,
          fabric: item.selectedCustomization?.fabric || null,
          notes: item.selectedCustomization?.notes || ""
        }
      }))
    }));

    res.json(formattedOrders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * נגר מסמן שקיבל משלוח (החומרים הגיעו אליו)
 */
export const markReceived = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.assignedCarpenter.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not your order" });
    }

    order.receivedByCarpenter = true;
    order.status = "IN_PROGRESS";
    await order.save();

    res.json({ message: "Order marked as received", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * נגר מסמן הזמנה כהושלמה
 */
export const markDone = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).populate("items.catalogProduct");
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.assignedCarpenter.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not your order" });
    }

    // עבודה הסתיימה אצל הנגר וממתינה להובלה
    order.status = "READY_FOR_SHIPPING";
    order.carpenterCompletedAt = new Date();
    order.carpenterPaused = false;
    order.carpenterPauseReason = "";
    await order.save();

    // עדכון עומס העבודה של הנגר (הפחתת שעות)
    const totalWorkHours = order.items.reduce((sum, item) => {
      return sum + (item.catalogProduct.estimatedWorkTime || 0) * item.quantity;
    }, 0);

    await User.findByIdAndUpdate(order.assignedCarpenter, {
      $inc: { 
        currentWorkloadHours: -totalWorkHours,
        activeOrdersCount: -1 
      }
    });

    res.json({ message: "העבודה הסתיימה וממתינה למוביל", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * נגר משהה עבודה בשל תקלה עם סיבה
 */
export const pauseOrderWork = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "חובה להזין סיבת תקלה" });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.assignedCarpenter?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not your order" });
    }

    order.status = "IN_PROGRESS";
    order.carpenterPaused = true;
    order.carpenterPauseReason = reason.trim();
    order.carpenterPausedAt = new Date();
    await order.save();

    res.json({ message: "העבודה הושהתה", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * נגר מחדש עבודה שהושהתה
 */
export const resumeOrderWork = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.assignedCarpenter?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not your order" });
    }

    order.status = "IN_PROGRESS";
    order.carpenterPaused = false;
    order.carpenterPauseReason = "";
    order.carpenterPausedAt = null;
    await order.save();

    res.json({ message: "העבודה חודשה", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * קבלת התראות
 */
export const getNotifications = async (req, res) => {
  try {
    const notifications = await getUserNotifications(req.user.id);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * סימון התראה כנקראה
 */
export const readNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await markAsRead(notificationId);
    res.json({ message: "Notification marked as read", notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * מוצרים לאפיון (נגר)
 */
export const getProductsForCharacterization = async (req, res) => {
  try {
    const products = await CatalogProduct.find({
      assignedCarpenter: req.user.id,
      status: "PENDING_CHARACTERIZATION"
    });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * נגר מאפיין מוצר חדש (ממלא חומרים, זמן עבודה, ואופציות)
 */
export const submitCharacterization = async (req, res) => {
  try {
    const { productId } = req.params;
    const { 
      baseProducts, 
      estimatedWorkTime,
      woodOptions,        // 🆕 רשימת קודי עץ
      fabricOptions,      // 🆕 רשימת קודי בד
      needsWoodSelection, 
      needsFabricSelection 
    } = req.body;

    const product = await CatalogProduct.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (product.assignedCarpenter.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not assigned to you" });
    }

    product.baseProducts = baseProducts;
    product.estimatedWorkTime = estimatedWorkTime;
    
    // 🆕 שמירת אופציות ההתאמה האישית
    product.woodOptions = woodOptions || [];
    product.fabricOptions = fabricOptions || [];
    product.needsWoodSelection = needsWoodSelection || false;
    product.needsFabricSelection = needsFabricSelection || false;
    
    product.status = "WAITING_ADMIN_APPROVAL";
    
    await product.save();

    res.json({ message: "Product characterized successfully", product });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * קבלת היסטוריית הזמנות שהושלמו
 */
export const getCompletedOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      assignedCarpenter: req.user.id,
      status: "DONE"
    })
    .populate("items.catalogProduct", "name image")
    .sort({ actualFinishDate: -1 });

    // מעבדים גם את ההיסטוריה כדי להציג את ההתאמות האישיות
    const formattedOrders = orders.map(order => ({
      orderId: order._id,
      customerName: order.customer.name,
      completedDate: order.actualFinishDate,
      items: order.items.map(item => ({
        productName: item.catalogProduct.name,
        quantity: item.quantity,
        customization: {
          wood: item.selectedCustomization?.wood || null,
          fabric: item.selectedCustomization?.fabric || null
        }
      }))
    }));

    res.json(formattedOrders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * נגר מוסיף חומר גלם חדש לאספקה ראשונית במחסן
 */
export const createNewBaseProductByCarpenter = async (req, res) => {
  try {
    const { name, unit, supplier = "", description = "" } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "שם חומר גלם הוא שדה חובה" });
    }
    if (!unit || !unit.trim()) {
      return res.status(400).json({ message: "יחידת מידה היא שדה חובה" });
    }

    const exists = await BaseProduct.findOne({ name: name.trim() });
    if (exists) {
      return res.status(409).json({ message: `חומר גלם בשם "${name}" כבר קיים` });
    }

    const product = await BaseProduct.create({
      name: name.trim(),
      unit: unit.trim(),
      supplier: supplier?.trim() || "",
      description: description?.trim() || "",
      quantity: 0,
      reservedQuantity: 0,
      isNew: true,
      isMaterial: false,
      materialType: null,
      priceDelta: 0,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};