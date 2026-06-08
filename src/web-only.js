require("dotenv").config();
const app = require("./web/server");

const PORT = process.env.WEB_PORT || 3000;

console.log("🌐 Starting MindX LMS Test UI (Web Only Mode)...");
console.log("   No Telegram bot will be started.\n");

app.listen(PORT, () => {
  console.log(`🌐 Web server is listening on port ${PORT}`);
});

console.log(
  `\n📖 Open http://localhost:${PORT} in your browser to test LMS API`,
);
