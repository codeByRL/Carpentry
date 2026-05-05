// models/BaseProduct.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;

const BaseProductSchema = new Schema({
  name: { type: String, required: true },
  code: { type: String }, // אופציונלי - שימושי לזיהוי מהיר
  unit: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  reservedQuantity: { type: Number, default: 0 },
  minStock: { type: Number, default: 5 },
  reorderQuantity: { type: Number, default: 20 },
  shelfLocation: String,
  supplier: String,
  isNew: { type: Boolean, default: false },

  // שדות חדשים לחומר/בחירת חומר בהזמנה
  isMaterial: { type: Boolean, default: false },                      // האם הפריט משמש כחומר לבחירה (עץ/בד)
  materialType: { type: String, enum: ['wood','fabric', null], default: null }, // סוג החומר
  priceDelta: { type: Number, default: 0 },                             // תוספת מחיר יחסית למחיר המוצר

  // תמונה ותיאור — אופציונליים
  image: { type: String, default: null },    // path כמו "/uploads/.." או URL מלא
  description: { type: String, default: "" }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

BaseProductSchema.virtual("availableQuantity").get(function() {
  return this.quantity - this.reservedQuantity;
});

export default model("BaseProduct", BaseProductSchema);