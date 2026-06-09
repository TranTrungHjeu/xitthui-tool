require("dotenv").config();

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
