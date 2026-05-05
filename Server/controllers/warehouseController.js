import * as warehouseService from "../services/warehouseService.js";
import BaseProduct from "../models/BaseProduct.js";
import Order from "../models/Order.js";

export const getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const status = await warehouseService.getOrderWarehouseStatus(orderId);
    res.json(status);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const markOrderReadyForShipping = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await warehouseService.markOrderReadyForShipping(orderId);
    res.json({ message: "Order marked as ready for shipping", order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateStockOnArrival = async (req, res) => {
  try {
    const { baseProductId, quantity } = req.body;
    const result = await warehouseService.updateStockOnArrival(baseProductId, quantity);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getPurchaseList = async (req, res) => {
  try {
    const purchaseList = await warehouseService.generatePurchaseList();
    res.json(purchaseList);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getLowStockAlerts = async (req, res) => {
  try {
    const alerts = await warehouseService.getLowStockAlerts();
    res.json(alerts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateBaseProductStock = async (req, res) => {
  try {
    const { baseProductId } = req.params;
    const { quantity } = req.body;
    const baseProduct = await warehouseService.updateProductStock(baseProductId, quantity);
    res.json(baseProduct);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllBaseProducts = async (req, res) => {
  try {
    const products = await BaseProduct.find().sort({ name: 1 });
    res.json(products);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createBaseProduct = async (req, res) => {
  try {
    const {
      name, code, unit, quantity, minStock, reorderQuantity,
      shelfLocation, supplier, isMaterial, materialType,
      priceDelta, image, description
    } = req.body;

    const existing = await BaseProduct.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ error: `מוצר בשם "${name}" כבר קיים במערכת` });
    }

    const product = await BaseProduct.create({
      name: name.trim(),
      code, unit,
      quantity: quantity || 0,
      minStock: minStock || 5,
      reorderQuantity: reorderQuantity || 20,
      shelfLocation, supplier,
      isMaterial: isMaterial || false,
      materialType: materialType || null,
      priceDelta: priceDelta || 0,
      image, description,
      isNew: true,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateBaseProduct = async (req, res) => {
  try {
    const { baseProductId } = req.params;
    const {
      name, code, unit, quantity, minStock, reorderQuantity,
      shelfLocation, supplier, isMaterial, materialType,
      priceDelta, image, description
    } = req.body;

    const product = await BaseProduct.findByIdAndUpdate(
      baseProductId,
      {
        name, code, unit, quantity, minStock, reorderQuantity,
        shelfLocation, supplier, isMaterial,
        materialType: isMaterial ? materialType : null,
        priceDelta, image, description
      },
      { new: true, runValidators: true }
    );

    if (!product) return res.status(404).json({ error: 'מוצר לא נמצא' });
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const pickMaterial = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { materialId, warehouseUserId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });

    const mat = order.requiredMaterials.find(
      m => (m.product?._id || m.product)?.toString() === materialId?.toString()
    );
    if (!mat) return res.status(404).json({ error: 'חומר לא נמצא בהזמנה' });

    mat.isPicked = true;

    const allPicked = order.requiredMaterials.every(m => m.isPicked);
    if (allPicked) {
      order.status = 'READY_FOR_SHIPPING';
      order.readyForShippingAt = new Date();
      if (warehouseUserId) order.warehouseHandledBy = warehouseUserId;
    }

    await order.save();

    const populated = await Order.findById(orderId)
      .populate('requiredMaterials.product')
      .populate('unavailableMaterials.product')
      .populate('assignedCarpenter', 'fullName');

    res.json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getOrdersWithNewProducts = async (req, res) => {
  try {
    const newProducts = await BaseProduct.find({ isNew: true }).select('_id name');
    const newProductIds = newProducts.map(p => p._id.toString());

    if (newProductIds.length === 0) return res.json([]);

    const orders = await Order.find({
      status: { $in: ['WAITING_FOR_SUPPLY', 'WAITING_FOR_PICKING', 'WAITING_FOR_WAREHOUSE'] },
      'requiredMaterials.product': { $in: newProductIds }
    })
      .populate('requiredMaterials.product')
      .populate('assignedCarpenter', 'fullName')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const markBaseProductAsSupplied = async (req, res) => {
  try {
    const { baseProductId } = req.params;
    const { quantity } = req.body;

    const product = await BaseProduct.findByIdAndUpdate(
      baseProductId,
      { isNew: false, $set: { quantity: quantity || 0 } },
      { new: true }
    );

    if (!product) return res.status(404).json({ error: 'מוצר לא נמצא' });
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── ניהול ספקים ברשימת רכש ─────────────────────────────

export const markSupplierSent = async (req, res) => {
  try {
    const { supplierName } = req.params;
    const items = await warehouseService.markSupplierAsSent(
      decodeURIComponent(supplierName)
    );
    res.json(items);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const markSupplierArrived = async (req, res) => {
  try {
    const { supplierName } = req.params;
    const result = await warehouseService.processSupplierArrival(
      decodeURIComponent(supplierName)
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};