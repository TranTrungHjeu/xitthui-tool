// Test cookie-based auth flow
// Chạy: node test/scratch/test-cookie-login.js

const path = require("path");
const fs = require("fs");

const envCandidates = [
  path.join(__dirname, "../../.env"),
  path.join(__dirname, "../../../.env"),
];
for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    require("dotenv").config({ path: p });
    break;
  }
}

const http = require("http");

const SERVER_URL = "http://localhost:3001";
const TEST_CLASS_ID = "84c877dfa6ee088198a259e5"; // TDM-C4K-GB31

function request(method, urlPath, body, cookies = "") {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(SERVER_URL + urlPath);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(cookies ? { Cookie: cookies } : {}),
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString();
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch { /* not JSON */ }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          raw,
        });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return [];
  const arr = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return arr.map((c) => c.split(";")[0]); // "name=value"
}

function cookieString(cookies) {
  return cookies.join("; ");
}

(async () => {
  console.log("===== Cookie-based auth smoke test =====\n");

  // 1. Login as master
  console.log("[1] POST /login (master)...");
  const loginRes = await request("POST", "/login", {
    username: process.env.LMS_MASTER_USERNAME,
    password: process.env.LMS_MASTER_PASSWORD,
  });
  console.log(`    status: ${loginRes.status}`);
  console.log(`    body.success: ${loginRes.body?.success}`);

  const cookies = parseCookies(loginRes.headers["set-cookie"]);
  console.log(`    Set-Cookie names: ${cookies.map((c) => c.split("=")[0]).join(", ")}`);

  if (cookies.length === 0) {
    console.log("    ❌ No Set-Cookie returned. Cookie auth failed!");
    process.exit(1);
  }
  if (!cookies.some((c) => c.startsWith("lms_token="))) {
    console.log("    ❌ lms_token cookie not set!");
    process.exit(1);
  }
  if (!cookies.some((c) => c.startsWith("session_id="))) {
    console.log("    ❌ session_id cookie not set!");
    process.exit(1);
  }

  console.log(`    ✅ Got both auth cookies\n`);

  // 2. GET /me using the cookie
  console.log("[2] GET /me (with cookie)...");
  const meRes = await request("GET", "/me", null, cookieString(cookies));
  console.log(`    status: ${meRes.status}`);
  console.log(`    body:`, JSON.stringify(meRes.body, null, 2));

  if (meRes.status !== 200 || !meRes.body?.success) {
    console.log("    ❌ /me failed");
    process.exit(1);
  }

  // 3. POST /classes/detail WITHOUT body token (cookie-only)
  console.log("\n[3] POST /classes/detail (cookie-only, no token in body)...");
  const detailRes = await request("POST", "/classes/detail", {
    classId: TEST_CLASS_ID,
    noCache: true,
  }, cookieString(cookies));
  console.log(`    status: ${detailRes.status}`);
  if (detailRes.status === 400 && detailRes.body?.error?.includes("Token")) {
    console.log("    ❌ Token required error — cookie auth not working");
    process.exit(1);
  }
  if (detailRes.body?.success) {
    console.log(`    ✅ Got class detail: ${detailRes.body.data?.name}`);
    const slots = detailRes.body.data?.slots || [];
    const slotted = slots.filter((s) => s.studentAttendance?.some((a) => a.comment));
    console.log(`    Slots with comments: ${slotted.length}`);
  }

  // 4. POST /classes/detail WITHOUT cookie (should 400)
  console.log("\n[4] POST /classes/detail WITHOUT cookie (should 400)...");
  const noCookieRes = await request("POST", "/classes/detail", {
    classId: TEST_CLASS_ID,
  });
  console.log(`    status: ${noCookieRes.status}`);
  console.log(`    body:`, JSON.stringify(noCookieRes.body, null, 2));
  if (noCookieRes.status !== 400) {
    console.log("    ❌ Expected 400 but got", noCookieRes.status);
    process.exit(1);
  }
  console.log(`    ✅ Correctly rejected`);

  // 5. Logout
  console.log("\n[5] POST /logout (should clear cookies)...");
  const logoutRes = await request("POST", "/logout", {}, cookieString(cookies));
  console.log(`    status: ${logoutRes.status}`);
  const logoutCookies = parseCookies(logoutRes.headers["set-cookie"]);
  console.log(`    Set-Cookie names: ${logoutCookies.map((c) => c.split("=")[0]).join(", ")}`);
  if (!logoutCookies.some((c) => c.startsWith("lms_token="))) {
    console.log("    ❌ lms_token clear cookie not set");
    process.exit(1);
  }
  console.log(`    ✅ Logout cleared cookies`);

  // 6. After logout, /me should 401
  console.log("\n[6] GET /me after logout (should 401)...");
  const meAfterLogout = await request("GET", "/me", null, cookieString(cookies));
  console.log(`    status: ${meAfterLogout.status}`);
  if (meAfterLogout.status !== 401) {
    console.log("    ❌ Expected 401 but got", meAfterLogout.status);
    process.exit(1);
  }
  console.log(`    ✅ Session correctly invalidated`);

  console.log("\n===== All tests passed ✅ =====");
})();
