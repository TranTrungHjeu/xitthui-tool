require("dotenv").config();

module.exports = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
  },
  firebase: {
    apiKey:
      process.env.FIREBASE_API_KEY || "AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4",
  },
  lms: {
    baseGraphql:
      process.env.LMS_BASE_GRAPHQL || "https://base-api.mindx.edu.vn/",
    gatewayGraphql:
      process.env.LMS_GATEWAY_GRAPHQL || "https://lms-api.mindx.edu.vn/",
  },
  reminder: {
    checkInterval: parseInt(process.env.REMINDER_CHECK_INTERVAL || "60", 10),
    reminderHours: 24,
  },
};
