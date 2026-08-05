const { graphqlClient } = require("../utils/httpClient");
const config = require("../config/index");
const { resolveUserRolesAndProfile } = require("../utils/roleResolver");
const { ROLES } = require("../constants/roles");
const { AsyncLocalStorage } = require("async_hooks");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("LmsAuth");

// Firebase project config extracted from config
const FIREBASE_API_KEY = config.firebase.apiKey;

/**
 * AsyncLocalStorage — provides request-scoped isolation for cookies.
 * Before: `const cookies = {}` at module scope was shared by all concurrent logins,
 * causing cookie pollution and auth failures.
 * Fix: every async context (i.e. every incoming login request) gets its own
 * isolated cookies map automatically via AsyncLocalStorage. No function signatures
 * need to change; no caller code needs to change.
 */
const requestStorage = new AsyncLocalStorage();

/**
 * Extract and store Set-Cookie headers from an Axios response.
 * Operates on the cookies map belonging to the current async context.
 */
function applySetCookies(setCookieHeaders) {
  const cookies = requestStorage.getStore();
  if (!cookies || !setCookieHeaders) return;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  headers.forEach((cookie) => {
    const [nameVal] = cookie.split(";");
    const [name, value] = nameVal.split("=");
    if (name && value) cookies[name.trim()] = value.trim();
  });
}

/**
 * Read cookies for the current async context and return a Cookie header string.
 */
function getCookies() {
  const cookies = requestStorage.getStore();
  if (!cookies) return "";
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * Step 1: Sign in with email/password via Firebase REST API
 */
async function firebaseSignIn(email, password) {
  const res = await graphqlClient.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    { email, password, returnSecureToken: true },
  );
  return res.data; // { idToken, refreshToken, localId, ... }
}

/**
 * Step 2: Get user info from MindX base API by Firebase UID
 */
async function getUserByFirebaseId(firebaseIdToken, firebaseUid) {
  try {
    const res = await graphqlClient.post(
      config.lms.baseGraphql,
      {
        operationName: "User_getByFirebaseId",
        variables: { id: firebaseUid },
        query: `query User_getByFirebaseId($id: String!) {
          User_getByFirebaseId(firebaseId: $id) {
            id
            email
            username
            firstName
            lastName
            isActive
            permissions
            __typename
          }
        }`,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseIdToken}`,
          Cookie: getCookies(),
        },
      },
    );

    applySetCookies(res.headers["set-cookie"]);

    if (res.data?.data?.User_getByFirebaseId) {
      return res.data.data.User_getByFirebaseId;
    }
  } catch (err) {
    log.info(
      "[Auth] GraphQL User_getByFirebaseId failed, falling back to decoding JWT...",
    );
  }

  // Fallback: decode JWT to extract user info
  try {
    const payloadBase64 = firebaseIdToken.split(".")[1];
    const payloadStr = Buffer.from(payloadBase64, "base64").toString("utf8");
    const payload = JSON.parse(payloadStr);

    return {
      id: payload.id || firebaseUid,
      email: payload.email,
      username: payload.username || "",
      firstName: payload.name || "",
      lastName: "",
      isActive: true,
      permissions: payload.roles || [],
    };
  } catch (decodeErr) {
    log.error("[Auth] Failed to decode JWT:", decodeErr);
    throw new Error("Cannot get user info from API or JWT.");
  }
}

/**
 * New Step 2.5: Get LMS Role Info using FindInfoInRoleById
 */
async function getTeacherIdByUserId(lmsIdToken, mindxUserId) {
  try {
    const res = await graphqlClient.post(
      config.lms.gatewayGraphql || "https://lms-api.mindx.edu.vn/",
      {
        operationName: "teacherByUserId",
        variables: { user: mindxUserId },
        query: `query teacherByUserId($user: String) {
          teacherByUserId(payload: { user: $user }) { id email fullName }
        }`,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lmsIdToken}`,
          origin: "https://lms.mindx.edu.vn",
          Cookie: getCookies(),
        },
      },
    );
    return res.data?.data?.teacherByUserId?.id || null;
  } catch (err) {
    log.info("[Auth] teacherByUserId failed:", err.message);
    return null;
  }
}

