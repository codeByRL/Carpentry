import Order from "../models/Order.js";
import BaseProduct from "../models/BaseProduct.js";
import { nextMaterialCode } from "../utils/materialCode.js";
import PurchaseList from "../models/PurchaseList.js";

const checkMaterialsAvailability = async (requiredMaterials) => {
  const availableItems = [];
  const unavailableItems = [];

  for (const material of requiredMaterials) {
    const baseProduct = await BaseProduct.findById(material.product);
    if (!baseProduct) {
      unavailableItems.push(material);
      continue;
    }

    const available = baseProduct.quantity - baseProduct.reservedQuantity;

    if (available >= material.quantity) {
      availableItems.push(material);
    } else {
      unavailableItems.push({
        ...material.toObject(),
        availableQuantity: available,
        neededQuantity: material.quantity - available
      });
    }
  }

  return { allAvailable: unavailableItems.length === 0, availableItems, unavailableItems };
};

const markOrderAsSeen = async (orderId, warehouseUserId) => {
  const order = await Order.findById(orderId).populate("requiredMaterials.product");
  if (!order) throw new Error("Order not found");

  order.seenByWarehouseAt = new Date();
  order.warehouseSeenBy = warehouseUserId;

  const { allAvailable, availableItems, unavailableItems } = await checkMaterialsAvailability(order.requiredMaterials);

  order.availableMaterials = availableItems;
  order.unavailableMaterials = unavailableItems;
  order.status = unavailableItems.length > 0 ? "WAITING_FOR_SUPPLY" : "WAITING_FOR_PICKING";

  await order.save();
  return order;
};

/**
 * ליקוט חומר — בלי multi-document transaction (MongoDB standalone ללא replica set נכשל ב-commitTransaction).
 * לסביבת ייצור עם replica set אפשר לעטוף שוב ב-session אם נדרש אטומיות מלאה.
 */
const pickMaterial = async (orderId, materialId, warehouseUserId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  if (!["WAITING_FOR_PICKING", "WAITING_FOR_SUPPLY"].includes(order.status)) {
    throw new Error("ההזמנה לא במצב לליקוט מחסן");
  }

  const material = order.requiredMaterials.find((m) => {
    const pid = m.product?._id ?? m.product;
    return pid && String(pid) === String(materialId);
  });
  if (!material) throw new Error("Material not found in order");
  if (material.isPicked) throw new Error("Material already picked");

  /** מצב ליקוט אמור בלי רשימת חסרים; שאריות ממסד גורמות לדחיית ליקוט למרות תצוגה תקינה ב-API */
  if (order.status === "WAITING_FOR_PICKING" && (order.unavailableMaterials || []).length > 0) {
    order.unavailableMaterials = [];
    order.markModified("unavailableMaterials");
    await order.save();
  }

  const baseProduct = await BaseProduct.findById(materialId);
  if (!baseProduct) throw new Error("Base product not found");

  /** מלאי פיזי במדף (לא לבדוק רק quantity−reserved — שריון יכול לכסות את כל הכמות לפני הליקוט) */
  const onHand = Number(baseProduct.quantity || 0);
  const need = Number(material.quantity || 0);
  if (need <= 0) throw new Error("כמות לא תקינה לליקוט");

  const mid = String(materialId);
  const stillListedUnavailable = (order.unavailableMaterials || []).some((u) => {
    const uid = u.product?._id ?? u.product;
    return uid && String(uid) === mid;
  });

  if (order.status === "WAITING_FOR_SUPPLY" && stillListedUnavailable) {
    if (onHand < need) {
      throw new Error("חומר עדיין מסומן כחסר במלאי — יש לעדכן הגעת אספקה או מלאי");
    }
    order.unavailableMaterials = (order.unavailableMaterials || []).filter((u) => {
      const uid = u.product?._id ?? u.product;
      return !(uid && String(uid) === mid);
    });
    order.markModified("unavailableMaterials");
    if (order.unavailableMaterials.length === 0) {
      order.status = "WAITING_FOR_PICKING";
    }
    await order.save();
  }

  if (onHand < need) throw new Error("Insufficient stock");

  baseProduct.quantity = onHand - need;
  baseProduct.reservedQuantity = Math.max(
    Number(baseProduct.reservedQuantity || 0) - need,
    0
  );
  await baseProduct.save();

  material.isPicked = true;
  order.markModified("requiredMaterials");
  await order.save();

  const allPicked = order.requiredMaterials.every(m => m.isPicked);
  if (allPicked) {
    order.status = "READY_FOR_SHIPPING";
    order.readyForShippingAt = new Date();
    if (warehouseUserId != null && warehouseUserId !== "") {
      order.warehouseHandledBy = warehouseUserId;
    }
    await order.save();
  }

  return order;
};

