// server/middlewares/authenticate.js

import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../utils/jwt.js";
import User from "../models/User.js";

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Fallback: old tokens may miss role; enrich from DB.
    if (!decoded.role && decoded.id) {
      const user = await User.findById(decoded.id).select("_id role warehouse").lean();
      if (!user) return res.status(401).json({ message: "Invalid token user" });
      req.user = {
        ...decoded,
        id: user._id.toString(),
        role: user.role,
        warehouse: user.warehouse || null,
      };
    } else {
      req.user = decoded;
    }
    next();
  } catch (e) {
    res.status(401).json({ message: "Invalid token" });
  }
};

export default authenticate;