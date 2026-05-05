import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "very_secret_key";

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      warehouse: user.warehouse
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
};

export { generateToken, JWT_SECRET };
