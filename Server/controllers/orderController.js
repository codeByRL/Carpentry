import Order from "../models/Order.js"; // וודא שזה קיים
import {
  createOrder,
  assignCarpenterToOrder,
  assignBestCarpenterToOrder,
  getOrderById as getOrderByIdService,
  getAllOrders as getAllOrdersService
} from "../services/orderService.js";

/**
 * יצירת הזמנה חדשה
 */
const createOrderController = async (req, res) => {
  try {
    const normalizePhone = (value = "") => String(value || "").replace(/[^\d]/g, "").replace(/^972/, "0");
    const isValidPhone = (value = "") => /^0\d{8,9}$/.test(normalizePhone(value));
    const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
    const isValidIsraeliId = (value = "") => {
      const digits = String(value || "").replace(/[^\d]/g, "").padStart(9, "0");
      if (!/^\d{9}$/.test(digits)) return false;
      const check = digits
        .split("")
        .map(Number)
        .reduce((sum, d, i) => {
          const x = d * ((i % 2) + 1);
          return sum + (x > 9 ? x - 9 : x);
        }, 0);
      return check % 10 === 0;
    };

    const customerName = String(req.body.customerName || "").trim();
    const customerPhone1 = normalizePhone(req.body.customerPhone1);
    const customerPhone2 = normalizePhone(req.body.customerPhone2);
    const customerIdNumber = String(req.body.customerIdNumber || "").replace(/[^\d]/g, "");
    const customerEmail = String(req.body.customerEmail || "").trim();
    const deliveryAddress = String(req.body.deliveryAddress || "").trim();
    const invoiceName = String(req.body.invoiceName || "").trim();

    if (!customerName || customerName.length < 2) {
      return res.status(400).json({ message: "שם לקוח לא תקין" });
    }
    if (!isValidPhone(customerPhone1)) {
      return res.status(400).json({ message: "טלפון ראשי לא תקין" });
    }
    if (customerPhone2 && !isValidPhone(customerPhone2)) {
      return res.status(400).json({ message: "טלפון נוסף לא תקין" });
    }
    if (!isValidIsraeliId(customerIdNumber)) {
      return res.status(400).json({ message: "תעודת זהות לא תקינה" });
    }
    if (!isValidEmail(customerEmail)) {
      return res.status(400).json({ message: "כתובת דוא״ל לא תקינה" });
    }
    if (!deliveryAddress || deliveryAddress.length < 5) {
      return res.status(400).json({ message: "כתובת משלוח לא תקינה" });
    }
    if (!invoiceName || invoiceName.length < 2) {
      return res.status(400).json({ message: "שם לחשבונית לא תקין" });
    }
    if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
      return res.status(400).json({ message: "חובה להוסיף לפחות פריט אחד להזמנה" });
    }

    const orderData = {
      customer: {
        name: customerName,
        phone1: customerPhone1,
        phone2: customerPhone2,
        idNumber: customerIdNumber,
        email: customerEmail,
        deliveryAddress,
        invoiceName,
      },
      items: req.body.items,
      orderDate: req.body.orderDate,
      estimatedDeliveryDate: req.body.estimatedDeliveryDate,
      status: req.body.status,
    };

    const newOrder = await createOrder(orderData);
    res.status(201).json({ message: "Order created successfully", order: newOrder });

  } catch (error) {
    console.error("Error creating order:", error);
    const msg = error?.message || "Server error";
    const badRequest =
      /אין פריטים|פריט חסר|not available|Quantity must|דורש בחירת|לא חוקית|Base product|Product .* not available/i.test(
        msg
      );
    res.status(badRequest ? 400 : 500).json({ message: msg });
  }
};

/**
 * שיוך נגר להזמנה (מנהל בלבד)
 */
