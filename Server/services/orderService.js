// services/orderService.js
import mongoose from "mongoose";
import Order from "../models/Order.js";
import CatalogProduct from "../models/CatalogProduct.js";
import BaseProduct from "../models/BaseProduct.js";
import FormicaModel from "../models/FormicaModel.js";
import User from "../models/User.js";
import { checkMaterialsAvailability } from "./warehouseService.js";

/**
 * בדיקת תקפות של רשומת בד עבור הזמנה.
 * חייבת להתאים לשאילתת הליסט ב־baseProductController.listMaterials כדי שכל בד
 * שמופיע בטופס לסוכן יתקבל גם בולידציה של ההזמנה (כולל בדים היסטוריים בלי materialType).
 */
const isValidFabricMaterial = (mat) => {
  if (!mat) return false;
  const isMat = mat.isMaterial === true || mat.isMaterial === "true";
  const mtype = mat.materialType;
  const altType = mat.type;
  if (mtype === "fabric" || altType === "fabric") return true;
  if (isMat && (mtype == null || mtype === "")) {
    if (mat.code && /^FAB-/i.test(String(mat.code))) return true;
    if (mat.image && String(mat.image).trim() !== "") return true;
    if (mat.name && /ריפוד/.test(String(mat.name))) return true;
  }
  return false;
};

const isValidHandleMaterial = (mat) => {
  if (!mat) return false;
  const mtype = mat.materialType;
  const altType = mat.type;
  if (mtype === "handle" || altType === "handle") return true;
  if (mat.code && /^HND-/i.test(String(mat.code))) return true;
  return false;
};