const createNewBaseProduct = async (data) => {
  const code = await nextMaterialCode("MAT");
  const product = new BaseProduct({
    name: data.name,
    code,
    unit: data.unit,
    quantity: data.quantity || 0,
    reservedQuantity: 0,
    shelfLocation: data.shelfLocation,
    supplier: data.supplier,
    minStock: data.minStock || 5,
    reorderQuantity: data.reorderQuantity || 20,
    isNew: false
  });

  await product.save();
  return product;
};

const generatePurchaseList = async () => {
  const existing = await PurchaseList.find().lean();
  const preservedByProduct = new Map(
    existing.map((e) => [
      String(e.product),
      { status: e.status, sentAt: e.sentAt, arrivedAt: e.arrivedAt },
    ])
  );

  await PurchaseList.deleteMany({});

  const purchaseMap = {};

  const orders = await Order.find({ status: "WAITING_FOR_SUPPLY" })
    .populate("unavailableMaterials.product");

  for (const order of orders) {
    for (const material of order.unavailableMaterials) {
      // מוצר חדש נשאר בקטגוריית "מוצרים חדשים" עד אישור מחסנאי
      if (material?.product?.isNew) continue;
      const productId = material.product._id.toString();
      const needed = material.neededQuantity || material.quantity;

      if (!purchaseMap[productId]) {
        purchaseMap[productId] = { forOrders: 0, forStock: 0, product: material.product };
      }
      purchaseMap[productId].forOrders += needed;
    }
  }

  const allProducts = await BaseProduct.find();

  for (const product of allProducts) {
    const pendingInitialSupplyQty = Math.max(Number(product.pendingInitialSupplyQty || 0), 0);
    if (pendingInitialSupplyQty > 0) {
      const productId = product._id.toString();
      if (!purchaseMap[productId]) {
        purchaseMap[productId] = { forOrders: 0, forStock: 0, product: product };
      }
      // עדיפות לכמות ההזמנה הראשונית שאושרה ע"י המחסן
      purchaseMap[productId].forStock = Math.max(purchaseMap[productId].forStock, pendingInitialSupplyQty);
      continue;
    }

    // לא להכניס לרכש עד אישור מוצר חדש בטופס המחסן
    if (product.isNew) continue;
    const productId = product._id.toString();
    const currentAvailable = product.quantity - (product.reservedQuantity || 0);

    if (currentAvailable < product.minStock) {
      if (!purchaseMap[productId]) {
        purchaseMap[productId] = { forOrders: 0, forStock: 0, product: product };
      }
      const neededForFullStock = product.reorderQuantity - currentAvailable;
      purchaseMap[productId].forStock = Math.max(0, neededForFullStock);
    }
  }

  const purchaseList = [];
  for (const [productId, data] of Object.entries(purchaseMap)) {
    const totalQuantity = data.forOrders + data.forStock;

    const preserved = preservedByProduct.get(productId);
    const keepSent =
      preserved?.status === "SENT_TO_SUPPLIER" ? preserved : null;

    const item = new PurchaseList({
      product: productId,
      totalQuantityNeeded: totalQuantity,
      forOrders: data.forOrders,
      forStock: data.forStock,
      supplierName: data.product.supplier || "ללא ספק",
      status: keepSent?.status || "PENDING",
      sentAt: keepSent?.sentAt,
      arrivedAt: keepSent?.arrivedAt,
    });

    await item.save();
    purchaseList.push(item);
  }

  return PurchaseList.find().populate("product");
};

const getLowStockAlerts = async () => {
  return BaseProduct.find({
    $expr: { $lte: ["$quantity", "$minStock"] }
  });
};

