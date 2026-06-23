const { v4: uuidv4 } = require("uuid");
const lmsAuth = require("../services/lmsAuth");
const LMSClient = require("../services/lmsClient");
const FirestoreNotification = require("../storage/notificationStorage");
const FirestoreSession = require("../storage/sessionStorage");

exports.login = async (req, res) => {
  let { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
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
          console.warn("[Auth] No teacher record found:", e.message);
        }

        profile = await client.getProfile(result.mindxUser.id);

        // Lưu active token để dùng cho background job
        roles = result.mindxUser.roles || [];
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
        console.error(
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
      },
    };

    // Loại bỏ lmsRefreshToken gốc khỏi response để tăng bảo mật
    delete responseData.lmsRefreshToken;

    res.json({
      success: true,
      data: responseData,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.response?.data?.error?.message || err.message,
    });
  }
};

exports.refreshToken = async (req, res) => {
  const { sessionId } = req.body;

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

    res.json({
      success: true,
      lmsToken: refreshed.idToken,
      // Trả lại sessionId cho client để giữ tính nhất quán
      sessionId: sessionId,
    });
  } catch (err) {
    console.error("[Auth] Refresh token error:", err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
};

exports.logout = async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    await FirestoreSession.revokeSession(sessionId);
    res.json({
      success: true,
      message: "Successfully logged out",
    });
  } catch (err) {
    console.error("[Auth] Logout error:", err.message);
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
    let teacherId = null;
    try {
      teacherId = await client.getTeacherId(userId);
    } catch (e) {
      // Suppress warning
    }

    const profileRes = await client.getProfile(userId);

    res.json({
      success: true,
      teacherId,
      profile: profileRes,
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};
