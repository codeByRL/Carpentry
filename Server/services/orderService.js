// services/orderService.js
import mongoose from "mongoose";
import Order from "../models/Order.js";
import CatalogProduct from "../models/CatalogProduct.js";
import BaseProduct from "../models/BaseProduct.js";
import User from "../models/User.js";
import { checkMaterialsAvailability } from "./warehouseService.js";

/**
 * חישוב תאריך אספקה משוער
 */
export const calculateEstimatedDeliveryDate = (workloadHours) => {
  const workDaysNeeded = Math.ceil(workloadHours / 8);
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + workDaysNeeded + 3);
  return deliveryDate;
};

/**
 * Create order with material validation, snapshot and reservation
 *
 * orderData expected shape:
 * {
 *   customer: { name, phone1, phone2, deliveryAddress, invoiceName },
 *   items: [
 *     {
 *       catalogProductId, // או catalogProduct
 *       productType, // סוג מוצר שנבחר בטופס (לצורך התאמות אופציונליות)
 *       quantity,
 *       selectedFabric, // optional
 *       notes
 *     },
 *     ...
 *   ],
 *   shipping (optional)
 * }
 */
export const createOrder = async (orderData) => {
  try {
    if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      throw new Error("אין פריטים להזמנה");
    }

    const itemsWithPrices = [];
    let totalBasePrice = 0;
    const requiredMaterialsMap = new Map(); // Map<baseProductId (string) => aggregatedQuantity>

    // 1) ולידציה ובניית פרטי הפריטים
    for (const item of orderData.items) {
      const productId = item.catalogProductId || item.catalogProduct || item.productId || item.product;
      if (!productId) throw new Error("פריט חסר מזהה מוצר");

      const product = await CatalogProduct.findById(productId).populate("baseProducts.product");
      if (!product || product.status !== "ACTIVE") {
        throw new Error(`Product ${productId} not available`);
      }

      const quantity = Number(item.quantity || 1);
      if (quantity <= 0) throw new Error("Quantity must be >= 1");

      let chosenFabricSnapshot = null;
      const supportsUpholstery = ["מיטה", "כסא"].includes(String(item.productType || "").trim());
      if (supportsUpholstery && product.needsFabricSelection && item.selectedFabric) {
        const fabSel = item.selectedFabric;
        let mat2 = null;
        const mat2Id = typeof fabSel === 'string' ? fabSel : (fabSel.materialId || fabSel._id);
        if (mat2Id) {
          mat2 = await BaseProduct.findById(mat2Id);
        } else if (fabSel.code) {
          mat2 = await BaseProduct.findOne({ isMaterial: true, materialType: 'fabric', code: fabSel.code });
        }
        if (!mat2 || !mat2.isMaterial || mat2.materialType !== 'fabric') {
          throw new Error(`אפשרות בד לא חוקית עבור "${product.name}"`);
        }
        chosenFabricSnapshot = { materialId: mat2._id, code: mat2.code, name: mat2.name, priceDelta: mat2.priceDelta || 0 };
        const key2 = mat2._id.toString();
        const neededQty2 = 1 * quantity;
        requiredMaterialsMap.set(key2, (requiredMaterialsMap.get(key2) || 0) + neededQty2);
      }

      // חישוב מחיר פריט (יחידה)
      const unitPrice = Number(product.price || 0) + (chosenFabricSnapshot?.priceDelta || 0);
      totalBasePrice += unitPrice * quantity;

      // הוספת baseProducts הקבועים שמופיעים במוצר
      if (Array.isArray(product.baseProducts)) {
        for (const bp of product.baseProducts) {
          const bpId = bp.product?._id?.toString();
          if (!bpId) continue;
          const needed = (bp.quantity || 0) * quantity;
          requiredMaterialsMap.set(bpId, (requiredMaterialsMap.get(bpId) || 0) + needed);
        }
      }

      itemsWithPrices.push({
        catalogProduct: product._id,
        quantity,
        selectedCustomization: {
          fabric: chosenFabricSnapshot ? { code: chosenFabricSnapshot.code, description: chosenFabricSnapshot.name } : undefined,
          notes: item.notes || ''
        },
        itemPrice: unitPrice
      });
    }

    // 2) אח"כ: בניית מערך requiredMaterials מתוך ה־Map
    const requiredMaterials = [];
    for (const [bpId, qty] of requiredMaterialsMap.entries()) {
      requiredMaterials.push({
        product: bpId,
        quantity: qty,
        isPicked: false
      });
    }

    // 3) יצירת המסמך והעדכון של reservedQuantity לכל חומר נדרש (באותו session)
    const total = totalBasePrice + (orderData.shipping || 0);
    const priceWithVAT = Math.round(total * 1.18 * 100) / 100; // עיגול לשתי ספרות

    const orderDoc = new Order({
      customer: orderData.customer,
      items: itemsWithPrices,
      requiredMaterials,
      totalPrice: totalBasePrice,
      priceWithVAT,
      orderDate: orderData.orderDate ? new Date(orderData.orderDate) : new Date(),
      estimatedDeliveryDate: orderData.estimatedDeliveryDate ? new Date(orderData.estimatedDeliveryDate) : undefined,
      status: orderData.status || "ORDERED"
    });

    // עדכון reservedQuantity עבור כל חומר נדרש
    // משריינים רק מהזמין בפועל כדי לא לרדת לזמינות שלילית.
    for (const mat of requiredMaterials) {
      const baseProduct = await BaseProduct.findById(mat.product);
      if (!baseProduct) {
        throw new Error(`Base product ${mat.product} not found`);
      }
      const currentQty = Math.max(Number(baseProduct.quantity || 0), 0);
      const currentReserved = Math.max(Number(baseProduct.reservedQuantity || 0), 0);
      const availableToReserve = Math.max(currentQty - currentReserved, 0);
      const reserveNow = Math.min(Number(mat.quantity || 0), availableToReserve);
      baseProduct.reservedQuantity = currentReserved + reserveNow;
      await baseProduct.save();
    }

    await orderDoc.save();
    return orderDoc;
  } catch (error) {
    throw error;
  }
};

