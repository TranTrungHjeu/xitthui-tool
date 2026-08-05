/**
 * Class AI Report Controller
 * Handles AI-generated student evaluation reports via Vertex AI.
 */

const { vertexAI, LMSClient, log } = require("./_shared");
const { isLmsAuthError } = require("../../utils/authError");

exports.getStudentAIReport = async (req, res) => {
  try {
    const { classId } = req.body;
    const { studentId } = req.body;
    let token = req.body.token || req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!classId) return res.status(400).json({ error: "Class ID is required" });
    if (!studentId) return res.status(400).json({ error: "Student ID is required" });

    const client = new LMSClient(token);
    const classData = await client.getClassById(classId);
    const submissionsData = await client.getStudentSubmissionsByClass(classId);

    const studentInfo = classData.students.find(
      (s) => s.student?.id === studentId,
    )?.student;
    if (!studentInfo) return res.status(404).json({ error: "Student not found" });

    const attendance = classData.slots.flatMap((slot) =>
      (slot.studentAttendance || []).filter((sa) => (sa.student?.id || sa.studentId) === studentId),
    );
    const attendanceTotal = attendance.length;
    const presentCount = attendance.filter((a) => ["PRESENT", "ATTENDED"].includes(a.status)).length;
    const lateCount = attendance.filter((a) => ["LATE", "LATE_ARRIVED"].includes(a.status)).length;
    const absentCount = attendance.filter((a) => ["ABSENT", "ABSENT_WITH_NOTICE"].includes(a.status)).length;

    const apiUid = req.body.rosterToApiMap?.[studentId] || studentId;
    const scores = [];
    if (submissionsData.lessons) {
      submissionsData.lessons.forEach((lesson) => {
        const sub = (submissionsData.submissions || []).find(
          (s) => s.studentUid === apiUid && s.lessonId === lesson.id,
        );
        if (sub) {
          scores.push({ lessonName: lesson.name, score: sub.score, status: sub.status, type: lesson.type });
        }
      });
    }

    const comments = [];
    classData.slots.forEach((slot) => {
      (slot.studentAttendance || []).forEach((sa) => {
        if ((sa.student?.id || sa.studentId) === studentId && sa.comment) {
          comments.push({ date: slot.date, comment: sa.comment.replace(/<[^>]*>/g, "") });
        }
      });
    });

    const prompt = `
      Hãy đóng vai một chuyên gia giáo dục STEM chuyên nghiệp đang lập Báo Cáo Đánh Giá Năng Lực Học Viên định kỳ. Phân tích năng lực của học viên:
      - Tên: ${studentInfo.fullName}
      - Chuyên cần: Tổng ${attendanceTotal} buổi. Đúng giờ: ${presentCount}, Muộn: ${lateCount}, Vắng: ${absentCount}.
      - Điểm số & Bài nộp: ${JSON.stringify(scores)}
      - Nhận xét GV: ${JSON.stringify(comments)}
      YÊU CẦU:
      - Văn phong học thuật, chuyên nghiệp, KHÔNG SỬ DỤNG EMOJI.
      - Chỉ trả về JSON hợp lệ duy nhất.
      - Không bọc trong markdown code block.
      - "score" phải là số từ 1 đến 10.
      - "trend" chỉ: "Tiến bộ", "Đ xuống", hoặc "Ổn định".
    `;

    const generativeModel = vertexAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    let rawText = response.text().trim();

    rawText = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      log.warn("[AIReport] JSON parse failed, returning raw text:", rawText.substring(0, 100));
      return res.json({
        success: true,
        data: { raw: rawText, parseError: parseErr.message },
      });
    }

    res.json({
      success: true,
      data: {
        student: studentInfo,
        attendance: { total: attendanceTotal, present: presentCount, late: lateCount, absent: absentCount },
        scores,
        comments,
        aiReport: parsed,
      },
    });
  } catch (err) {
    log.error("[Controller] getStudentAIReport failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
};
