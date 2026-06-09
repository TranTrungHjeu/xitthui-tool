const axios = require("axios");
const config = require("../config/index");

// Firebase project config extracted from config
const FIREBASE_API_KEY = config.firebase.apiKey;

// Simple cookie store
const cookies = {};

function setCookie(name, value) {
  cookies[name] = value;
}

function getCookies() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * Step 1: Sign in with email/password via Firebase REST API
 */
async function firebaseSignIn(email, password) {
  const res = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    { email, password, returnSecureToken: true },
  );
  return res.data; // { idToken, refreshToken, localId, ... }
}

/**
 * Step 2: Get user info from MindX base API by Firebase UID
 */
async function getUserByFirebaseId(firebaseIdToken, firebaseUid) {
  const res = await axios.post(
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

  // Store cookies from response
  const setCookieHeaders = res.headers["set-cookie"];
  if (setCookieHeaders) {
    if (Array.isArray(setCookieHeaders)) {
      setCookieHeaders.forEach((cookie) => {
        const [nameVal] = cookie.split(";");
        const [name, value] = nameVal.split("=");
        if (name && value) setCookie(name, value);
      });
    }
  }

  return res.data?.data?.User_getByFirebaseId;
}

/**
 * Step 3: Get custom token from base API (for LMS access)
 */
async function getCustomToken(firebaseIdToken) {
  const query = `mutation GetCustomToken { users { getCustomToken { customToken } } }`;

  try {
    const res = await axios.post(
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

    console.log(
      "[Auth] GetCustomToken response:",
      JSON.stringify(res.data, null, 2),
    );

    if (res.data.errors) {
      const error = new Error(res.data.errors[0].message);
      error.responseData = res.data;
      throw error;
    }

    // Store cookies from response
    const setCookieHeaders = res.headers["set-cookie"];
    if (setCookieHeaders) {
      if (Array.isArray(setCookieHeaders)) {
        setCookieHeaders.forEach((cookie) => {
          const [nameVal] = cookie.split(";");
          const [name, value] = nameVal.split("=");
          if (name && value) setCookie(name, value);
        });
      }
    }

    // Try multiple paths to find customToken
    const token =
      res.data?.data?.users?.getCustomToken?.customToken ||
      res.data?.data?.getCustomToken?.customToken ||
      res.data?.data?.customToken ||
      res.data?.customToken;

    return token;
  } catch (err) {
    console.error("[Auth] GetCustomToken error response:", err.response?.data);
    throw err;
  }
}

/**
 * Step 4: Exchange custom token for Firebase ID token (LMS token)
 */
async function signInWithCustomToken(customToken) {
  const res = await axios.post(
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
    console.log("[Auth] Step 1: Signing in with Firebase...");
    let firebaseAuth;
    try {
      firebaseAuth = await firebaseSignIn(email, password);
    } catch (err) {
      console.error(
        "[Auth] Firebase login failed:",
        err.response?.data || err.message,
      );
      throw new Error(
        `Firebase login failed: ${err.response?.data?.error?.message || err.message}`,
      );
    }
    const { idToken: firebaseToken, localId: firebaseUid } = firebaseAuth;
    console.log("[Auth] Firebase login successful. UID:", firebaseUid);

    // 2. Get MindX user info
    console.log("[Auth] Step 2: Getting MindX user info...");
    let mindxUser;
    try {
      mindxUser = await getUserByFirebaseId(firebaseToken, firebaseUid);
    } catch (err) {
      console.error(
        "[Auth] Failed to get user info:",
        err.response?.data || err.message,
      );
      throw new Error(`Failed to get user info: ${err.message}`);
    }
    if (!mindxUser) throw new Error("Không tìm thấy tài khoản MindX");
    if (!mindxUser.isActive) throw new Error("Tài khoản đã bị vô hiệu hóa");
    console.log("[Auth] MindX user found:", mindxUser.username);

    // 3. Try to get custom token for LMS (optional - may fail without session)
    console.log("[Auth] Step 3: Trying to get custom token...");
    let lmsToken = firebaseToken; // Fallback to Firebase token
    let lmsRefreshToken = "";

    try {
      const customToken = await getCustomToken(firebaseToken);
      if (customToken) {
        console.log("[Auth] Custom token obtained, exchanging...");
        // 4. Sign in LMS with custom token
        const lmsAuth = await signInWithCustomToken(customToken);
        lmsToken = lmsAuth.idToken;
        lmsRefreshToken = lmsAuth.refreshToken;
        console.log("[Auth] LMS login with custom token successful!");
      } else {
        console.log("[Auth] Custom token empty, using Firebase token directly");
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
        console.log(
          "[Auth] 'No session cookie found' detected. Using Firebase token as fallback.",
        );
      } else {
        console.log(
          "[Auth] Could not get custom token, using Firebase token directly:",
          err.message,
        );
      }
      // Continue with Firebase token - it should work for LMS API calls
    }

    console.log("[Auth] ✅ Login successful!");
    return {
      lmsToken,
      lmsRefreshToken,
      mindxUser,
      firebaseUid,
    };
  } catch (err) {
    console.error("[Auth] Login flow error:", err.message);
    throw err;
  }
}

/**
 * Refresh LMS token using refresh token
 */
async function refreshLmsToken(refreshToken) {
  const res = await axios.post(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
    `grant_type=refresh_token&refresh_token=${refreshToken}`,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  return {
    idToken: res.data.id_token,
    refreshToken: res.data.refresh_token,
  };
}

module.exports = {
  loginWithCredentials,
  refreshLmsToken,
  firebaseSignIn,
  getCustomToken,
  signInWithCustomToken,
};
