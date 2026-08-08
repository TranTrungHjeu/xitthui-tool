// Test script: Compare backend response vs LMS response for TDM-C4K-GB31
// Shows whether the issue is: cache, scheduler, or data shape mismatch.

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

const { graphqlClient } = require(path.join(__dirname, "../../src/utils/httpClient"));

const CONFIG = {
  baseGraphql: process.env.MINDX_LMS_BASE_API,
  gatewayGraphql: process.env.MINDX_LMS_GATEWAY_API,
  origin: process.env.MINDX_LMS_ORIGIN,
  referer: process.env.MINDX_LMS_REFERER,
  masterUsername: process.env.LMS_MASTER_USERNAME,
  masterPassword: process.env.LMS_MASTER_PASSWORD,
};

const CLASS_ID = "84c877dfa6ee088198a259e5"; // TDM-C4K-GB31

const GET_CLASS_BY_ID = `
  query GetClassById($id: ID!) {
    classesById(id: $id) {
      id name level status
      centre { id name }
      slots {
        _id date startTime endTime index
        summary
        teachers { teacher { id fullName } role { shortName } isActive }
        studentAttendance {
          _id student { id fullName }
          comment sendCommentStatus status
        }
      }
    }
  }
`;

async function loginWithUsername(username, password) {
  const query = `
    mutation loginWithUsername($username: String!, $password: String!) {
      users {
        loginWithUsername(
          loginWithUsernameInput: {username: $username, password: $password}
        ) { customToken __typename }
        __typename
      }
    }
  `;

  const res = await graphqlClient.post(CONFIG.baseGraphql, {
    operationName: "loginWithUsername",
    variables: { username, password },
    query,
  }, {
    headers: {
      "Content-Type": "application/json",
      origin: "https://base.mindx.edu.vn",
      referer: "https://base.mindx.edu.vn/",
    },
  });

  const customToken = res.data?.data?.users?.loginWithUsername?.customToken;
  const FIREBASE_API_KEY = process.env.MINDX_FIREBASE_API_KEY;
  const tokenRes = await graphqlClient.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
    { token: customToken, returnSecureToken: true }
  );
  return tokenRes.data.idToken;
}

async function getFromLMS(token) {
  console.log(`\n========== LMS DIRECT QUERY ==========`);
  const res = await graphqlClient.post(CONFIG.gatewayGraphql, {
    operationName: "GetClassById",
    query: GET_CLASS_BY_ID,
    variables: { id: CLASS_ID },
  }, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Origin: CONFIG.origin,
      Referer: CONFIG.referer,
    },
  });
  return res.data?.data?.classesById;
}

async function getFromBackend(token, noCache) {
  const SERVER_URL = process.env.BACKEND_URL || "http://localhost:3001";
  console.log(`\n========== BACKEND QUERY (noCache=${noCache}) ==========`);
  const res = await graphqlClient.post(`${SERVER_URL}/api/classes/detail`, {
    token,
    classId: CLASS_ID,
    noCache,
  });
  return res.data;
}

async function getFromMongoDB() {
  const mongoose = require("mongoose");
  const MONGODB_URI = process.env.MONGODB_URI;
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;
    const Class = db.collection("classes");
    const doc = await Class.findOne({ _id: CLASS_ID });
    return doc;
  } finally {
    await mongoose.disconnect();
  }
}

function summarizeLMS(data) {
  if (!data) return "null";
  const slots = data.slots || [];
  const summary = slots.map((s, i) => {
    const attendance = s.studentAttendance || [];
    const commented = attendance.filter((a) => a.comment && a.comment.trim()).length;
    return `  Slot ${i + 1} (${s.date}): attendance=${attendance.length}, withComment=${commented}`;
  }).join("\n");
  return `Slots: ${slots.length}\n${summary}`;
}

(async () => {
  try {
    const token = await loginWithUsername(CONFIG.masterUsername, CONFIG.masterPassword);
    console.log(`✅ Logged in as ${CONFIG.masterUsername}`);

    // 1. Query LMS directly
    const lmsData = await getFromLMS(token);
    console.log(`LMS ${lmsData.name}:`);
    console.log(summarizeLMS(lmsData));

    // 2. Query MongoDB
    console.log(`\n========== MONGODB QUERY ==========`);
    const mongoDoc = await getFromMongoDB();
    if (!mongoDoc) {
      console.log(`❌ MongoDB: Class not found in DB`);
    } else {
      const slots = mongoDoc.slots || [];
      const summary = slots.map((s, i) => {
        const attendance = s.studentAttendance || [];
        const commented = attendance.filter((a) => a.comment && a.comment.trim()).length;
        return `  Slot ${i + 1} (${s.date}): attendance=${attendance.length}, withComment=${commented}`;
      }).join("\n");
      console.log(`MongoDB ${mongoDoc.name}:`);
      console.log(`_id: ${mongoDoc._id}`);
      console.log(`status: ${mongoDoc.status}`);
      console.log(`updatedAt: ${mongoDoc.updatedAt}`);
      console.log(`Slots: ${slots.length}\n${summary}`);
    }

    // 3. Query Backend (with cache)
    try {
      const backendCached = await getFromBackend(token, false);
      console.log(`Backend (cached):`, JSON.stringify(backendCached?.error || "OK"));
      if (backendCached?.data) {
        const slots = backendCached.data.slots || [];
        const summary = slots.map((s, i) => {
          const attendance = s.studentAttendance || [];
          const commented = attendance.filter((a) => a.comment && a.comment.trim()).length;
          return `  Slot ${i + 1} (${s.date}): attendance=${attendance.length}, withComment=${commented}`;
        }).join("\n");
        console.log(`Slots: ${slots.length}\n${summary}`);
      }
    } catch (e) {
      console.log(`Backend cached error: ${e.message}`);
    }

    // 4. Query Backend (no cache)
    try {
      const backendFresh = await getFromBackend(token, true);
      console.log(`Backend (fresh):`, JSON.stringify(backendFresh?.error || "OK"));
      if (backendFresh?.data) {
        const slots = backendFresh.data.slots || [];
        const summary = slots.map((s, i) => {
          const attendance = s.studentAttendance || [];
          const commented = attendance.filter((a) => a.comment && a.comment.trim()).length;
          return `  Slot ${i + 1} (${s.date}): attendance=${attendance.length}, withComment=${commented}`;
        }).join("\n");
        console.log(`Slots: ${slots.length}\n${summary}`);
      }
    } catch (e) {
      console.log(`Backend fresh error: ${e.message}`);
    }
  } catch (err) {
    console.error(`Fatal:`, err.message);
    if (err.response) {
      console.error(`Response:`, JSON.stringify(err.response.data, null, 2));
    }
  }
})();