const updateStockOnArrival = async (arrivals) => {
  for (const { productId, quantityArrived } of arrivals) {
    const product = await BaseProduct.findById(productId);
    if (!product) continue;
    product.quantity = Number(product.quantity || 0) + Number(quantityArrived || 0);
    const pending = Math.max(Number(product.pendingInitialSupplyQty || 0), 0);
    if (pending > 0) {
      product.pendingInitialSupplyQty = Math.max(pending - Number(quantityArrived || 0), 0);
    }
    await product.save();
  }

  const waitingOrders = await Order.find({ status: "WAITING_FOR_SUPPLY" })
    .populate("requiredMaterials.product unavailableMaterials.product");

  for (const order of waitingOrders) {
    const stillUnavailable = [];
    const nowAvailable = [];

    for (const material of order.unavailableMaterials) {
      const productRef = material.product?._id ?? material.product;
      if (!productRef) {
        stillUnavailable.push(material);
        continue;
      }
      const baseProduct = await BaseProduct.findById(productRef);
      if (!baseProduct) {
        stillUnavailable.push(material);
        continue;
      }
      const available = baseProduct.quantity - baseProduct.reservedQuantity;
      const reqQty = Number(material.quantity || 0);

      if (available < reqQty) {
        stillUnavailable.push({
          ...material.toObject(),
          availableQuantity: available,
          neededQuantity: reqQty - available
        });
      } else {
        nowAvailable.push(material);
        baseProduct.reservedQuantity = Number(baseProduct.reservedQuantity || 0) + reqQty;
        await baseProduct.save();
      }
    }

    order.unavailableMaterials = stillUnavailable;

    for (const mat of nowAvailable) {
      const matPid = (mat.product?._id ?? mat.product)?.toString();
      if (!matPid) continue;
      const existsInAvailable = order.availableMaterials.some((m) => {
        const mid = (m.product?._id ?? m.product)?.toString();
        return mid === matPid;
      });
      if (!existsInAvailable) order.availableMaterials.push(mat);
    }

    if (stillUnavailable.length === 0) {
      order.status = "WAITING_FOR_PICKING";
      order.unavailableMaterials = [];
      order.markModified("unavailableMaterials");
    }

    await order.save();
  }

  await generatePurchaseList();
};

const getPendingOrders = async () => {
  return Order.find({
    status: { $in: ["ORDERED", "WAITING_FOR_SUPPLY", "WAITING_FOR_PICKING"] }
  })
    .populate("requiredMaterials.product availableMaterials.product unavailableMaterials.product")
    .sort({ orderDate: 1 });
};

const getOrderDetails = async (orderId) => {
  return Order.findById(orderId)
    .populate("requiredMaterials.product availableMaterials.product unavailableMaterials.product assignedCarpenter");
};

const markReadyForShipping = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  const allPicked = order.requiredMaterials.every(m => m.isPicked);
  if (!allPicked) throw new Error("Not all materials have been picked yet");

  order.status = "READY_FOR_SHIPPING";
  await order.save();
  return order;
};

const getAllBaseProducts = async () => {
  return BaseProduct.find().sort({ name: 1 });
};

const updateBaseProduct = async (productId, updates) => {
  return BaseProduct.findByIdAndUpdate(productId, updates, { new: true, runValidators: true });
};

// ─── חדש: ניהול ספקים ────────────────────────────────────

const markSupplierAsSent = async (supplierName) => {
  await PurchaseList.updateMany(
    { supplierName },
    { status: 'SENT_TO_SUPPLIER', sentAt: new Date() }
  );
  return PurchaseList.find({ supplierName }).populate('product');
};

const processSupplierArrival = async (supplierName) => {
  const items = await PurchaseList.find({ supplierName }).populate('product');
  if (!items.length) throw new Error('לא נמצאו פריטים לספק זה');

  const arrivals = items.map(item => ({
    productId: item.product._id,
    quantityArrived: item.totalQuantityNeeded,
  }));

  await updateStockOnArrival(arrivals);

  await PurchaseList.updateMany(
    { supplierName },
    { status: 'ARRIVED', arrivedAt: new Date() }
  );

  return { success: true, updated: arrivals.length };
};

export {
  checkMaterialsAvailability,
  markOrderAsSeen,
  pickMaterial,
  createNewBaseProduct,
  generatePurchaseList,
  getLowStockAlerts,
  updateStockOnArrival,
  getPendingOrders,
  getOrderDetails,
  markReadyForShipping,
  getAllBaseProducts,
  updateBaseProduct,
  markSupplierAsSent,
  processSupplierArrival,
};