async function getLmsRoleInfo(lmsIdToken, mindxUserId) {
  try {
    const res = await graphqlClient.post(
      config.lms.gatewayGraphql || "https://lms-api.mindx.edu.vn/",
      {
        operationName: "FindInfoInRoleById",
        variables: { payload: { id: mindxUserId } },
        query: `mutation FindInfoInRoleById($payload: FindInfoInRoleByIdCommand!) {
          users { findInfoInRoleById(payload: $payload) { info role __typename } __typename }
        }`,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lmsIdToken}`,
          origin: "https://lms.mindx.edu.vn",
          Cookie: getCookies(),
        },
      },
    );

    if (res.data?.data?.users?.findInfoInRoleById) {
      return res.data.data.users.findInfoInRoleById;
    }
    return [];
  } catch (err) {
    log.info("[Auth] FindInfoInRoleById failed:", err.message);
    return [];
  }
}

/**
 * Step 3: Get custom token from base API (for LMS access)
 */
async function getCustomToken(firebaseIdToken) {
  const query = `mutation GetCustomToken { users { getCustomToken { customToken } } }`;

  try {
    const res = await graphqlClient.post(
      config.lms.baseGraphql,
      {
        operationName: "GetCustomToken",
        variables: {},
        query,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseIdToken}`,
          Cookie: getCookies(),
        },
      },
    );

    log.info(
      "[Auth] GetCustomToken response:",
      JSON.stringify(res.data, null, 2),
    );

    if (res.data.errors) {
      const error = new Error(res.data.errors[0].message);
      error.responseData = res.data;
      throw error;
    }

    applySetCookies(res.headers["set-cookie"]);

    // Try multiple paths to find customToken
    const token =
      res.data?.data?.users?.getCustomToken?.customToken ||
      res.data?.data?.getCustomToken?.customToken ||
      res.data?.data?.customToken ||
      res.data?.customToken;

    return token;
  } catch (err) {
    log.error("[Auth] GetCustomToken error response:", err.response?.data);
    throw err;
  }
}

/**
 * Step 4: Exchange custom token for Firebase ID token (LMS token)
 */
async function signInWithCustomToken(customToken) {
  const res = await graphqlClient.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
    { token: customToken, returnSecureToken: true },
  );
  return res.data; // { idToken, refreshToken, ... }
}

/**
 * Full login flow: email + password → LMS idToken + user info
 */
