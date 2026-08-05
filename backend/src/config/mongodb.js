const mongoose = require("mongoose");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("Mongodb");

const MONGODB_URI = process.env.MONGODB_URI;

let isMongoConnected = false;

async function connectMongoDB() {
  if (!MONGODB_URI) {
    log.error("[MongoDB] ERROR: MONGODB_URI is not defined in environment variables.");
    return false;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    isMongoConnected = true;
    log.info("[MongoDB] Connected successfully to database.");
    return true;
  } catch (error) {
    log.error("[MongoDB] Connection error:", error);
    isMongoConnected = false;
    throw error;
  }
}

mongoose.connection.on("disconnected", () => {
  log.warn("[MongoDB] Disconnected from database.");
  isMongoConnected = false;
});

mongoose.connection.on("error", (err) => {
  log.error("[MongoDB] Runtime connection error:", err);
  isMongoConnected = false;
});

module.exports = {
  connectMongoDB,
  getIsConnected: () => isMongoConnected,
  mongoose
};
