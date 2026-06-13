const LMSClient = require("../services/lmsClient");

// In-memory visibility map for demonstration. Replace with persistent DB in prod.
const teacherVisibilityPrefs = {};

/**
 * POST /teachers/visibility
 * Body: { userId: string, hiddenTeacherIds: string[] }
 */
exports.saveTeacherVisibility = async (req, res) => {
  const { userId, hiddenTeacherIds } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  teacherVisibilityPrefs[userId] = {
    hiddenTeacherIds: hiddenTeacherIds || [],
    updated: Date.now(),
  };
  res.json({ success: true, preferences: teacherVisibilityPrefs[userId] });
};

/**
 * GET /teachers/visibility/:userId
 * Params: userId
 */
exports.getTeacherVisibility = async (req, res) => {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const prefs = teacherVisibilityPrefs[userId] || { hiddenTeacherIds: [] };
  res.json({ success: true, preferences: prefs });
};

exports.getTeacherSchedules = async (req, res) => {
  console.log("[Controller] getTeacherSchedules request body:", req.body);
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { teacherIds, dateGte, dateLte } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
      return res.status(400).json({ error: "teacherIds array is required" });
    }
    if (!dateGte || !dateLte) {
      return res.status(400).json({ error: "dateGte and dateLte are required" });
    }

    const client = new LMSClient(token);
    
    // Chunking to avoid overwhelming the LMS API
    const chunkSize = 5;
    const allSchedules = [];
    
    for (let i = 0; i < teacherIds.length; i += chunkSize) {
      const chunk = teacherIds.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(id => client.getTeacherSchedules(id, dateGte, dateLte).catch(err => {
        console.error(`Error fetching schedule for ${id}:`, err.message);
        return []; // Return empty array for failed fetches to continue processing others
      }));
      
      const chunkResults = await Promise.all(chunkPromises);
      chunkResults.forEach(schedules => allSchedules.push(...schedules));
    }

    res.json({ success: true, data: allSchedules });
  } catch (err) {
    console.error("[Controller] getTeacherSchedules failed:", err.message);
    res.status(200).json({
      success: false,
      data: [],
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};

exports.getTeachers = async (req, res) => {
  console.log("[Controller] getTeachers request body:", req.body);
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { centers = ["6443460f94300678908f7974"], pageIndex = 0, itemsPerPage = 100 } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });

    const client = new LMSClient(token);
    const data = await client.getTeachers(centers, pageIndex, itemsPerPage);
    
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Controller] getTeachers failed:", err.message);
    res.status(200).json({
      success: false,
      data: [],
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};