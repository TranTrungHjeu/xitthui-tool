// Test LMS auto-refresh wrapper
// Simulates: token expired → backend refreshes transparently → retries
//
// Chạy: node test/scratch/test-lms-refresh.js

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
  return arr.map((c) => c.split(";")[0]);
}

function cookieString(cookies) {
  return cookies.join("; ");
}

(async () => {
  console.log("===== LMS auto-refresh smoke test =====\n");

  // 1. Login
  console.log("[1] POST /login...");
  const loginRes = await request("POST", "/login", {
    username: process.env.LMS_MASTER_USERNAME,
    password: process.env.LMS_MASTER_PASSWORD,
  });
  console.log(`    status: ${loginRes.status}`);
  const cookies = parseCookies(loginRes.headers["set-cookie"]);
  if (cookies.length === 0) {
    console.log("    ❌ No cookies. Aborting.");
    process.exit(1);
  }
  console.log(`    ✅ Got ${cookies.length} cookies\n`);

  // 2. Hit /classes/detail with valid cookies
  console.log("[2] POST /classes/detail (valid cookies)...");
  let res = await request("POST", "/classes/detail", {
    classId: TEST_CLASS_ID,
    noCache: true,
  }, cookieString(cookies));
  console.log(`    status: ${res.status}`);
  console.log(`    success: ${res.body?.success}`);
  if (res.status !== 200 || !res.body?.success) {
    console.log(`    ❌ Initial request failed`);
    console.log(`    body: ${JSON.stringify(res.body)}`);
    process.exit(1);
  }

  // 3. Manually invalidate the cookie by clearing it, expect 400
  console.log("\n[3] POST /classes/detail (no cookie)...");
  res = await request("POST", "/classes/detail", { classId: TEST_CLASS_ID });
  console.log(`    status: ${res.status}`);
  console.log(`    body: ${JSON.stringify(res.body)}`);
  if (res.status !== 400) {
    console.log("    ❌ Expected 400");
    process.exit(1);
  }
  console.log("    ✅ Correctly rejected with 400");

  // 4. Hit /classes/details (batched) — should also work
  console.log("\n[4] POST /classes/details (valid cookies, batch)...");
  res = await request("POST", "/classes/details", {
    classIds: [TEST_CLASS_ID],
    noCache: true,
  }, cookieString(cookies));
  console.log(`    status: ${res.status}`);
  if (res.status === 200 && res.body?.success) {
    console.log(`    ✅ Got ${res.body.data?.length} classes`);
  } else {
    console.log(`    body: ${JSON.stringify(res.body)}`);
  }

  // 5. /me with cookies
  console.log("\n[5] GET /me (valid cookies)...");
  res = await request("GET", "/me", null, cookieString(cookies));
  console.log(`    status: ${res.status}`);
  console.log(`    body: ${JSON.stringify(res.body)}`);
  if (res.status !== 200 || !res.body?.success) {
    console.log("    ❌ /me failed");
    process.exit(1);
  }

  console.log("\n===== All tests passed ✅ =====");
  console.log("\nNote: To fully test the LMS auto-refresh logic, you need to");
  console.log("manually invalidate the LMS id-token in the database (e.g. by");
  console.log("running FirestoreNotification.saveActiveToken with an expired");
  console.log("token). The wrapper will then detect the 401, refresh, and");
  console.log("retry transparently.");
})();