/**
 * שיוך נגר להזמנה על ידי המנהל
 * (מיזגתי את הגרסה הקיימת שלך לשימוש באותו שירות)
 */
export const assignCarpenterToOrder = async (orderId, carpenterId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "ORDERED") throw new Error("Order already processed");

    const carpenter = await User.findById(carpenterId);
    if (!carpenter || carpenter.role !== "CARPENTER") throw new Error("Invalid carpenter");

    // חישוב שעות עבודה
    let totalWorkHours = 0;
    for (const item of order.items) {
      const product = await CatalogProduct.findById(item.catalogProduct);
      if (product) totalWorkHours += (product.estimatedWorkTime || 0) * item.quantity;
    }

    const estimatedDeliveryDate = calculateEstimatedDeliveryDate(
      (carpenter.currentWorkloadHours || 0) + totalWorkHours
    );

    order.assignedCarpenter = carpenterId;
    order.estimatedDeliveryDate = estimatedDeliveryDate;
    await order.save();

    const classified = await Order.findById(orderId).populate("requiredMaterials.product");
    const { availableItems, unavailableItems } = await checkMaterialsAvailability(
      classified.requiredMaterials
    );
    classified.availableMaterials = availableItems;
    classified.unavailableMaterials = unavailableItems;
    classified.status =
      unavailableItems.length > 0 ? "WAITING_FOR_SUPPLY" : "WAITING_FOR_PICKING";
    await classified.save();

    await User.findByIdAndUpdate(
      carpenterId,
      { $inc: { currentWorkloadHours: totalWorkHours, activeOrdersCount: 1 } }
    );

    return classified;
  } catch (error) {
    throw error;
  }
};

/**
 * איתור הנגר הפנוי ביותר (עומס עבודה נמוך ביותר)
 */
export const findBestAvailableCarpenter = async () => {
  const carpenter = await User.findOne({ role: "CARPENTER" })
    .sort({ currentWorkloadHours: 1, activeOrdersCount: 1, createdAt: 1 });

  if (!carpenter) {
    throw new Error("No carpenters available");
  }
  return carpenter;
};

/**
 * שיוך אוטומטי לנגר הפנוי ביותר
 */
export const assignBestCarpenterToOrder = async (orderId) => {
  const bestCarpenter = await findBestAvailableCarpenter();
  const order = await assignCarpenterToOrder(orderId, bestCarpenter._id);
  return { order, carpenter: bestCarpenter };
};

/**
 * קבלת הזמנה לפי ID
 */
export const getOrderById = async (orderId) => {
  const order = await Order.findById(orderId)
    .populate("items.catalogProduct")
    .populate("assignedCarpenter", "fullName email address phone")
    .populate("requiredMaterials.product");

  if (!order) throw new Error("Order not found");
  return order;
};

/**
 * קבלת כל ההזמנות עם פילטרים
 */
export const getAllOrders = async (filters = {}) => {
  const orders = await Order.find(filters)
    .populate("items.catalogProduct", "name")
    .populate("assignedCarpenter", "fullName address phone")
    .populate("requiredMaterials.product", "name code unit")
    .populate("availableMaterials.product", "name code unit")
    .populate("unavailableMaterials.product", "name code unit")
    .sort({ orderDate: -1 });

  return orders;
};