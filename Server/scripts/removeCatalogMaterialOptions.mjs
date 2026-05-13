import dotenv from "dotenv";
import mongoose from "mongoose";
import CatalogProduct from "../models/CatalogProduct.js";

dotenv.config({ path: "./.env" });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const result = await CatalogProduct.updateMany(
    {},
    {
      $set: {
        woodOptions: [],
        fabricOptions: [],
        needsWoodSelection: false,
        needsFabricSelection: false,
      },
    }
  );

  console.log(
    `Catalog cleanup completed. matched=${result.matchedCount}, modified=${result.modifiedCount}`
  );

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("removeCatalogMaterialOptions failed:", err.message);
  await mongoose.disconnect();
  process.exit(1);
});
