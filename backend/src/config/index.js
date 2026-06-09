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
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
  },
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY,
  },
  lms: {
    baseGraphql: process.env.LMS_BASE_GRAPHQL,
    gatewayGraphql: process.env.LMS_GATEWAY_GRAPHQL,
    origin: process.env.LMS_ORIGIN,
    referer: process.env.LMS_REFERER,
  },
  reminder: {
    checkInterval: parseInt(process.env.REMINDER_CHECK_INTERVAL, 10),
    reminderHours: 24,
  },
};
