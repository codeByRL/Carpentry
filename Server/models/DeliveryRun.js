import mongoose from "mongoose";
const { Schema, model } = mongoose;

const DeliveryRunSchema = new Schema({
  driver: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, default: Date.now },
  
  stops: [
    {
      order: { type: Schema.Types.ObjectId, ref: "Order" },
      address: String,
      lat: Number,
      lng: Number,
      wazeUrl: String,
      status: {
        type: String,
        enum: ["PENDING", "COMPLETED"],
        default: "PENDING"
      },
      completedAt: Date
    }
  ],

  currentStopIndex: { type: Number, default: 0 },
  
  status: {
    type: String,
    enum: ["PENDING", "IN_PROGRESS", "COMPLETED"],
    default: "PENDING"
  },

  totalDistance: Number,
  estimatedDuration: Number

}, { timestamps: true });

export default model("DeliveryRun", DeliveryRunSchema);