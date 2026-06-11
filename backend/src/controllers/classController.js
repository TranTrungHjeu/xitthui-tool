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
        Hãy đóng vai một chuyên gia giáo dục STEM chuyên nghiệp đang lập Báo Cáo Đánh Giá Năng Lực Học Viên định kỳ. Bạn phải phân tích năng lực của học viên sau một cách nghiêm túc, khách quan và khoa học dựa trên số liệu thực tế:
        - Tên học viên: ${studentInfo.fullName}
        - Thống kê chuyên cần: Tổng ${attendanceTotal} buổi. Đúng giờ: ${presentCount}, Muộn: ${lateCount}, Vắng: ${absentCount}.
        - Điểm số & Bài nộp: ${JSON.stringify(scores)}
        - Nhận xét của giáo viên qua các buổi: ${JSON.stringify(comments)}

        YÊU CẦU VĂN PHONG VÀ TRÌNH BÀY:
        - Chỉ sử dụng văn phong học thuật, chuyên nghiệp, khách quan và mang tính xây dựng.
        - TUYỆT ĐỐI KHÔNG SỬ DỤNG EMOJI (biểu tượng cảm xúc như 😊, 👍, 🌟, v.v.) trong bất kỳ phần nào của báo cáo.
        - Tuyệt đối không dùng các từ ngữ quá bình dân, cảm thán hoặc mang tính trò chuyện.
        - Mỗi nhận xét cần đi thẳng vào vấn đề, đánh giá mạnh/yếu dựa trên số liệu điểm số và nhận xét của giáo viên.
        - Tránh lặp từ, sử dụng các từ ngữ mang tính sư phạm như: "Năng lực tiếp thu", "Khả năng ứng dụng", "Chỉ số chuyên cần", "Tính kỷ luật", "Kỹ năng tư duy logic".

        YÊU CẦU ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
        - Chỉ trả về duy nhất chuỗi JSON hợp lệ.
        - Không chào hỏi, không giải thích ngoài JSON.
        - Không bọc trong markdown code block. Không thêm bất kỳ ký tự nào trước hoặc sau khối JSON.
        - "score": Phải là một số nguyên hoặc số thập phân từ 1 đến 10.
        - "trend": Chỉ được chọn chính xác 1 trong 3 giá trị: "Tiến bộ", "Đi xuống", "Ổn định".

        Cấu trúc JSON bắt buộc (Lưu ý mảng criteria chứa các object tiêu chí tùy thuộc vào loại lớp học):

        Nếu dữ liệu cho thấy đây là LỚP CODING:
        {
          "criteria": [
            { "label": "Tư duy Logic", "score": 1, "analysis": "Khả năng tư duy logic, giải thuật, cách phân tích vấn đề, viết giải pháp rõ ràng.", "trend": "Tiến bộ" },
            { "label": "Thao tác máy tính, lập trình", "score": 1, "analysis": "Khả năng sử dụng cú pháp chính xác, áp dụng kiến thức lập trình vào giải quyết bài toán cụ thể.", "trend": "Tiến bộ" },
            { "label": "Thái độ học tập", "score": 1, "analysis": "Mức độ chủ động, hỏi – đáp, hợp tác nhóm, sự nỗ lực vượt khó.", "trend": "Tiến bộ" }
          ],
          "overall_progress": "Đoạn văn tóm tắt theo chuẩn 4 tiêu chí L-L-T-Đ (Logic, Lập trình, Thái độ, Đề xuất). Đánh giá sự thay đổi hiệu suất qua thời gian.",
          "suggestions": ["Cần hỗ trợ gì?", "Học sinh có tiến bộ không?", "Hướng học tiếp theo là gì (nâng cao/ôn tập)?"]
        }

        Nếu dữ liệu cho thấy đây là LỚP ROBOTICS:
        {
          "criteria": [
            { "label": "Lắp ráp", "score": 1, "analysis": "Thao tác lắp ráp, khả năng nhận diện mảnh ghép, định hình trong không gian 3D, khả năng sáng tạo.", "trend": "Tiến bộ" },
            { "label": "Lập trình", "score": 1, "analysis": "Khả năng nhận biết, ghi nhớ câu lệnh, vận dụng vào bài tập, tư duy xử lý vấn đề, thao tác với tablet/máy tính.", "trend": "Tiến bộ" },
            { "label": "Thái độ học tập", "score": 1, "analysis": "Khả năng làm việc nhóm, mức độ tập trung, mức độ lắng nghe và phản hồi GV.", "trend": "Tiến bộ" }
          ],
          "overall_progress": "Đoạn văn tóm tắt theo chuẩn 4 tiêu chí L-L-T-Đ. GV đã thực hiện những gì để hỗ trợ bạn -> kết quả như thế nào, HV cần cải thiện thêm bằng những cách nào.",
          "suggestions": ["Định hướng cho bạn như thế nào (học lại/level-up).", "Phía CS/PH cần hỗ trợ thêm những gì?"]
        }

        Nếu dữ liệu cho thấy đây là LỚP ART (Mỹ thuật):
        {
          "criteria": [
            { "label": "Kiến thức", "score": 1, "analysis": "Khả năng tiếp thu, vận dụng, ghi nhớ (bố cục, màu sắc, hình khối).", "trend": "Tiến bộ" },
            { "label": "Kỹ năng", "score": 1, "analysis": "Vẽ, sáng tạo, hoàn thiện tác phẩm, thao tác công cụ.", "trend": "Tiến bộ" },
            { "label": "Thái độ", "score": 1, "analysis": "Tập trung, hợp tác, tương tác.", "trend": "Tiến bộ" }
          ],
          "overall_progress": "Tóm tắt những điểm nổi bật trong suốt khoá học, ghi nhận cụ thể ưu điểm - hạn chế - hướng cải thiện.",
          "suggestions": ["Dặn dò & Định hướng cải thiện cụ thể."]
        }

        Lưu ý chung cho tất cả các lớp:
        - KHÔNG nhận xét chung chung. KHÔNG tâng bốc cũng KHÔNG hạ thấp HV.
        - Khen/chê rõ ràng, nếu chê phải luôn kèm theo đề xuất phương án.
        - Luôn nhận xét đủ 4 tiêu chí tương ứng vào phần đánh giá chung.
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
