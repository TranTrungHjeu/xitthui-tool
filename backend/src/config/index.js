const path = require("path");
const fs = require("fs");

// Load env variables: first check local folder, then fall back to root folder
const localEnvPath = path.join(__dirname, "../../.env");
const rootEnvPath = path.join(__dirname, "../../../.env");
if (fs.existsSync(localEnvPath)) {
  require("dotenv").config({ path: localEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  require("dotenv").config({ path: rootEnvPath });
} else {
  require("dotenv").config(); // default fallback
}

module.exports = {
  firebase: {
    apiKey: process.env.MINDX_FIREBASE_API_KEY,
  },
  lms: {
    baseGraphql: process.env.MINDX_LMS_BASE_API,
    gatewayGraphql: process.env.MINDX_LMS_GATEWAY_API,
    origin: process.env.MINDX_LMS_ORIGIN,
    referer: process.env.MINDX_LMS_REFERER,
    masterUsername: process.env.LMS_MASTER_USERNAME,
    masterPassword: process.env.LMS_MASTER_PASSWORD,
  },
  reminder: {
    checkInterval: 5,
    reminderHours: 24,
  },
};