const isValidFormicaMaterial = (mat) => {
  if (!mat) return false;
  if (mat.materialType === "formica") return true;
  if (mat.code && /^FOR-/i.test(String(mat.code))) return true;
  return false;
};

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

      // מקור אמת יחיד: דגל המוצר. הוסר fallback לפי שם ("מיטה"), כדי שמנהל/נגר יחליטו
      // במפורש לאיזה מוצר נדרשת בחירת בד (כולל ספות וכסאות מרופדים).
      const requiresFabricSelection = product.needsFabricSelection === true;
      const requiresFormicaSelection = product.needsFormicaSelection === true;
      const requiresHandleSelection = product.needsHandleSelection === true;

      if (requiresFabricSelection && !item.selectedFabric) {
        throw new Error(`חובה לבחור בד עבור "${product.name}"`);
      }
      if (requiresFormicaSelection && !item.selectedFormica) {
        throw new Error(`חובה לבחור פורמייקה עבור "${product.name}"`);
      }
      if (requiresHandleSelection && !item.selectedHandle) {
        throw new Error(`חובה לבחור ידית עבור "${product.name}"`);
      }

      let chosenFabricSnapshot = null;
      if (requiresFabricSelection && item.selectedFabric) {
        const fabSel = item.selectedFabric;
        let mat2 = null;
        const mat2Id = typeof fabSel === 'string' ? fabSel : (fabSel.materialId || fabSel._id);
        if (mat2Id) {
          mat2 = await BaseProduct.findById(mat2Id);
        } else if (fabSel.code) {
          // מחפש לפי קוד גם בדים היסטוריים (materialType עשוי להיות null עבור רשומות ישנות).
          mat2 = await BaseProduct.findOne({
            code: fabSel.code,
            $or: [
              { materialType: 'fabric' },
              { type: 'fabric' },
              { isMaterial: { $in: [true, 'true'] }, materialType: { $in: [null, ''] }, code: /^FAB-/i },
            ],
          });
        }
        if (!isValidFabricMaterial(mat2)) {
          throw new Error(`אפשרות בד לא חוקית עבור "${product.name}"`);
        }

        // נירמול שקט של רשומות ישנות כדי שלא ימשיכו להפיל ולידציות עתידיות.
        let needsNormalization = false;
        if (mat2.materialType !== 'fabric') {
          mat2.materialType = 'fabric';
          needsNormalization = true;
        }
        if (mat2.isMaterial !== true) {
          mat2.isMaterial = true;
          needsNormalization = true;
        }
        if (needsNormalization) {
          try { await mat2.save(); } catch (_) { /* לא חוסם הזמנה אם נירמול נכשל */ }
        }

        chosenFabricSnapshot = { materialId: mat2._id, code: mat2.code, name: mat2.name, priceDelta: mat2.priceDelta || 0 };
        const key2 = mat2._id.toString();
        const fabricPerUnit = Number(product.fabricQuantityPerUnit || 0) > 0
          ? Number(product.fabricQuantityPerUnit)
          : 1; // ברירת מחדל למוצרים ישנים שעדיין לא הוגדרה להם כמות
        const neededQty2 = fabricPerUnit * quantity;
        requiredMaterialsMap.set(key2, (requiredMaterialsMap.get(key2) || 0) + neededQty2);
      }

      let chosenFormicaSnapshot = null;
      if (requiresFormicaSelection && item.selectedFormica) {
        const formicaSel = item.selectedFormica;
        const formicaId = typeof formicaSel === "string" ? formicaSel : (formicaSel.formicaId || formicaSel._id);
        const formica = formicaId ? await FormicaModel.findById(formicaId) : null;
        if (!formica) {
          throw new Error(`אפשרות פורמייקה לא חוקית עבור "${product.name}"`);
        }
        chosenFormicaSnapshot = {
          formicaId: formica._id,
          code: formica.code,
          name: formica.name,
          image: formica.image,
          priceDelta: formica.priceDelta || 0,
        };

        let formicaStockId = formica.baseProductId;
        if (!formicaStockId && formica.code) {
          const linked = await BaseProduct.findOne({
            code: formica.code,
            $or: [{ materialType: "formica" }, { code: /^FOR-/i }],
          });
          formicaStockId = linked?._id;
        }
        if (formicaStockId) {
          const keyF = formicaStockId.toString();
          const formicaPerUnit = Number(product.formicaQuantityPerUnit || 0) > 0
            ? Number(product.formicaQuantityPerUnit)
            : 1;
          const neededFormicaQty = formicaPerUnit * quantity;
          requiredMaterialsMap.set(keyF, (requiredMaterialsMap.get(keyF) || 0) + neededFormicaQty);
        }
      }

      let chosenHandleSnapshot = null;
      if (requiresHandleSelection && item.selectedHandle) {
        const handleSel = item.selectedHandle;
        const handleId = typeof handleSel === "string" ? handleSel : (handleSel.materialId || handleSel._id);
        const handleMat = handleId ? await BaseProduct.findById(handleId) : null;
        if (!isValidHandleMaterial(handleMat)) {
          throw new Error(`אפשרות ידית לא חוקית עבור "${product.name}"`);
        }
        chosenHandleSnapshot = {
          materialId: handleMat._id,
          code: handleMat.code,
          name: handleMat.name,
          priceDelta: handleMat.priceDelta || 0,
        };
        const keyH = handleMat._id.toString();
        const handlePerUnit = Number(product.handleQuantityPerUnit || 0) > 0
          ? Number(product.handleQuantityPerUnit)
          : 1;
        const neededHandleQty = handlePerUnit * quantity;
        requiredMaterialsMap.set(keyH, (requiredMaterialsMap.get(keyH) || 0) + neededHandleQty);
      }

      // חישוב מחיר פריט (יחידה)
      const unitPrice = Number(product.price || 0)
        + (chosenFabricSnapshot?.priceDelta || 0)
        + (chosenFormicaSnapshot?.priceDelta || 0)
        + (chosenHandleSnapshot?.priceDelta || 0);
      totalBasePrice += unitPrice * quantity;

      // הוספת baseProducts הקבועים שמופיעים במוצר
      if (Array.isArray(product.baseProducts)) {
        for (const bp of product.baseProducts) {
          const bpId = bp.product?._id?.toString();
          if (!bpId) continue;
          // אם למוצר יש בחירת בד, לא מוסיפים בד ריפוד קבוע מהאפיון לליקוט.
          // הבד לליקוט חייב להגיע רק מבחירת הלקוח (selectedFabric).
          // משתמשים בזיהוי המרחיב של isValidFabricMaterial כדי לתפוס גם רשומות בד
          // היסטוריות שאין להן עדיין materialType="fabric" (למשל ריפוד ישן בקוד YUT-/ICT-).
          if (requiresFabricSelection && isValidFabricMaterial(bp.product)) {
            continue;
          }
          if (requiresFormicaSelection && isValidFormicaMaterial(bp.product)) {
            continue;
          }
          if (requiresHandleSelection && isValidHandleMaterial(bp.product)) {
            continue;
          }
          const needed = (bp.quantity || 0) * quantity;
          requiredMaterialsMap.set(bpId, (requiredMaterialsMap.get(bpId) || 0) + needed);
        }
      }

      itemsWithPrices.push({
        catalogProduct: product._id,
        quantity,
        selectedCustomization: {
          fabric: chosenFabricSnapshot
            ? { materialId: chosenFabricSnapshot.materialId, code: chosenFabricSnapshot.code, description: chosenFabricSnapshot.name }
            : undefined,
          formica: chosenFormicaSnapshot
            ? {
              formicaId: chosenFormicaSnapshot.formicaId,
              code: chosenFormicaSnapshot.code,
              name: chosenFormicaSnapshot.name,
              image: chosenFormicaSnapshot.image,
              priceDelta: chosenFormicaSnapshot.priceDelta,
            }
            : undefined,
          handle: chosenHandleSnapshot
            ? { materialId: chosenHandleSnapshot.materialId, code: chosenHandleSnapshot.code, description: chosenHandleSnapshot.name }
            : undefined,
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
/**
 * סטטוסים שבהם עדיין מותר לשייך / להחליף נגר.
 * נחסום רק ברגע שהעבודה כבר במחסן/מסירה/אצל הנגר עצמו.
 */
const ASSIGNABLE_STATUSES = new Set([
  "ORDERED",
  "WAITING_FOR_WAREHOUSE",
  "WAITING_FOR_PICKING",
  "WAITING_FOR_SUPPLY",
]);

const STATUS_LABELS = {
  QUOTATION_PENDING: "הצעת מחיר",
  ORDERED: "הוזמנה",
  WAITING_FOR_WAREHOUSE: "ממתין למחסן",
  WAITING_FOR_PICKING: "ממתין לליקוט",
  WAITING_FOR_SUPPLY: "ממתין לאספקה",
  READY_FOR_SHIPPING: "מוכן למשלוח",
  IN_PROGRESS: "בעבודה",
  DONE: "הושלם",
};

export const assignCarpenterToOrder = async (orderId, carpenterId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("ההזמנה לא נמצאה");
    if (!ASSIGNABLE_STATUSES.has(order.status)) {
      const label = STATUS_LABELS[order.status] || order.status;
      if (order.status === "QUOTATION_PENDING") {
        throw new Error(
          'ההזמנה היא הצעת מחיר. יש להמיר אותה להזמנה ("בצע הזמנה") לפני שיוך נגר.'
        );
      }
      throw new Error(`לא ניתן לשייך נגר — ההזמנה כבר בסטטוס "${label}".`);
    }
    if (order.receivedByCarpenter) {
      throw new Error("הנגר כבר קיבל את ההזמנה ולא ניתן לשייך מחדש");
    }

    const newCarpenter = await User.findById(carpenterId);
    if (!newCarpenter || newCarpenter.role !== "CARPENTER") {
      throw new Error("נגר לא תקין");
    }

    // חישוב שעות עבודה
    let totalWorkHours = 0;
    for (const item of order.items) {
      const product = await CatalogProduct.findById(item.catalogProduct);
      if (product) totalWorkHours += (product.estimatedWorkTime || 0) * item.quantity;
    }

    // אם זו הקצאה מחדש (כבר היה נגר משויך) — נחסר ממנו את העומס לפני שנוסיף לחדש
    const previousCarpenterId = order.assignedCarpenter;
    if (previousCarpenterId && String(previousCarpenterId) !== String(carpenterId)) {
      await User.findByIdAndUpdate(previousCarpenterId, [
        {
          $set: {
            currentWorkloadHours: {
              $max: [0, { $subtract: ["$currentWorkloadHours", totalWorkHours] }],
            },
            activeOrdersCount: {
              $max: [0, { $subtract: ["$activeOrdersCount", 1] }],
            },
          },
        },
      ]);
    }

    const estimatedDeliveryDate = calculateEstimatedDeliveryDate(
      (newCarpenter.currentWorkloadHours || 0) + totalWorkHours
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

    // לעדכן את העומס של הנגר רק אם זו הקצאה חדשה (לא אותו נגר שכבר היה משויך)
    if (!previousCarpenterId || String(previousCarpenterId) !== String(carpenterId)) {
      await User.findByIdAndUpdate(carpenterId, {
        $inc: { currentWorkloadHours: totalWorkHours, activeOrdersCount: 1 },
      });
    }

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
    .populate("requiredMaterials.product", "name code unit isNew shelfLocation supplier description")
    .populate("availableMaterials.product", "name code unit isNew shelfLocation supplier description")
    .populate("unavailableMaterials.product", "name code unit isNew shelfLocation supplier description")
    .sort({ orderDate: -1 });

  return orders;
};