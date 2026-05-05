import Order from "../models/Order.js";
import BaseProduct from "../models/BaseProduct.js";
import PurchaseList from "../models/PurchaseList.js";
import mongoose from "mongoose";

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

const pickMaterial = async (orderId, materialId, warehouseUserId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error("Order not found");

    const material = order.requiredMaterials.find(
      m => m.product.toString() === materialId
    );
    if (!material) throw new Error("Material not found in order");
    if (material.isPicked) throw new Error("Material already picked");

    const baseProduct = await BaseProduct.findById(materialId).session(session);
    if (!baseProduct) throw new Error("Base product not found");

    const available = baseProduct.quantity - baseProduct.reservedQuantity;
    if (available < material.quantity) throw new Error("Insufficient stock");

    baseProduct.quantity -= material.quantity;
    baseProduct.reservedQuantity -= material.quantity;
    await baseProduct.save({ session });

    material.isPicked = true;
    await order.save({ session });

    const allPicked = order.requiredMaterials.every(m => m.isPicked);
    if (allPicked) {
      order.status = "READY_FOR_SHIPPING";
      order.readyForShippingAt = new Date();
      order.warehouseHandledBy = warehouseUserId;
      await order.save({ session });
    }

    await session.commitTransaction();
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const createNewBaseProduct = async (data) => {
  const product = new BaseProduct({
    name: data.name,
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
  await PurchaseList.deleteMany({});

  const purchaseMap = {};

  const orders = await Order.find({ status: "WAITING_FOR_SUPPLY" })
    .populate("unavailableMaterials.product");

  for (const order of orders) {
    for (const material of order.unavailableMaterials) {
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

    const item = new PurchaseList({
      product: productId,
      totalQuantityNeeded: totalQuantity,
      forOrders: data.forOrders,
      forStock: data.forStock,
      supplierName: data.product.supplier || 'ללא ספק',  // ← חדש
      status: 'PENDING',                                   // ← חדש
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
    await BaseProduct.findByIdAndUpdate(productId, {
      $inc: { quantity: quantityArrived }
    });
  }

  const waitingOrders = await Order.find({ status: "WAITING_FOR_SUPPLY" })
    .populate("requiredMaterials.product unavailableMaterials.product");

  for (const order of waitingOrders) {
    const stillUnavailable = [];
    const nowAvailable = [];

    for (const material of order.unavailableMaterials) {
      const baseProduct = await BaseProduct.findById(material.product._id);
      const available = baseProduct.quantity - baseProduct.reservedQuantity;

      if (available < material.quantity) {
        stillUnavailable.push({
          ...material.toObject(),
          availableQuantity: available,
          neededQuantity: material.quantity - available
        });
      } else {
        nowAvailable.push(material);
        baseProduct.reservedQuantity += material.quantity;
        await baseProduct.save();
      }
    }

    order.unavailableMaterials = stillUnavailable;

    for (const mat of nowAvailable) {
      const existsInAvailable = order.availableMaterials.some(
        m => m.product.toString() === mat.product._id.toString()
      );
      if (!existsInAvailable) order.availableMaterials.push(mat);
    }

    if (stillUnavailable.length === 0) order.status = "WAITING_FOR_PICKING";

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