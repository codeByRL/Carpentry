import mongoose from "mongoose";
const { Schema, model } = mongoose;

const NotificationSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  sender: { // נוסף כדי לתמוך בהתראות צ'אט
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  order: {
    type: Schema.Types.ObjectId,
    ref: "Order"
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["URGENT", "WARNING", "INFO", "CHAT"], // נוסף 'CHAT'
    default: "INFO"
  },
  link: { // נוסף כדי לתמוך בניווט להתראות צ'אט
    type: String,
    default: ""
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default model("Notification", NotificationSchema);