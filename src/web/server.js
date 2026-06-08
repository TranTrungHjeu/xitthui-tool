const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const config = require("../config");
const LMSClient = require("../lms/client");
const UserSessionManager = require("../storage/userSession");
const auth = require("../lms/auth");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---- API Routes ----

// Login with credentials
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const result = await auth.loginWithCredentials(email, password);

    // Save session automatically for testing
    if (result.mindxUser && result.lmsToken) {
      const client = new LMSClient(result.lmsToken);

      // We already have MindX User ID in result.mindxUser.id
      // Try to get Teacher ID from that
      const teacherId = await client.getTeacherId(result.mindxUser.id);

      UserSessionManager.saveUserSession(
        "web_test_user",
        teacherId,
        result.lmsToken,
      );
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Login failed:", err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data?.error?.message || err.message,
    });
  }
});

// Token refresh endpoint (if token expired, tries refreshing)
app.post("/api/refresh-token", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ error: "Refresh token is required" });

  try {
    const refreshed = await auth.refreshLmsToken(refreshToken);
    res.json({
      success: true,
      lmsToken: refreshed.idToken,
      lmsRefreshToken: refreshed.refreshToken,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
});

// Test connection to LMS and get profile
app.post("/api/test-token", async (req, res) => {
  const { token, userId } = req.body;
  if (!token) return res.status(400).json({ error: "Token is required" });

  try {
    const client = new LMSClient(token);
    const teacherId = await client.getTeacherId(userId);

    // Also try to get basic info
    const query = `query GetProfile($id: String!) { User_getById(id: $id) { id email firstName lastName givenName username isActive } }`;
    const profileRes = await axios.post(
      config.lms.baseGraphql,
      {
        operationName: "GetProfile",
        query,
        variables: { id: userId },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    res.json({
      success: true,
      teacherId,
      profile: profileRes.data.data?.User_getById,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
});

// Get teacher classes
app.post("/api/classes", async (req, res) => {
  const { token, teacherId } = req.body;
  if (!token) return res.status(400).json({ error: "Token is required" });

  try {
    const client = new LMSClient(token);
    const data = await client.getClasses(teacherId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
});

// Update evaluation
app.post("/api/update-evaluation", async (req, res) => {
  const { token, payload } = req.body;
  if (!token || !payload) {
    return res.status(400).json({ error: "Token and payload are required" });
  }

  try {
    const client = new LMSClient(token);
    const data = await client.updateEvaluation(payload);
    res.json({ success: true, data });
  } catch (err) {
    console.error("Update evaluation failed:", err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
});

// Custom GraphQL query (for testing)
app.post("/api/raw-graphql", async (req, res) => {
  const { token, operationName, query, variables } = req.body;
  if (!token || !query)
    return res.status(400).json({ error: "Token and query are required" });

  try {
    const client = new LMSClient(token);
    const data = await client.query(
      operationName || "Query",
      query,
      variables || {},
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
});

// Sessions management
app.get("/api/sessions", (req, res) => {
  const sessions = UserSessionManager.getAllSessions();
  const sanitized = {};
  for (const [id, s] of Object.entries(sessions)) {
    sanitized[id] = {
      lmsUserId: s.lmsUserId,
      createdAt: s.createdAt,
      tokenPreview: s.token ? s.token.substring(0, 20) + "..." : "N/A",
    };
  }
  res.json({ success: true, data: sanitized });
});

// Serve UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

module.exports = app;
