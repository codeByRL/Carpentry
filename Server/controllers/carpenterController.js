import Order from "../models/Order.js";
import CatalogProduct from "../models/CatalogProduct.js";
import BaseProduct from "../models/BaseProduct.js";
import { nextMaterialCode } from "../utils/materialCode.js";
import User from "../models/User.js";
import { getUserNotifications, markAsRead } from "../services/notificationService.js";
import * as carpenterService from "../services/carpenterService.js";
import { recalculateCarpenterWorkload } from "../services/orderService.js";
import { broadcastOrderUpdated } from "../utils/realtimeEvents.js";
import { getOrderIdsPendingCarpenterStopsInActiveRuns } from "../services/deliveryService.js";

/**
 * קבלת כל ההזמנות הפעילות של הנגר המחובר
 * כולל פרטי התאמה אישית (קוד עץ/בד)
 */
export const getMyOrders = async (req, res) => {
  try {
    const carpenterId = req.user.id;
    
    // מושכים את כל ההזמנות המשויכות לנגר לאורך מחזור החיים — כולל סטטוסים
    // מוקדמים (הוזמנה/במחסן/ליקוט/אספקה) כדי שהנגר ידע מה משויך אליו עוד לפני
    // שהמחסן סיים את הליקוט.
    const orders = await Order.find({
      assignedCarpenter: carpenterId,
      status: {
        $in: [
          "ORDERED",
          "WAITING_FOR_WAREHOUSE",
          "WAITING_FOR_PICKING",
          "WAITING_FOR_SUPPLY",
          "READY_FOR_SHIPPING",
          "IN_PROGRESS",
        ],
      },
    })
    .populate("items.catalogProduct", "name image estimatedWorkTime")
    .sort({ estimatedDeliveryDate: 1 }); // ממוין לפי דחיפות

    const orderIds = orders.map((o) => o._id);
    const pendingCarpenterStopOrderIds = await getOrderIdsPendingCarpenterStopsInActiveRuns(orderIds);

    const carpenterUser = await User.findById(carpenterId).select("fullName address phone");
    const carpenterAddress = carpenterUser?.address?.trim() || "";
    const carpenterPhone = carpenterUser?.phone?.trim() || "";

    // מעבדים את הנתונים כדי שיהיה קל לקליינט להציג
    const formattedOrders = orders.map(order => ({
      orderId: order._id,
      customerName: order.customer.name,
      deliveryAddress: order.customer.deliveryAddress,
      status: order.status,
      orderDate: order.orderDate,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      deliveryClaimedBy: order.deliveryClaimedBy || null,
      driverMarkedDeliveredToCarpenterAt: order.driverMarkedDeliveredToCarpenterAt || null,
      /** יש עצירת מוביל לנגר במסלול פעיל שעדיין לא הושלמה (מקור אמת מול שדות ההזמנה) */
      inActiveDeliveryRunToCarpenter: pendingCarpenterStopOrderIds.has(String(order._id)),
      receivedByCarpenter: order.receivedByCarpenter,
      carpenterPaused: order.carpenterPaused,
      carpenterPauseReason: order.carpenterPauseReason,
      carpenterCompletedAt: order.carpenterCompletedAt,
      carpenterAddress,
      carpenterPhone,
      items: order.items.map(item => ({
        productName: item.catalogProduct.name,
        productImage:
          item.catalogProduct?.image ||
          item.productSnapshot?.image ||
          item.productSnapshot?.imageUrl ||
          null,
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

/** פרופיל הנגר המחובר — לתוויות משלוח ועדכון מקומי אחרי עריכת עובד */
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("fullName address phone email");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      id: user._id,
      fullName: user.fullName,
      address: user.address?.trim() || "",
      phone: user.phone?.trim() || "",
      email: user.email,
    });
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

    if (!order.driverMarkedDeliveredToCarpenterAt) {
      return res.status(400).json({
        message: "עוד לא הגיע אליך בפועל",
      });
    }

    order.receivedByCarpenter = true;
    order.status = "IN_PROGRESS";
    order.driverMarkedDeliveredToCarpenterAt = null;
    // משחררים את התפיסה של המוביל לרגל מחסן→נגר — סיים את תפקידו.
    // כך כשהנגר יסיים את העבודה וההזמנה תחזור ל-READY_FOR_SHIPPING, היא תיכנס
    // מיד לבריכה כרגל נגר→לקוח בלי תפיסה ישנה שחוסמת.
    order.deliveryClaimedBy = null;
    order.deliveryClaimedAt = null;
    await order.save();

    await recalculateCarpenterWorkload(order.assignedCarpenter);

    broadcastOrderUpdated({ orderId: String(orderId), kind: "carpenter_received" });
    res.json({ message: "Order marked as received", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * נגר מסמן הזמנה כהושלמה.
 * Idempotent: לחיצה חוזרת לא תפחית עומס פעם נוספת.
 */
export const markDone = async (req, res) => {
  try {
    const { orderId } = req.params;

    const existing = await Order.findById(orderId);
    if (!existing) return res.status(404).json({ message: "ההזמנה לא נמצאה" });

    if (!existing.assignedCarpenter || existing.assignedCarpenter.toString() !== req.user.id) {
      return res.status(403).json({ message: "ההזמנה אינה משויכת אליך" });
    }

    if (existing.carpenterCompletedAt) {
      await recalculateCarpenterWorkload(existing.assignedCarpenter);
      return res.json({
        message: "העבודה כבר סומנה כהושלמה",
        order: existing,
        alreadyCompleted: true,
      });
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        assignedCarpenter: req.user.id,
        $or: [{ carpenterCompletedAt: { $exists: false } }, { carpenterCompletedAt: null }],
      },
      {
        $set: {
          status: "READY_FOR_SHIPPING",
          carpenterCompletedAt: new Date(),
          carpenterPaused: false,
          carpenterPauseReason: "",
          deliveryClaimedBy: null,
          deliveryClaimedAt: null,
        },
      },
      { new: true }
    );

    if (!order) {
      return res.status(409).json({ message: "לא ניתן לסמן סיום — ההזמנה כבר עודכנה" });
    }

    await recalculateCarpenterWorkload(order.assignedCarpenter);

    broadcastOrderUpdated({ orderId: String(orderId), kind: "carpenter_completed" });
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
      needsFabricSelection,
      fabricQuantityPerUnit,
      needsFormicaSelection,
      formicaQuantityPerUnit,
      needsHandleSelection,
      handleQuantityPerUnit,
    } = req.body;

    const product = await CatalogProduct.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (product.assignedCarpenter.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not assigned to you" });
    }

    const workHours = Number(estimatedWorkTime);
    if (!Number.isFinite(workHours) || workHours <= 0) {
      return res.status(400).json({
        message: "יש להזין זמן עבודה משוער (לפחות חצי שבוע)",
      });
    }
    if (!Array.isArray(baseProducts) || baseProducts.length === 0) {
      return res.status(400).json({ message: "יש להוסיף לפחות חומר גלם אחד" });
    }

    product.baseProducts = baseProducts;
    product.estimatedWorkTime = workHours;

    // אפשרויות עץ לא מנוהלות יותר בטופס האפיון
    product.woodOptions = [];
    product.needsWoodSelection = false;

    // ⬇️ הנגר מחליט אם נדרשת בחירת בד וכמה בד נדרש ליחידה.
    const fabricToggle = needsFabricSelection === true || needsFabricSelection === "true";
    product.needsFabricSelection = fabricToggle;
    if (fabricToggle) {
      const qty = Number(fabricQuantityPerUnit);
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({
          message: "כשנדרשת בחירת בד יש להזין כמות בד נדרשת ליחידה (גדולה מ־0)",
        });
      }
      product.fabricQuantityPerUnit = qty;
    } else {
      product.fabricQuantityPerUnit = 0;
    }

    product.needsFormicaSelection =
      needsFormicaSelection === true || needsFormicaSelection === "true";
    if (product.needsFormicaSelection) {
      const formicaQty = Number(formicaQuantityPerUnit);
      if (!Number.isFinite(formicaQty) || formicaQty <= 0) {
        return res.status(400).json({
          message: "כשנדרשת בחירת פורמייקה יש להזין כמות פורמייקה נדרשת ליחידה (גדולה מ־0)",
        });
      }
      product.formicaQuantityPerUnit = formicaQty;
    } else {
      product.formicaQuantityPerUnit = 0;
    }

    product.needsHandleSelection =
      needsHandleSelection === true || needsHandleSelection === "true";
    if (product.needsHandleSelection) {
      const handleQty = Number(handleQuantityPerUnit);
      if (!Number.isFinite(handleQty) || handleQty <= 0) {
        return res.status(400).json({
          message: "כשנדרשת בחירת ידית יש להזין כמות ידיות נדרשת ליחידה (גדולה מ־0)",
        });
      }
      product.handleQuantityPerUnit = handleQty;
    } else {
      product.handleQuantityPerUnit = 0;
    }

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

    const code = await nextMaterialCode("MAT");

    const product = await BaseProduct.create({
      name: name.trim(),
      code,
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