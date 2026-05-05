import mongoose from "mongoose";
const { Schema, model } = mongoose;

const MessageSchema = new Schema({
  sender: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiver: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  order: { // אופציונלי - אם ההודעה קשורה להזמנה ספציפית
    type: Schema.Types.ObjectId,
    ref: "Order"
  },
  content: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default model("Message", MessageSchema);