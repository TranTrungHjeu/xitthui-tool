const lmsAuth = require("../services/lmsAuth");
const LMSClient = require("../services/lmsClient");

exports.login = async (req, res) => {
  let { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Nếu có chứa @ thì đăng nhập theo luồng email, ngược lại theo luồng username
    const result = email.includes('@')
      ? await lmsAuth.loginWithCredentials(email, password)
      : await lmsAuth.loginWithUsernameFlow(email, password);

    let teacherId = null;
    let profile = null;
    let teacher = null;

    if (result.mindxUser && result.lmsToken) {
      try {
        const client = new LMSClient(result.lmsToken);
        teacher = await client.getTeacherByUserId(result.mindxUser.id);
        teacherId = teacher?.id || null;
        profile = await client.getProfile(result.mindxUser.id);
      } catch (e) {
        console.error(
          "[Auth] Error fetching additional teacher info:",
          e.message,
        );
      }
    }

    res.json({
      success: true,
      data: {
        ...result,
        teacherId,
        teacher,
        profile,
        mindxUser: {
          ...result.mindxUser,
          firstName: profile?.firstName || result.mindxUser?.firstName,
          lastName: profile?.lastName || result.mindxUser?.lastName,
          username: profile?.username || result.mindxUser?.username,
          givenName: profile?.givenName || result.mindxUser?.givenName,
          fullName: teacher?.fullName || result.mindxUser?.fullName,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.response?.data?.error?.message || err.message,
    });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is required" });
  }
  try {
    const refreshed = await lmsAuth.refreshLmsToken(refreshToken);
    res.json({
      success: true,
      lmsToken: refreshed.idToken,
      lmsRefreshToken: refreshed.refreshToken,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, error: err.response?.data || err.message });
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
