import mongoose from "mongoose";
const { Schema, model } = mongoose;

// קטגוריות מוצר קטלוגי. מקור אמת יחיד — גם הקליינט מצפה לאותם הערכים.
export const CATALOG_CATEGORIES = [
  "מיטה",
  "ארון",
  "שידה",
  "ספה",
  "שולחן",
  "כסא",
  "אחר",
];

const CatalogProductSchema = new Schema({
  name: { type: String, required: true },
  category: {
    type: String,
    enum: CATALOG_CATEGORIES,
    required: true,
    default: "אחר",
  },
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
  needsFormicaSelection: { type: Boolean, default: false },

  // כמות הבד הנדרשת ליחידה אחת של המוצר (יחידות הבד הן לפי unit שלו במחסן, בד"כ מטרים).
  // נקבע ע"י הנגר באפיון (וניתן לעריכה ע"י מנהל). רלוונטי רק כש־needsFabricSelection=true.
  fabricQuantityPerUnit: { type: Number, default: 0, min: 0 },

  // כמות הפורמייקה הנדרשת ליחידה אחת (בד"כ מ"ר). רלוונטי רק כש־needsFormicaSelection=true.
  formicaQuantityPerUnit: { type: Number, default: 0, min: 0 },

  needsHandleSelection: { type: Boolean, default: false },
  handleQuantityPerUnit: { type: Number, default: 0, min: 0 },

  status: {
    type: String,
    enum: ["PENDING_CHARACTERIZATION", "WAITING_ADMIN_APPROVAL", "ACTIVE"],
    default: "PENDING_CHARACTERIZATION"
  },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  assignedCarpenter: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// שדות בחירת עץ הוסרו מהמערכת — וודא שהם נשארים ריקים בכל שמירה.
// בחירת בד פעילה ולכן אין לאפס אותה אוטומטית.
const clearWoodSelectionFields = (target) => {
  if (!target || typeof target !== "object") return;
  target.woodOptions = [];
  target.needsWoodSelection = false;
};

// ⚠️ ב־Mongoose 9 פונקציות middleware רצות במצב promise/async ואין יותר פרמטר next.
// לכן אסור לקרוא next() — חייבים לעבוד עם async/return promise בלבד.
CatalogProductSchema.pre("save", async function () {
  clearWoodSelectionFields(this);
});

async function sanitizeUpdatePayload() {
  const update = this.getUpdate();
  if (!update || typeof update !== "object") return;
  // אל תוסיף שדות לשורש ליד $set — MongoDB דוחה עדכון כזה.
  if (update.$set && typeof update.$set === "object") {
    clearWoodSelectionFields(update.$set);
  } else {
    const hasOperator = Object.keys(update).some((k) => k.startsWith("$"));
    if (!hasOperator) {
      clearWoodSelectionFields(update);
    }
  }
  this.setUpdate(update);
}

CatalogProductSchema.pre("findOneAndUpdate", sanitizeUpdatePayload);
CatalogProductSchema.pre("updateOne", sanitizeUpdatePayload);
CatalogProductSchema.pre("updateMany", sanitizeUpdatePayload);

export default model("CatalogProduct", CatalogProductSchema);