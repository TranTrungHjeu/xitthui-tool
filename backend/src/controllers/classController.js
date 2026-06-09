const LMSClient = require("../services/lmsClient");
const { VertexAI } = require("@google-cloud/vertexai");

const vertexAI = new VertexAI({
  project: process.env.VERTEX_AI_PROJECT_ID || "your-google-cloud-project-id",
  location: process.env.VERTEX_AI_LOCATION || "us-central1",
});

exports.getClasses = async (req, res) => {
  console.log("[Controller] getClasses request body:", req.body);
  try {
    // Try to get token from body or Authorization header
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { teacherId } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!teacherId)
      return res.status(400).json({ error: "Teacher ID is required" });

    const client = new LMSClient(token);
    const data = await client.getClasses(teacherId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Controller] getClasses failed:", err.message);
    console.error(
      "[Controller] LMS error response:",
      JSON.stringify(err.response?.data || {}, null, 2),
    );

    res.status(200).json({
      success: false,
      data: [],
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};

exports.getClassById = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { classId } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!classId)
      return res.status(400).json({ error: "Class ID is required" });

    const client = new LMSClient(token);
    const data = await client.getClassById(classId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Controller] getClassById failed:", err.message);
    console.error(
      "[Controller] LMS error response:",
      JSON.stringify(err.response?.data || {}, null, 2),
    );

    res.status(200).json({
      success: false,
      data: null,
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};

exports.getClassesDetails = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { classIds } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ error: "classIds is required" });
    }

    const client = new LMSClient(token);
    const data = await client.getClassesDetails(classIds);
    res.json({ success: true, data });
  } catch (err) {
    const statusCode = err.response?.status || 500;
    res.status(statusCode).json({
      success: false,
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};

exports.updateEvaluation = async (req, res) => {
  let token = req.body.token;
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1];
  }
  const { payload } = req.body;

  if (!token || !payload)
    return res.status(400).json({ error: "Token and payload are required" });
  try {
    const client = new LMSClient(token);
    const data = await client.updateEvaluation(payload);
    res.json({ success: true, data });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, error: err.response?.data || err.message });
  }
};

