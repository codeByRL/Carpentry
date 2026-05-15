import mongoose from "mongoose";
const { Schema, model } = mongoose;

const chosenMaterialSchema = new Schema({
  materialId: { type: Schema.Types.ObjectId, ref: "BaseProduct" },
  code: String,
  description: String,
  image: String,
  priceDelta: Number
}, { _id: false });

const orderItemSchema = new Schema({
  catalogProduct: { type: Schema.Types.ObjectId, ref: "CatalogProduct", required: true },
  quantity: { type: Number, default: 1 },
  productSnapshot: { type: Object },
  selectedCustomization: {
    wood: chosenMaterialSchema,
    fabric: chosenMaterialSchema,
    formica: {
      formicaId: { type: Schema.Types.ObjectId, ref: "FormicaModel" },
      code: String,
      name: String,
      image: String,
      priceDelta: Number,
    },
    handle: chosenMaterialSchema,
    notes: String
  },
  itemPrice: Number
}, { _id: false });

// כאן השינוי: product במקום baseProduct
const requiredMaterialSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "BaseProduct" },
  quantity: Number,
  isPicked: { type: Boolean, default: false }
}, { _id: false });

// שדות עזר שה-Service משתמש בהם לחישובי זמינות וחוסרים
const materialRefSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "BaseProduct" },
  quantity: Number,
  neededQuantity: Number,
  availableQuantity: Number,
  isPicked: { type: Boolean, default: false }
}, { _id: false });

const OrderSchema = new Schema({
  customer: {
    name: { type: String, required: true },
    phone1: { type: String, required: true },
    phone2: String,
    idNumber: String,
    email: String,
    deliveryAddress: { type: String, required: true },
    invoiceName: String
  },
  items: [orderItemSchema],
  status: {
    type: String,
    enum: [
      "QUOTATION_PENDING",
      "ORDERED",
      "WAITING_FOR_WAREHOUSE",
      "WAITING_FOR_PICKING",
      "WAITING_FOR_SUPPLY",
      "READY_FOR_SHIPPING",
      "IN_PROGRESS",
      "DONE"
    ],
    default: "ORDERED"
  },
  isPaid: { type: Boolean, default: false },
  requiredMaterials: [requiredMaterialSchema],

  // שדה עבור החומרים שהמחסנאי כבר אישר שקיימים
  availableMaterials: [materialRefSchema],
  // שדה עבור החסרים שהולכים לרשימת הרכש
  unavailableMaterials: [materialRefSchema],

  // שדות מעקב של המחסן (חותמות זמן ומי טיפל)
  seenByWarehouseAt: { type: Date },
  warehouseSeenBy: { type: Schema.Types.ObjectId, ref: "User" },
  readyForShippingAt: { type: Date },
  warehouseHandledBy: { type: Schema.Types.ObjectId, ref: "User" },

  totalPrice: Number,
  priceWithVAT: Number,
  orderDate: { type: Date, default: Date.now },
  estimatedDeliveryDate: Date,
  deliveryClaimedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  deliveryClaimedAt: { type: Date, default: null },
  /** המוביל סיים עצירת הובלה לנגר; ממתין לאישור קבלה מהנגר לפני IN_PROGRESS */
  driverMarkedDeliveredToCarpenterAt: { type: Date, default: null },
  assignedCarpenter: { type: Schema.Types.ObjectId, ref: "User" },
  receivedByCarpenter: { type: Boolean, default: false },
  carpenterPaused: { type: Boolean, default: false },
  carpenterPauseReason: { type: String, default: "" },
  carpenterPausedAt: { type: Date },
  carpenterCompletedAt: { type: Date },
  /** שעות עבודה שמורות בשיוך נגר — מקור לחישוב עומס (לא תלוי במוביל). */
  committedWorkHours: { type: Number, default: null },
}, { timestamps: true });

export default model("Order", OrderSchema);