async function loginWithCredentials(email, password) {
  try {
    // 1. Firebase sign-in
    log.info("[Auth] Step 1: Signing in with Firebase...");
    let firebaseAuth;
    try {
      firebaseAuth = await firebaseSignIn(email, password);
    } catch (err) {
      log.error(
        "[Auth] Firebase login failed:",
        err.response?.data || err.message,
      );
      throw new Error(
        `Firebase login failed: ${err.response?.data?.error?.message || err.message}`,
      );
    }
    const { idToken: firebaseToken, localId: firebaseUid } = firebaseAuth;
    log.info("[Auth] Firebase login successful. UID:", firebaseUid);

    // 2. Get MindX user info
    log.info("[Auth] Step 2: Getting MindX user info...");
    let mindxUser;
    try {
      mindxUser = await getUserByFirebaseId(firebaseToken, firebaseUid);
    } catch (err) {
      log.error(
        "[Auth] Failed to get user info:",
        err.response?.data || err.message,
      );
      throw new Error(`Failed to get user info: ${err.message}`);
    }
    if (!mindxUser) throw new Error("Không tìm thấy tài khoản MindX");
    if (!mindxUser.isActive) throw new Error("Tài khoản đã bị vô hiệu hóa");
    log.info("[Auth] MindX user found:", mindxUser.username);

    // 3. Try to get custom token for LMS (optional - may fail without session)
    log.info("[Auth] Step 3: Trying to get custom token...");
    let lmsToken = firebaseToken; // Fallback to Firebase token
    let lmsRefreshToken = "";

    try {
      const customToken = await getCustomToken(firebaseToken);
      if (customToken) {
        log.info("[Auth] Custom token obtained, exchanging...");
        // 4. Sign in LMS with custom token
        const lmsAuth = await signInWithCustomToken(customToken);
        lmsToken = lmsAuth.idToken;
        lmsRefreshToken = lmsAuth.refreshToken;
        log.info("[Auth] LMS login with custom token successful!");
      } else {
        log.info("[Auth] Custom token empty, using Firebase token directly");
      }
    } catch (err) {
      // Check if it's the specific "No session cookie found" error
      const isSessionError =
        err.responseData?.errors?.some(
          (e) => e.message === "No session cookie found",
        ) ||
        err.response?.data?.errors?.some(
          (e) => e.message === "No session cookie found",
        ) ||
        err.message === "No session cookie found";

      if (isSessionError) {
        log.info(
          "[Auth] 'No session cookie found' detected. Using Firebase token as fallback.",
        );
      } else {
        log.info(
          "[Auth] Could not get custom token, using Firebase token directly:",
          err.message,
        );
      }
      // Continue with Firebase token - it should work for LMS API calls
    }

    // 5. Get detailed Role-Based info from LMS API
    log.info("[Auth] Step 5: Getting LMS Role Info...");
    const roleInfos = await getLmsRoleInfo(lmsToken, mindxUser.id);

    // 6. Resolve final profile & roles
    let finalProfile = resolveUserRolesAndProfile(mindxUser, roleInfos);

    // Fallback: If teacherId is null, try getting it directly
    if (!finalProfile.teacherId) {
      log.info(
        "[Auth] Step 6.5: teacherId still null, trying teacherByUserId fallback...",
      );
      const directTeacherId = await getTeacherIdByUserId(
        lmsToken,
        mindxUser.id,
      );
      if (directTeacherId) {
        log.info("[Auth] Found teacherId via fallback:", directTeacherId);
        finalProfile.teacherId = directTeacherId;
        // Also ensure Teacher role is added if it was missing but teacherId exists
        if (!finalProfile.appRoles.includes(ROLES.TEACHER)) {
          finalProfile.appRoles.push(ROLES.TEACHER);
        }
      }
    }

    if (!finalProfile.appRoles || finalProfile.appRoles.length === 0) {
      log.error(
        "[Auth] Login rejected: No valid roles resolved for user",
        mindxUser.username,
      );
      throw new Error(
        "Tài khoản của bạn không có quyền truy cập hệ thống này.",
      );
    }

    log.info("[Auth] ✅ Login successful for roles:", finalProfile.appRoles);
    return {
      lmsToken,
      lmsRefreshToken,
      mindxUser: finalProfile,
      firebaseUid,
    };
  } catch (err) {
    log.error("[Auth] Login flow error:", err.message);
    throw err;
  }
}

/**
 * Refresh LMS token using refresh token
 */
