const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

let isMongoConnected = false;

async function connectMongoDB() {
  if (!MONGODB_URI) {
    console.error("[MongoDB] ERROR: MONGODB_URI is not defined in environment variables.");
    return false;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    isMongoConnected = true;
    console.log("[MongoDB] Connected successfully to database.");
    return true;
  } catch (error) {
    console.error("[MongoDB] Connection error:", error);
    isMongoConnected = false;
    throw error;
  }
}

mongoose.connection.on("disconnected", () => {
  console.warn("[MongoDB] Disconnected from database.");
  isMongoConnected = false;
});

mongoose.connection.on("error", (err) => {
  console.error("[MongoDB] Runtime connection error:", err);
  isMongoConnected = false;
});

module.exports = {
  connectMongoDB,
  getIsConnected: () => isMongoConnected,
  mongoose
};
