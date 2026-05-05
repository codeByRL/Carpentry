// services/orderService.js
import mongoose from "mongoose";
import Order from "../models/Order.js";
import CatalogProduct from "../models/CatalogProduct.js";
import BaseProduct from "../models/BaseProduct.js";
import User from "../models/User.js";

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
 *       quantity,
 *       selectedWood, // optional, object or id (e.g. { materialId } or materialId string)
 *       selectedFabric, // optional
 *       notes
 *     },
 *     ...
 *   ],
 *   shipping (optional)
 * }
 */
export const createOrder = async (orderData) => {
  const session = await mongoose.startSession();
  session.startTransaction();

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

      const product = await CatalogProduct.findById(productId).populate("baseProducts.product").session(session);
      if (!product || product.status !== "ACTIVE") {
        throw new Error(`Product ${productId} not available`);
      }

      const quantity = Number(item.quantity || 1);
      if (quantity <= 0) throw new Error("Quantity must be >= 1");

      // בדיקות בחירת חומרים אם נדרש
      let chosenWoodSnapshot = null;
      if (product.needsWoodSelection) {
        const woodSel = item.selectedWood;
        if (!woodSel) throw new Error(`מוצר "${product.name}" דורש בחירת עץ`);
        // תמיכה ב־id או באובייקט { materialId }
        let mat = null;
        const matId = typeof woodSel === 'string' ? woodSel : (woodSel.materialId || woodSel._id);
        if (matId) {
          mat = await BaseProduct.findById(matId).session(session);
        } else if (woodSel.code) {
          mat = await BaseProduct.findOne({ isMaterial: true, materialType: 'wood', code: woodSel.code }).session(session);
        }
        if (!mat || !mat.isMaterial || mat.materialType !== 'wood') {
          throw new Error(`אפשרות עץ לא חוקית עבור "${product.name}"`);
        }
        chosenWoodSnapshot = { materialId: mat._id, code: mat.code, name: mat.name, priceDelta: mat.priceDelta || 0 };
        // הוספת לכמות נדרשת
        const key = mat._id.toString();
        const neededQty = 1 * quantity; // הנחה: בחירת חומר מצריכה 1 יח' ממנו; ניתן לשנות לפי מיפוי מדויק
        requiredMaterialsMap.set(key, (requiredMaterialsMap.get(key) || 0) + neededQty);
      }

      let chosenFabricSnapshot = null;
      if (product.needsFabricSelection) {
        const fabSel = item.selectedFabric;
        if (!fabSel) throw new Error(`מוצר "${product.name}" דורש בחירת בד`);
        let mat2 = null;
        const mat2Id = typeof fabSel === 'string' ? fabSel : (fabSel.materialId || fabSel._id);
        if (mat2Id) {
          mat2 = await BaseProduct.findById(mat2Id).session(session);
        } else if (fabSel.code) {
          mat2 = await BaseProduct.findOne({ isMaterial: true, materialType: 'fabric', code: fabSel.code }).session(session);
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
      const unitPrice = Number(product.price || 0) + (chosenWoodSnapshot?.priceDelta || 0) + (chosenFabricSnapshot?.priceDelta || 0);
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
          wood: chosenWoodSnapshot ? { code: chosenWoodSnapshot.code, description: chosenWoodSnapshot.name } : undefined,
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
        baseProduct: bpId,
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
      orderDate: new Date(),
      status: "ORDERED"
    });

    // עדכון reservedQuantity עבור כל חומר נדרש
    for (const mat of requiredMaterials) {
      const baseProduct = await BaseProduct.findById(mat.baseProduct).session(session);
      if (!baseProduct) {
        throw new Error(`Base product ${mat.baseProduct} not found`);
      }
      baseProduct.reservedQuantity = (baseProduct.reservedQuantity || 0) + (mat.quantity || 0);
      await baseProduct.save({ session });
    }

    await orderDoc.save({ session });
    await session.commitTransaction();
    return orderDoc;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * שיוך נגר להזמנה על ידי המנהל
 * (מיזגתי את הגרסה הקיימת שלך לשימוש באותו שירות)
 */
export const assignCarpenterToOrder = async (orderId, carpenterId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error("Order not found");
    if (order.status !== "ORDERED") throw new Error("Order already processed");

    const carpenter = await User.findById(carpenterId).session(session);
    if (!carpenter || carpenter.role !== "CARPENTER") throw new Error("Invalid carpenter");

    // חישוב שעות עבודה
    let totalWorkHours = 0;
    for (const item of order.items) {
      const product = await CatalogProduct.findById(item.catalogProduct).session(session);
      if (product) totalWorkHours += (product.estimatedWorkTime || 0) * item.quantity;
    }

    const estimatedDeliveryDate = calculateEstimatedDeliveryDate(
      (carpenter.currentWorkloadHours || 0) + totalWorkHours
    );

    order.assignedCarpenter = carpenterId;
    order.estimatedDeliveryDate = estimatedDeliveryDate;
    order.status = "WAITING_FOR_WAREHOUSE";
    await order.save({ session });

    await User.findByIdAndUpdate(
      carpenterId,
      { $inc: { currentWorkloadHours: totalWorkHours, activeOrdersCount: 1 } },
      { session }
    );

    await session.commitTransaction();
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
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
    .populate("assignedCarpenter", "fullName email")
    .populate("requiredMaterials.baseProduct");

  if (!order) throw new Error("Order not found");
  return order;
};

/**
 * קבלת כל ההזמנות עם פילטרים
 */
export const getAllOrders = async (filters = {}) => {
  const orders = await Order.find(filters)
    .populate("items.catalogProduct", "name")
    .populate("assignedCarpenter", "fullName")
    .sort({ orderDate: -1 });

  return orders;
};