async function refreshLmsToken(refreshToken) {
  const res = await graphqlClient.post(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
    `grant_type=refresh_token&refresh_token=${refreshToken}`,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  return {
    idToken: res.data.id_token,
    refreshToken: res.data.refresh_token,
  };
}

/**
 * Full login flow via MindX username mutation
 */
async function loginWithUsernameFlow(username, password) {
  try {
    log.info(
      `[Auth] Step 1: Requesting customToken for username: ${username}...`,
    );
    const query = `mutation loginWithUsername($username: String!, $password: String!) {
  users {
    loginWithUsername(
      loginWithUsernameInput: {username: $username, password: $password}
    ) {
      customToken
      __typename
    }
    __typename
  }
}
`;
    const res = await graphqlClient.post(
      "https://base-api.mindx.edu.vn/",
      {
        operationName: "loginWithUsername",
        variables: { username, password },
        query,
      },
      {
        headers: {
          "Content-Type": "application/json",
          origin: "https://base.mindx.edu.vn",
          referer: "https://base.mindx.edu.vn/",
        },
      },
    );

    if (res.data.errors) {
      throw new Error(res.data.errors[0].message);
    }

    const customToken = res.data?.data?.users?.loginWithUsername?.customToken;
    if (!customToken) {
      throw new Error("Tài khoản hoặc mật khẩu không chính xác");
    }

    log.info(
      "[Auth] Step 2: Custom token obtained, exchanging for Firebase token...",
    );
    const lmsAuth = await signInWithCustomToken(customToken);
    const lmsToken = lmsAuth.idToken;
    const lmsRefreshToken = lmsAuth.refreshToken;
    let firebaseUid = lmsAuth.localId;

    if (!firebaseUid && lmsToken) {
      const payloadBase64 = lmsToken.split(".")[1];
      const payloadStr = Buffer.from(payloadBase64, "base64").toString("utf8");
      const payload = JSON.parse(payloadStr);
      firebaseUid = payload.sub || payload.user_id;
    }

    log.info("[Auth] Step 3: Getting MindX user info...");
    const mindxUser = await getUserByFirebaseId(lmsToken, firebaseUid);

    if (!mindxUser) throw new Error("Không tìm thấy tài khoản MindX");
    if (!mindxUser.isActive) throw new Error("Tài khoản đã bị vô hiệu hóa");
    log.info("[Auth] MindX user found:", mindxUser.username);

    log.info("[Auth] Step 4: Getting LMS Role Info...");
    const roleInfos = await getLmsRoleInfo(lmsToken, mindxUser.id);

    // 5. Resolve final profile & roles
    let finalProfile = resolveUserRolesAndProfile(mindxUser, roleInfos);

    // Fallback: If teacherId is null, try getting it directly
    if (!finalProfile.teacherId) {
      log.info(
        "[Auth] Step 5.5: teacherId still null, trying teacherByUserId fallback...",
      );
      const directTeacherId = await getTeacherIdByUserId(
        lmsToken,
        mindxUser.id,
      );
      if (directTeacherId) {
        log.info("[Auth] Found teacherId via fallback:", directTeacherId);
        finalProfile.teacherId = directTeacherId;
        if (!finalProfile.appRoles.includes(ROLES.TEACHER)) {
          finalProfile.appRoles.push(ROLES.TEACHER);
        }
      }
    }

    if (!finalProfile.appRoles || finalProfile.appRoles.length === 0) {
      log.error(
        "[Auth] Login rejected: No valid roles resolved for user",
        mindxUser.username,
      );
      throw new Error(
        "Tài khoản của bạn không có quyền truy cập hệ thống này.",
      );
    }

    log.info("[Auth] ✅ Login successful for roles:", finalProfile.appRoles);
    return {
      lmsToken,
      lmsRefreshToken,
      mindxUser: finalProfile,
      firebaseUid,
    };
  } catch (err) {
    log.error("[Auth] Username Login flow error:", err.message);
    if (err.response && err.response.data) {
      log.error(
        "[Auth] Response data:",
        JSON.stringify(err.response.data, null, 2),
      );
      const message =
        err.response.data.errors?.[0]?.message ||
        err.response.data.message ||
        err.message;
      throw new Error(`Username login failed: ${message}`);
    }
    throw err;
  }
}

module.exports = {
  loginWithCredentials,
  loginWithUsernameFlow,
  refreshLmsToken,
  firebaseSignIn,
  getCustomToken,
  signInWithCustomToken,
  requestStorage,
};
