const { v4: uuidv4 } = require("uuid");
const lmsAuth = require("../services/lmsAuth");
const { requestStorage } = require("../services/lmsAuth");
const LMSClient = require("../services/lmsClient");
const FirestoreNotification = require("../storage/notificationStorage");
const FirestoreSession = require("../storage/sessionStorage");
const { isSpecialAccount } = require("../utils/roleUtils");
const {
  buildAuthCookieHeaders,
  buildClearCookieHeaders,
} = require("../middleware/cookieAuth");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("AuthController");

/**
 * Map a thrown error from `performLogin` (or any downstream LMS /
 * Firebase call) to a structured `{ status, code, message }` triple
 * that the client can route to the right `AlertModal` variant.
 *
 * Codes are deliberately short and stable so the frontend can
 * switch on them without depending on the human-readable Vietnamese
 * message strings.
 */
function classifyLoginError(err) {
  const raw =
    err.response?.data?.error?.message ||
    err.response?.data?.errors?.[0]?.message ||
    err.message ||
    "Unknown error";

  const lower = String(raw).toLowerCase();

  // 1. Upstream unreachable / network failure: axios sets `code` to
  //    one of these when the request never reached the server.
  if (
    err.code === "ECONNABORTED" ||
    err.code === "ETIMEDOUT" ||
    err.code === "ENOTFOUND" ||
    err.code === "ENETUNREACH" ||
    err.code === "ECONNREFUSED"
  ) {
    return {
      status: 503,
      code: "service_unavailable",
      message:
        "Không thể kết nối tới máy chủ đăng nhập. Vui lòng kiểm tra mạng và thử lại.",
    };
  }

  // 2. Firebase says the email/password is wrong or the user has been
  //    disabled / quota exhausted. Different translations exist
  //    ("INVALID_PASSWORD", "EMAIL_NOT_FOUND", "USER_DISABLED") so we
  //    match the substring.
  if (
    lower.includes("invalid-password") ||
    lower.includes("invalid password") ||
    lower.includes("email-not-found") ||
    lower.includes("email not found") ||
    lower.includes("wrong-password") ||
    lower.includes("wrong password")
  ) {
    return {
      status: 401,
      code: "invalid_credentials",
      message: "Email hoặc mật khẩu không chính xác.",
    };
  }
  if (
    lower.includes("user-disabled") ||
    lower.includes("user disabled") ||
    lower.includes("tài khoản đã bị vô hiệu hóa")
  ) {
    return {
      status: 403,
      code: "user_disabled",
      message:
        "Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
    };
  }
  if (
    lower.includes("không tìm thấy tài khoản mindx") ||
    lower.includes("user not found") ||
    lower.includes("cannot get user info from api or jwt")
  ) {
    return {
      status: 404,
      code: "user_not_found",
      message:
        "Không tìm thấy tài khoản MindX gắn với email này. Vui lòng kiểm tra lại hoặc liên hệ quản trị viên.",
    };
  }
  if (lower.includes("tài khoản hoặc mật khẩu không chính xác")) {
    return {
      status: 401,
      code: "invalid_credentials",
      message: "Email hoặc mật khẩu không chính xác.",
    };
  }
  if (
    lower.includes("too-many-requests") ||
    lower.includes("too many requests")
  ) {
    return {
      status: 429,
      code: "rate_limited",
      message:
        "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.",
    };
  }
  if (
    lower.includes("không có quyền truy cập") ||
    lower.includes("không có quyền")
  ) {
    return {
      status: 403,
      code: "no_access",
      message:
        "Tài khoản của bạn không có quyền truy cập hệ thống này. Vui lòng liên hệ quản trị viên để được cấp quyền.",
    };
  }

  // 3. Firebase/LMS upstream returned a 5xx — propagate as
  //    service_unavailable rather than generic 500.
  const upstreamStatus = err.response?.status;
  if (typeof upstreamStatus === "number" && upstreamStatus >= 500) {
    return {
      status: 503,
      code: "service_unavailable",
      message:
        "Hệ thống đăng nhập tạm thời không khả dụng. Vui lòng thử lại sau ít phút.",
    };
  }

  // 4. Fallback — internal_error. Don't echo the raw Vietnamese /
  //    English message to the client because it may include Firebase
  //    internals the end-user shouldn't see.
  log.error("[Auth] Unclassified login error:", raw);
  return {
    status: 500,
    code: "internal_error",
    message: "Đăng nhập thất bại do lỗi hệ thống. Vui lòng thử lại sau.",
  };
}

