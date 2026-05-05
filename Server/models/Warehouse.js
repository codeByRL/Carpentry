import mongoose from "mongoose";

const { Schema, model } = mongoose;

const WarehouseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    address: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model("Warehouse", WarehouseSchema);