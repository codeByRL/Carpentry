import mongoose from "mongoose";
const { Schema, model } = mongoose;

const DeliveryStationSchema = new Schema(
  {
    stationType: String,
    label: String,
    name: String,
    address: String,
    lat: Number,
    lng: Number,
    wazeUrl: String,
  },
  { _id: false }
);

const DeliveryRunSchema = new Schema({
  driver: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, default: Date.now },

  stops: [
    {
      order: { type: Schema.Types.ObjectId, ref: "Order" },
      deliveryType: {
        type: String,
        enum: ["TO_CARPENTER", "TO_CUSTOMER"],
        required: true,
      },
      address: String,
      contactName: String,
      contactPhone: String,
      lat: Number,
      lng: Number,
      wazeUrl: String,
      station1: DeliveryStationSchema,
      station2: DeliveryStationSchema,
      sourceType: String,
      sourceAddress: String,
      destinationType: String,
      destinationAddress: String,
      status: {
        type: String,
        enum: ["PENDING", "COMPLETED"],
        default: "PENDING",
      },
      completedAt: Date,
    },
  ],

  currentStopIndex: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ["PENDING", "IN_PROGRESS", "COMPLETED"],
    default: "PENDING",
  },

  totalDistance: Number,
  estimatedDuration: Number,
}, { timestamps: true });

export default model("DeliveryRun", DeliveryRunSchema);