// ---- Dev-only credentials removed ----
// The dev-login flow (username-only quick login) has been removed. All
// callers must go through the standard `/login` endpoint with email + 
// password.

/**
 * Core login flow shared by /login.
 * Throws on auth/credential failures; caller decides HTTP status.
 */
async function performLogin(email, password, req) {
  // Nếu có chứa @ thì đăng nhập theo luồng email, ngược lại theo luồng username
  const result = email.includes("@")
    ? await lmsAuth.loginWithCredentials(email, password)
    : await lmsAuth.loginWithUsernameFlow(email, password);

  let teacherId = null;
  let profile = null;
  let teacher = null;
  let centreIds = [];
  let roles = [];

  if (result.mindxUser && result.lmsToken) {
    try {
      const client = new LMSClient(result.lmsToken);
      try {
        teacher = await client.getTeacherByUserId(result.mindxUser.id);
        teacherId = teacher?.id || null;
      } catch (e) {
        log.warn("[Auth] No teacher record found:", e.message);
      }

      profile = await client.getProfile(result.mindxUser.id);

      // Lưu active token để dùng cho background job
      // Use the *resolved* `appRoles` (after roleResolver), not the raw
      // LMS `roles` field — for special accounts (e.g. `thekhiem`)
      // `result.mindxUser.roles` is empty even though the user is a
      // legitimate TE. Storing the resolved list keeps session-based
      // authorization (`requireRole`) working.
      roles = result.mindxUser.appRoles || result.mindxUser.roles || [];
      centreIds =
        teacher?.centres?.map((c) => (typeof c === "object" ? c.id : c)) ||
        [];
      await FirestoreNotification.saveActiveToken(
        teacherId || result.mindxUser.id,
        result.lmsToken,
        centreIds,
        roles,
      );

      // DO NOT override teacherCentres with all centres for TE.
      // roleResolver.js already sets the correct teacherCentres based on RoleInfo or custom rules.
    } catch (e) {
      log.error(
        "[Auth] Error fetching additional teacher info:",
        e.message,
      );
    }
  }

  // Tạo centralized session lưu vào Firestore
  const sessionId = uuidv4();
  await FirestoreSession.createSession({
    sessionId,
    userId: result.mindxUser.id,
    teacherId,
    lmsRefreshToken: result.lmsRefreshToken || "",
    userAgent: req.headers["user-agent"] || "unknown",
    centreIds,
    roles,
  });

  // Trả về sessionId thay vì lmsRefreshToken gốc
  // Compute the special-account flag from the resolved profile so the frontend
  // has a single source of truth instead of duplicating the check (see
  // frontend/src/lib/utils.ts isKhiemAccount / isActualKhiemAccount).
  const specialFlag = isSpecialAccount(result.mindxUser);
  log.info("[Auth] Special account flag for login: %s", specialFlag);
  const responseData = {
    ...result,
    teacherId,
    teacher,
    profile,
    sessionId, // thay thế cho lmsRefreshToken
    mindxUser: {
      ...result.mindxUser,
      firstName: profile?.firstName || result.mindxUser?.firstName,
      lastName: profile?.lastName || result.mindxUser?.lastName,
      username: profile?.username || result.mindxUser?.username,
      givenName: profile?.givenName || result.mindxUser?.givenName,
      fullName: teacher?.fullName || result.mindxUser?.fullName,
      isSpecialAccount: specialFlag,
    },
  };

  // Loại bỏ lmsRefreshToken gốc khỏi response để tăng bảo mật
  delete responseData.lmsRefreshToken;

  return responseData;
}

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      code: "missing_credentials",
      error: "Email and password are required",
    });
  }

  try {
    const responseData = await requestStorage.run({}, () => performLogin(email, password, req));
    // Set httpOnly auth cookies so the FE no longer needs to inject the
    // LMS token into request bodies. The body below is kept for the
    // dev-login / mobile cases that still want to read the token once.
    const cookies = buildAuthCookieHeaders(
      responseData.lmsToken,
      responseData.sessionId,
    );
    cookies.forEach((c) => res.append("Set-Cookie", c));
    res.json({ success: true, data: responseData });
  } catch (err) {
    const { status, code, message } = classifyLoginError(err);
    res.status(status).json({ success: false, code, error: message });
  }
};

