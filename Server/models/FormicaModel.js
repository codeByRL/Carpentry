import mongoose from "mongoose";
const { Schema, model } = mongoose;

const FormicaModelSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  code: { type: String, unique: true },
  description: { type: String, default: "" },
  supplier: { type: String, default: "" },
  priceDelta: { type: Number, default: 0 },
  image: { type: String, default: null },
  baseProductId: { type: Schema.Types.ObjectId, ref: "BaseProduct", default: null },
}, { timestamps: true });

export default model("FormicaModel", FormicaModelSchema);