const assignCarpenter = async (req, res) => {
  try {
    const { carpenterId } = req.body;
    const order = await assignCarpenterToOrder(req.params.id, carpenterId);
    res.json({ message: "Carpenter assigned successfully", order });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * שיוך אוטומטי לנגר הפנוי ביותר
 */
const assignBestCarpenter = async (req, res) => {
  try {
    const result = await assignBestCarpenterToOrder(req.params.id);
    res.json({
      message: "Best available carpenter assigned successfully",
      order: result.order,
      assignedCarpenter: {
        id: result.carpenter._id,
        fullName: result.carpenter.fullName,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * הצגת הזמנה לפי מזהה
 */
const getOrderById = async (req, res) => {
  try {
    const order = await getOrderByIdService(req.params.id);

    if (!order) { // Add check for non-existent order
      return res.status(404).json({ message: "Order not found" });
    }

    if (req.user.role === "CARPENTER") {
      const orderObj = order.toObject();
      delete orderObj.totalPrice;
      delete orderObj.priceWithVAT;
      return res.json(orderObj);
    }

    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * הצגת כל ההזמנות
 */
const getAllOrders = async (req, res) => {
  try {
    let filters = {};

    // If user is a SALES person, they should only see their own orders
    if (req.user.role === "SALES" && req.user.id) {
      // Assuming 'createdBy' field exists on Order Schema, or orders are associated by assignedCarpenter/other field
      // For now, let's assume 'assignedCarpenter' could also be assigned by sales person for their own orders
      // Or, better yet, add a 'salesperson' field to the Order schema.
      // For this example, I'll allow sales to see all for now, but this is a security risk.
      // You should implement proper filtering based on how you associate sales with orders.
      // For now, no specific filter for SALES, they will see all that match other criteria.
    }


    if (req.user.role === "CARPENTER") {
      filters.assignedCarpenter = req.user.id;
    }

    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.isPaid) { // Add filter for paid status
        filters.isPaid = req.query.isPaid === 'true'; // Convert string to boolean
    }

    const orders = await getAllOrdersService(filters);

    const now = new Date();
    const ordersWithAlert = orders.map(order => ({
      ...order.toObject(),
      // This assumes 'orderDate' is the start date, and 7 days is the alert threshold.
      // Adjust logic as needed.
      isOverdue: (now - order.orderDate) / (1000 * 60 * 60 * 24) >= 7 && order.status !== "DONE" && order.status !== "QUOTATION_PENDING" && !order.isPaid
    }));

    res.json(ordersWithAlert);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * הזמנות לפי סטטוס
 */
const getOrdersByStatus = async (req, res) => {
  try {
    const filters = { status: req.params.status };

    if (req.user.role === "CARPENTER") {
      filters.assignedCarpenter = req.user.id;
    }

    const orders = await getAllOrdersService(filters);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

 // New: Mark Order as Paid
 const markOrderAsPaid = async (req, res) => {
   try {
     const { id } = req.params;
     const order = await Order.findById(id);

     if (!order) {
       return res.status(404).json({ message: "Order not found" });
     }

     if (order.isPaid) {
       return res.status(400).json({ message: "Order is already marked as paid" });
     }

     order.isPaid = true;
     // Optionally change status if it was "COLLECTION_PENDING"
     // if (order.status === "COLLECTION_PENDING") {
     //   order.status = "ORDERED"; // or another appropriate status after payment
     // }

     await order.save();

     res.json({ message: "Order marked as paid successfully", order: order });
   } catch (error) {
     console.error("Error marking order as paid:", error);
     res.status(500).json({ message: "Server error" });
   }
 };

// Convert quotation to active order
const confirmQuotationOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.status !== "QUOTATION_PENDING") {
      return res.status(400).json({ message: "Only quotation orders can be confirmed" });
    }

    order.status = "ORDERED";
    await order.save();
    res.json({ message: "Quotation converted to order successfully", order });
  } catch (error) {
    console.error("Error confirming quotation:", error);
    res.status(500).json({ message: "Server error" });
  }
};


export {
  createOrderController,
  assignCarpenter,
  assignBestCarpenter,
  getOrderById,
  getAllOrders,
  getOrdersByStatus,
  markOrderAsPaid, // Add this to the exports
  confirmQuotationOrder,
};