// Test script: Login master account + GetClassById cho TDM-C4K-GB31
// Usage: node test/scratch/test-tdm-class.js

const path = require("path");
const fs = require("fs");

// Load env manually — try multiple candidate paths
const envCandidates = [
  path.join(__dirname, "../../.env"),          // backend/.env
  path.join(__dirname, "../../../.env"),       // root/.env
];
let envLoaded = false;
for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    require("dotenv").config({ path: p });
    console.log(`[env] Loaded from: ${p}`);
    envLoaded = true;
    break;
  }
}
if (!envLoaded) {
  require("dotenv").config();
  console.log(`[env] Fallback to default dotenv lookup`);
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

const GET_CLASSES = `
  query GetClasses(
    $pageIndex: Int!,
    $itemsPerPage: Int!,
    $orderBy: String,
    $teacherSlot: [String],
    $centres: [String],
    $statusIn: [String]
  ) {
    classes(payload: {
      pageIndex: $pageIndex,
      itemsPerPage: $itemsPerPage,
      orderBy: $orderBy,
      teacherSlots: $teacherSlot,
      centre_in: $centres,
      status_in: $statusIn
    }) {
      data {
        id name level status startDate endDate numberOfSessions
        centre { id name shortName }
      }
      pagination { total }
    }
  }
`;

const GET_CLASS_BY_ID = `
  query GetClassById($id: ID!) {
    classesById(id: $id) {
      id name level rejectNote
      course { id name shortName }
      startDate endDate status
      centre { id name shortName }
      numberOfSessions
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
  console.log(`\n[1] Logging in as master: ${username}`);
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

  if (res.data.errors) {
    throw new Error(`Login failed: ${JSON.stringify(res.data.errors)}`);
  }

  const customToken = res.data?.data?.users?.loginWithUsername?.customToken;
  if (!customToken) throw new Error("No customToken returned");

  // Exchange customToken for Firebase ID token
  const FIREBASE_API_KEY = process.env.MINDX_FIREBASE_API_KEY;
  const tokenRes = await graphqlClient.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
    { token: customToken, returnSecureToken: true }
  );
  return tokenRes.data.idToken;
}

async function findTdmClassId(token) {
  console.log(`\n[2] Searching for TDM-C4K-GB31 in all classes...`);
  const res = await graphqlClient.post(CONFIG.gatewayGraphql, {
    operationName: "GetClasses",
    query: GET_CLASSES,
    variables: {
      pageIndex: 0,
      itemsPerPage: 100,
      orderBy: "createdAt_desc",
    },
  }, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Origin: CONFIG.origin,
      Referer: CONFIG.referer,
    },
  });

  if (res.data.errors) {
    throw new Error(`getClasses failed: ${JSON.stringify(res.data.errors)}`);
  }

  const allClasses = res.data?.data?.classes?.data || [];
  const total = res.data?.data?.classes?.pagination?.total || 0;
  console.log(`   Total classes (page 1): ${allClasses.length} of ${total}`);

  const matches = allClasses.filter((c) =>
    c.name && c.name.toLowerCase().includes("tdm") &&
    (c.name.toLowerCase().includes("gb31") || c.name.toLowerCase().includes("c4k"))
  );

  if (matches.length === 0) {
    console.log(`   ❌ No exact match for TDM-C4K-GB31 in first page.`);
    console.log(`   Showing all classes with "TDM" or "C4K" or "GB31":`);
    const partial = allClasses.filter((c) =>
      (c.name || "").toLowerCase().match(/tdm|c4k|gb31/)
    );
    partial.forEach((c) => console.log(`     - ${c.id} | ${c.name} | ${c.centre?.name} | ${c.status}`));
    return null;
  }

  console.log(`\n   Found ${matches.length} matching classes:`);
  matches.forEach((c) => {
    console.log(`     - ${c.id} | ${c.name} | ${c.centre?.name} | ${c.status}`);
  });
  return matches;
}

async function getClassDetail(token, classId) {
  console.log(`\n[3] Fetching detail for classId: ${classId}`);
  const res = await graphqlClient.post(CONFIG.gatewayGraphql, {
    operationName: "GetClassById",
    query: GET_CLASS_BY_ID,
    variables: { id: classId },
  }, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Origin: CONFIG.origin,
      Referer: CONFIG.referer,
    },
  });

  if (res.data.errors) {
    console.log(`   ❌ GraphQL errors:`, JSON.stringify(res.data.errors, null, 2));
    return null;
  }

  const data = res.data?.data?.classesById;
  if (!data) {
    console.log(`   ❌ No data returned`);
    return null;
  }

  console.log(`\n   === Class basic info ===`);
  console.log(`   ID: ${data.id}`);
  console.log(`   Name: ${data.name}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Centre: ${data.centre?.name}`);
  console.log(`   Slots count: ${data.slots?.length || 0}`);

  const slotsWithComment = (data.slots || []).filter((s) =>
    s.studentAttendance?.some((a) => a.comment && a.comment.trim())
  );
  console.log(`   Slots with comments: ${slotsWithComment.length}`);

  console.log(`\n   === Slot details ===`);
  (data.slots || []).forEach((slot, i) => {
    const attendance = slot.studentAttendance || [];
    const commentedStudents = attendance.filter((a) => a.comment && a.comment.trim());
    console.log(`   Slot ${i + 1}: ${slot.date} ${slot.startTime}-${slot.endTime}`);
    console.log(`     summary: ${slot.summary || "(empty)"}`);
    console.log(`     attendance count: ${attendance.length}`);
    console.log(`     students with comments: ${commentedStudents.length}`);
    if (commentedStudents.length > 0) {
      commentedStudents.slice(0, 3).forEach((a) => {
        console.log(`       - ${a.student?.fullName}: "${a.comment?.substring(0, 80)}..."`);
      });
    }
  });

  return data;
}

async function main() {
  try {
    console.log(`Config loaded:`);
    console.log(`  baseGraphql: ${CONFIG.baseGraphql}`);
    console.log(`  gatewayGraphql: ${CONFIG.gatewayGraphql}`);
    console.log(`  masterUsername: ${CONFIG.masterUsername}`);

    const token = await loginWithUsername(CONFIG.masterUsername, CONFIG.masterPassword);
    console.log(`   ✅ Got LMS token (length: ${token.length})`);

    const matches = await findTdmClassId(token);
    if (!matches || matches.length === 0) {
      console.log(`\n❌ Could not find TDM-C4K-GB31. Aborting.`);
      process.exit(1);
    }

    // Test with first match
    for (const m of matches) {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`Testing class: ${m.id} - ${m.name}`);
      console.log("=".repeat(80));
      await getClassDetail(token, m.id);
    }
  } catch (err) {
    console.error(`\n❌ Fatal error:`, err.message);
    if (err.response) {
      console.error(`   Response status: ${err.response.status}`);
      console.error(`   Response data:`, JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
