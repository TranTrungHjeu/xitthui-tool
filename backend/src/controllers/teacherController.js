const LMSClient = require("../services/lmsClient");
const { getSessionExamType } = require("../utils/courseConfig");

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
      return res
        .status(400)
        .json({ error: "dateGte and dateLte are required" });
    }

    const client = new LMSClient(token);

    console.log(
      `[Controller] Fetching schedules in batch for ${teacherIds.length} teachers...`,
    );
    const allSchedules = await client.getTeacherSchedulesBatch(
      teacherIds,
      dateGte,
      dateLte,
    );

    // Lấy danh sách classId duy nhất để gọi API lấy thông tin buổi (slots.index) chính xác
    const uniqueClassIds = new Set();
    allSchedules.forEach((s) => {
      if (s.type === "CLASS_SESSION" && s.classSite?.class?.id) {
        uniqueClassIds.add(s.classSite.class.id);
      }
    });

    const classDetailsMap = new Map();
    await Promise.all(
      Array.from(uniqueClassIds).map(async (classId) => {
        try {
          const details = await client.getClassById(classId);
          if (details) {
            classDetailsMap.set(classId, details);
          }
        } catch (err) {
          console.error(
            `[Controller] Failed to fetch class details for ${classId} in getTeacherSchedules:`,
            err.message,
          );
        }
      }),
    );

    // Cập nhật title cho các CLASS_SESSION để hiển thị chính xác số buổi học
    allSchedules.forEach((s) => {
      if (s.type === "CLASS_SESSION" && s.classSite?.class?.name) {
        const className = s.classSite.class.name;
        const classId = s.classSite.class.id;

        let sessionInfo = "";
        let computedSession = null;

        if (classId) {
          const classDetails = classDetailsMap.get(classId);
          if (classDetails && classDetails.slots) {
            const slot = classDetails.slots.find(
              (slot) =>
                slot.startTime === s.startTime && slot.endTime === s.endTime,
            );
            if (slot && typeof slot.index === "number") {
              // API trả về index bắt đầu từ 0 (0-based)
              computedSession = slot.index + 1;
            }
          }
        }

        if (computedSession !== null) {
          const examType = getSessionExamType(className, computedSession);
          if (examType === "checkpoint1") sessionInfo = "Checkpoint 1";
          else if (examType === "checkpoint2") sessionInfo = "Checkpoint 2";
          else if (examType === "demo") sessionInfo = "Demo";
          else {
            sessionInfo = `Buổi ${computedSession}`;
          }
        }

        if (sessionInfo) {
          s.title = `${className} - ${sessionInfo}`;
        }
      }
    });

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
    const {
      centers = ["6443460f94300678908f7974"],
      pageIndex = 0,
      itemsPerPage = 100,
    } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });

    const client = new LMSClient(token);
    const result = await client.getTeachers(centers, pageIndex, itemsPerPage);

    res.json({
      success: true,
      data: result.data || [],
      pagination: result.pagination || { total: 0 },
    });
  } catch (err) {
    console.error("[Controller] getTeachers failed:", err.message);
    res.status(200).json({
      success: false,
      data: [],
      pagination: { total: 0 },
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};