exports.refreshToken = async (req, res) => {
  // Prefer the cookie-based sessionId; fall back to the body for clients
  // that haven't migrated yet (e.g. internal jobs).
  const sessionId = req.sessionId || req.body?.sessionId;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    // 1. Kiểm tra session từ Firestore
    const session = await FirestoreSession.getSession(sessionId);
    if (!session || !session.isValid) {
      return res.status(401).json({
        success: false,
        error: "Session is invalid or has been revoked",
      });
    }

    if (!session.lmsRefreshToken) {
      return res.status(401).json({
        success: false,
        error: "No refresh token associated with this session",
      });
    }

    // 2. Refresh token qua Firebase
    const refreshed = await lmsAuth.refreshLmsToken(session.lmsRefreshToken);

    // 3. Cập nhật lmsRefreshToken mới vào Firestore session
    await FirestoreSession.updateSession(sessionId, {
      lmsRefreshToken: refreshed.refreshToken,
    });

    // 4. Đồng bộ active token mới của user vào Firestore để các task chạy nền nếu có dùng thì dùng
    await FirestoreNotification.saveActiveToken(
      session.teacherId || session.userId,
      refreshed.idToken,
      session.centreIds || [],
      session.roles || [],
    );

    // Rotate the httpOnly cookie too so the FE keeps the new token.
    const cookies = buildAuthCookieHeaders(refreshed.idToken, sessionId);
    cookies.forEach((c) => res.append("Set-Cookie", c));

    res.json({
      success: true,
      lmsToken: refreshed.idToken,
      // Trả lại sessionId cho client để giữ tính nhất quán
      sessionId: sessionId,
    });
  } catch (err) {
    log.error("[Auth] Refresh token error:", err.message);
    const errorMessage =
      (typeof err.response?.data === "string" ? err.response.data : null) ||
      err.response?.data?.error?.message ||
      err.response?.data?.error ||
      err.message ||
      "";

    const isAuthError = [
      "invalid_grant",
      "TOKEN_EXPIRED",
      "session revoked",
      "Refresh Token Expired",
    ].some((marker) => errorMessage.toLowerCase().includes(marker.toLowerCase()));

    if (isAuthError) {
      return res.status(401).json({
        success: false,
        error: "Session expired. Please login again.",
      });
    }

    if (!err.response) {
      return res.status(503).json({
        success: false,
        error: "Service unavailable. Please try again.",
      });
    }

    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
};

exports.logout = async (req, res) => {
  const sessionId = req.sessionId || req.body?.sessionId;

  if (!sessionId) {
    // Even without a session, clear the cookies so the browser stops
    // sending them on subsequent requests.
    const cookies = buildClearCookieHeaders();
    cookies.forEach((c) => res.append("Set-Cookie", c));
    return res.json({
      success: true,
      message: "Successfully logged out (no session)",
    });
  }

  try {
    await FirestoreSession.revokeSession(sessionId);
    const cookies = buildClearCookieHeaders();
    cookies.forEach((c) => res.append("Set-Cookie", c));
    res.json({
      success: true,
      message: "Successfully logged out",
    });
  } catch (err) {
    log.error("[Auth] Logout error:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.testToken = async (req, res) => {
  const { token, userId } = req.body;
  if (!token) return res.status(400).json({ error: "Token is required" });

  try {
    const client = new LMSClient(token);
    await client.getProfile(userId);

    res.json({ success: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};
