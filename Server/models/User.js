import mongoose from "mongoose";
import bcrypt from "bcrypt";

const { Schema, model } = mongoose;

const UserSchema = new Schema({
  // ======================
  // פרטים בסיסיים
  // ======================
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  role: {
    type: String,
    enum: ["MANAGER", "WAREHOUSE", "CARPENTER", "SALES", "DRIVER"],
    required: true
  },

  // ======================
  // קשר למחסן (רק למחסנאים)
  // ======================
  warehouse: {
    type: Schema.Types.ObjectId,
    ref: "Warehouse",
    default: null
  },

  // ======================
  // פרטי קשר
  // ======================
  phone: { type: String, default: "" },
  address: { type: String, default: "" },

  emergencyContact: {
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    relation: { type: String, default: "" }
  },

  // ======================
  // פרטים אישיים
  // ======================
  idNumber: { type: String, default: "" },
  birthDate: { type: Date, default: null },
  gender: {
    type: String,
    enum: ["MALE", "FEMALE", "OTHER", ""],
    default: ""
  },

  // ======================
  // פרטי העסקה
  // ======================
  startDate: { type: Date, default: Date.now },

  employmentType: {
    type: String,
    enum: ["FULL_TIME", "PART_TIME", "FREELANCE"],
    default: "FULL_TIME"
  },

  salary: { type: Number, default: 0 },

  bankDetails: {
    bankName: { type: String, default: "" },
    branchNumber: { type: String, default: "" },
    accountNumber: { type: String, default: "" }
  },

  contractFile: { type: String, default: "" },

  // ======================
  // ספציפי לנגרים
  // ======================
  currentWorkloadHours: { type: Number, default: 0 },
  seniority: { type: Number, default: 0 },
  specialization: { type: String, default: "" },

  // ======================
  // כללי
  // ======================
  isActive: { type: Boolean, default: true },
  notes: { type: String, default: "" }

}, { timestamps: true });

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

export default model("User", UserSchema);