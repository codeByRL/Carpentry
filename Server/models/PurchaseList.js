import mongoose from "mongoose";
const { Schema, model } = mongoose;

const PurchaseListSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: "BaseProduct",
    required: true
  },
  totalQuantityNeeded: { type: Number, required: true },
  forOrders:    { type: Number, default: 0 },
  forStock:     { type: Number, default: 0 },
  supplierName: { type: String, default: 'ללא ספק' },
  status: {
    type: String,
    enum: ['PENDING', 'SENT_TO_SUPPLIER', 'ARRIVED'],
    default: 'PENDING'
  },
  sentAt:    { type: Date },
  arrivedAt: { type: Date },
}, { timestamps: true });

export default model("PurchaseList", PurchaseListSchema);