exports.getCourseVersion = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { classId } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!classId)
      return res.status(400).json({ error: "Class ID is required" });

    const client = new LMSClient(token);
    const data = await client.getCourseVersionByClass(classId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Controller] getCourseVersion failed:", err.message);
    res.status(200).json({
      success: false,
      data: null,
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};

exports.getSubmissions = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { classId } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!classId)
      return res.status(400).json({ error: "Class ID is required" });

    const client = new LMSClient(token);
    const data = await client.getStudentSubmissionsByClass(classId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Controller] getSubmissions failed:", err.message);
    console.error(
      "[Controller] LMS error response:",
      JSON.stringify(err.response?.data || {}, null, 2),
    );

    res.status(200).json({
      success: false,
      data: [],
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};

exports.getStudentAIReport = async (req, res) => {
  try {
    const { classId } = req.body; // get classId from body
    const { studentId } = req.body; // get studentId from body
    let token = req.body.token || req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!classId)
      return res.status(400).json({ error: "Class ID is required" });
    if (!studentId)
      return res.status(400).json({ error: "Student ID is required" });

    // Fetch necessary data
    const client = new LMSClient(token);
    const classData = await client.getClassById(classId);
    const submissionsData = await client.getStudentSubmissionsByClass(classId);

    const studentInfo = classData.students.find(
      (s) => s.student?.id === studentId,
    )?.student;
    if (!studentInfo) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Process Attendance
    const attendance = classData.slots.flatMap((slot) =>
      (slot.studentAttendance || []).filter(
        (sa) => (sa.student?.id || sa.studentId) === studentId,
      ),
    );
    const attendanceTotal = attendance.length;
    const presentCount = attendance.filter((a) =>
      ["PRESENT", "ATTENDED"].includes(a.status),
    ).length;
    const lateCount = attendance.filter((a) =>
      ["LATE", "LATE_ARRIVED"].includes(a.status),
    ).length;
    const absentCount = attendance.filter((a) =>
      ["ABSENT", "ABSENT_WITH_NOTICE"].includes(a.status),
    ).length;

    // Process Scores & Submissions
    const apiUid = req.body.rosterToApiMap?.[studentId] || studentId;
    const scores = [];
    const comments = [];

    if (submissionsData.lessons) {
      submissionsData.lessons.forEach((lesson) => {
        const sub = (submissionsData.submissions || []).find(
          (s) => s.studentUid === apiUid && s.lessonId === lesson.id,
        );
        if (sub) {
          scores.push({
            lessonName: lesson.name,
            score: sub.score,
            status: sub.status,
            type: lesson.type,
          });
        }
      });
    }

    classData.slots.forEach((slot) => {
      (slot.studentAttendance || []).forEach((sa) => {
        if ((sa.student?.id || sa.studentId) === studentId && sa.comment) {
          comments.push({
            date: slot.date,
            comment: sa.comment.replace(/<[^>]*>/g, ""),
          });
        }
      });
    });

    const prompt = `
        Hãy đóng vai một chuyên gia giáo dục STEM. Hãy phân tích năng lực của học viên sau dựa trên dữ liệu:
        - Tên học viên: ${studentInfo.fullName}
        - Thống kê chuyên cần: Tổng ${attendanceTotal} buổi. Đúng giờ: ${presentCount}, Muộn: ${lateCount}, Vắng: ${absentCount}.
        - Điểm số & Bài nộp: ${JSON.stringify(scores)}
        - Nhận xét của giáo viên qua các buổi: ${JSON.stringify(comments)}

        Yêu cầu BẮT BUỘC:
        - Chỉ trả về JSON hợp lệ.
        - Không chào hỏi.
        - Không giải thích ngoài JSON.
        - Không bọc trong markdown code block.
        - Không thêm bất kỳ chữ nào trước hoặc sau JSON.
        - Các trường "score" phải là số từ 1 đến 10.
        - Các trường "trend" chỉ được là một trong ba giá trị: "Tiến bộ", "Đi xuống", "Ổn định".

        Cấu trúc JSON bắt buộc:
        {
          "criteria": {
            "attitude": { "score": 1, "analysis": "...", "trend": "Tiến bộ" },
            "assembly": { "score": 1, "analysis": "...", "trend": "Tiến bộ" },
            "programming": { "score": 1, "analysis": "...", "trend": "Tiến bộ" }
          },
          "overall_progress": "Phân tích tổng quát quá trình phát triển",
          "suggestions": ["Đề xuất 1", "Đề xuất 2", "..."]
        }

        Hãy viết bằng tiếng Việt, phân tích sâu sắc dựa trên sự thay đổi của điểm số và nhận xét theo thời gian.
      `;

    // Tích hợp Vertex AI API với model gemini-1.5-flash
    // Lưu ý: Tên model trên Vertex AI thường có dạng: gemini-1.5-flash-001 hoặc gemini-1.5-pro-001
    const generativeModel = vertexAI.preview.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const request = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    };

    const result = await generativeModel.generateContent(request);
    const responseText = result.response.candidates[0].content.parts[0].text;

    // Parse JSON từ response của AI.
    // Vertex/Gemini đôi khi vẫn trả thêm text như "Chào bạn..." nên cần extract JSON object an toàn.
    const cleanedText = responseText
      .replace(/```json\n/g, "")
      .replace(/```\n/g, "")
      .replace(/```/g, "")
      .trim();

    const jsonStart = cleanedText.indexOf("{");
    const jsonEnd = cleanedText.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      console.error("[Controller] AI raw response:", responseText);
      throw new Error("AI response is not valid JSON");
    }

    const jsonStr = cleanedText.slice(jsonStart, jsonEnd + 1);
    const aiResult = JSON.parse(jsonStr);

    res.json({ success: true, data: aiResult });
  } catch (err) {
    console.error("[Controller] getStudentAIReport failed:", err.message);
    res.status(200).json({
      success: false,
      error: err.response?.data?.errors?.[0]?.message || err.message,
    });
  }
};
