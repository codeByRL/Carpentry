import mongoose from "mongoose";
const { Schema, model } = mongoose;

const CatalogProductSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  image: String,
  
  // לוגיקת חומרים (Base Products) - נשמרת!
  baseProducts: [{
    product: { type: Schema.Types.ObjectId, ref: "BaseProduct" },
    quantity: { type: Number, required: true }
  }],

  price: { type: Number, default: null },
  estimatedWorkTime: { type: Number, default: null }, // בשעות

  // 🆕 אופציות בחירה (קוד + תיאור)
  woodOptions: [{
    code: String,        // למשל: "444"
    description: String  // למשל: "אלון טבעי"
  }],
  fabricOptions: [{
    code: String,        // למשל: "B-12"
    description: String  // למשל: "קטיפה אפורה"
  }],

  // 🆕 דגלים לקליינט
  needsWoodSelection: { type: Boolean, default: false },
  needsFabricSelection: { type: Boolean, default: false },

  status: {
    type: String,
    enum: ["PENDING_CHARACTERIZATION", "WAITING_ADMIN_APPROVAL", "ACTIVE"],
    default: "PENDING_CHARACTERIZATION"
  },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  assignedCarpenter: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default model("CatalogProduct", CatalogProductSchema);