const LMSClient = require("../services/lmsClient");
const ClassCacheService = require("../services/classCache");
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
    const {
      teacherId,
      centreIds,
      roles,
      statusIn,
      page = 1,
      limit = 10,
      search = "",
      centre = "all",
      weekday = "all",
      role = "all",
      userName = "",
      status = "all",
    } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!teacherId)
      return res.status(400).json({ error: "Teacher ID is required" });

    // Lấy toàn bộ danh sách lớp (sử dụng cache)
    const allEnrichedClasses = await ClassCacheService.getEnrichedClasses(
      token,
      teacherId,
      centreIds,
      roles,
      statusIn,
    );

    // Áp dụng filters và phân trang tại Server
    const paginatedResult = ClassCacheService.applyFiltersAndPagination(
      allEnrichedClasses,
      {
        page,
        limit,
        search,
        centre,
        weekday,
        role,
        userName,
        teacherId,
        status,
      },
    );

    res.json({
      success: true,
      data: paginatedResult.data,
      meta: paginatedResult.meta,
    });
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

const classDetailsCache = new Map();
const CLASS_DETAILS_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory cache cho Notifications (chứa danh sách feedback đã tính toán)
const notificationCache = new Map();
const NOTIFICATION_CACHE_TTL = 5 * 60 * 1000; // 5 phút

// Caches cho từng class cụ thể khi load Notifications, giúp load nhanh hơn đáng kể
const classNotificationDetailsCache = new Map();
const CLASS_NOTIF_DETAILS_TTL = 30 * 60 * 1000; // 30 phút

exports.getClassById = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { classId, noCache } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!classId)
      return res.status(400).json({ error: "Class ID is required" });

    const now = Date.now();
    if (!noCache) {
      const cached = classDetailsCache.get(classId);
      if (cached && cached.expiresAt > now) {
        console.log(
          `[Cache] Trả về class details từ cache cho lớp: ${classId}`,
        );
        return res.json({ success: true, data: cached.data });
      }
    }

    const client = new LMSClient(token);
    const data = await client.getClassById(classId);

    if (data && data.id) {
      classDetailsCache.set(data.id, {
        data,
        expiresAt: Date.now() + CLASS_DETAILS_TTL,
      });
    }

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
    const { classIds, noCache } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ error: "classIds is required" });
    }

    const results = [];
    const missingIds = [];
    const now = Date.now();

    if (!noCache) {
      classIds.forEach((id) => {
        const cached = classDetailsCache.get(id);
        if (cached && cached.expiresAt > now) {
          results.push(cached.data);
        } else {
          missingIds.push(id);
        }
      });
    } else {
      missingIds.push(...classIds);
    }

    if (missingIds.length > 0) {
      const client = new LMSClient(token);
      const fetchedData = await client.getClassesDetails(missingIds);

      fetchedData.forEach((item) => {
        if (item && item.id) {
          classDetailsCache.set(item.id, {
            data: item,
            expiresAt: Date.now() + CLASS_DETAILS_TTL,
          });
          results.push(item);
        }
      });
    }

    res.json({ success: true, data: results });
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

    // Xoá cache để người dùng thấy cập nhật ngay lập tức
    if (payload.classId) {
      classDetailsCache.delete(payload.classId);
      classNotificationDetailsCache.delete(payload.classId);
      notificationCache.clear();
    }

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

        Căn cứ vào Môn Học (Tên khóa học: ${classData.course?.name || "Không rõ"}), bạn hãy chọn ĐÚNG bộ tiêu chí dưới đây để xuất JSON:

        NẾU LÀ LỚP CODING (Lập trình phần mềm, Web, App...):
        {
          "criteria": [
            { "label": "Tư duy Logic (L)", "score": 1, "analysis": "Đánh giá khả năng tư duy logic, giải thuật, cách phân tích vấn đề, viết giải pháp rõ ràng.", "trend": "Tiến bộ" },
            { "label": "Thao tác máy tính, Lập trình (T)", "score": 1, "analysis": "Đánh giá khả năng sử dụng cú pháp chính xác, áp dụng kiến thức lập trình vào giải quyết bài toán cụ thể.", "trend": "Tiến bộ" },
            { "label": "Thái độ học tập (T)", "score": 1, "analysis": "Đánh giá mức độ chủ động, hỏi – đáp, hợp tác nhóm, sự nỗ lực vượt khó.", "trend": "Tiến bộ" }
          ],
          "overall_progress": "Nhận xét những vấn đề nổi trội nhất trong quá trình học. KHÔNG nói chung chung, phải chỉ đích danh vấn đề. Ví dụ: 'Con phối hợp tốt nhưng phần lập trình chưa tập trung...'",
          "suggestions": [
            "Đề xuất/Phương án hỗ trợ (Đ): Cần hỗ trợ gì?",
            "Hướng học tiếp theo là gì (nâng cao/ôn tập)?",
            "KẾT LUẬN: Lộ trình phù hợp cho học viên."
          ]
        }

        NẾU LÀ LỚP ROBOTICS (Có liên quan lắp ráp, Arduino, robot):
        {
          "criteria": [
            { "label": "Lắp ráp (L)", "score": 1, "analysis": "Đánh giá thao tác lắp ráp, khả năng nhận diện mảnh ghép, định hình trong không gian 3D, khả năng sáng tạo.", "trend": "Tiến bộ" },
            { "label": "Lập trình (L)", "score": 1, "analysis": "Đánh giá khả năng nhận biết, ghi nhớ câu lệnh, vận dụng vào bài tập, tư duy xử lý vấn đề, thao tác với tablet/máy tính.", "trend": "Tiến bộ" },
            { "label": "Thái độ học tập (T)", "score": 1, "analysis": "Đánh giá khả năng làm việc nhóm, mức độ tập trung, mức độ lắng nghe và phản hồi GV.", "trend": "Tiến bộ" }
          ],
          "overall_progress": "Nhận xét tổng hợp. GV đã thực hiện những gì để hỗ trợ bạn -> kết quả như thế nào. HV cần cải thiện thêm bằng những cách nào.",
          "suggestions": [
            "Đề xuất/Phương án hỗ trợ (Đ): Định hướng cho bạn như thế nào (học lại/level-up)?",
            "Phía CS/PH cần hỗ trợ thêm những gì?"
          ]
        }

        NẾU LÀ LỚP ART (Mỹ thuật, Vẽ, Thiết kế đồ hoạ):
        {
          "criteria": [
            { "label": "Kiến thức", "score": 1, "analysis": "VD: Hiểu bài nhanh, nhớ tốt kiến thức về bố cục, màu sắc, hình khối và áp dụng ngay vào bài.", "trend": "Tiến bộ" },
            { "label": "Kỹ năng", "score": 1, "analysis": "VD: Vẽ đúng yêu cầu, sáng tạo, phối màu hài hòa, có chi tiết và độ hoàn thiện cao.", "trend": "Tiến bộ" },
            { "label": "Thái độ", "score": 1, "analysis": "VD: Tập trung trong giờ, chủ động hỏi đáp, hợp tác nhóm tốt.", "trend": "Tiến bộ" }
          ],
          "overall_progress": "Nhận xét tập trung vào những điểm nổi bật, ghi nhận cụ thể: ưu điểm - hạn chế - hướng cải thiện.",
          "suggestions": [
            "Dặn dò & Định hướng cải thiện cụ thể ở nhà hoặc trên lớp."
          ]
        }

        NGUYÊN TẮC NHẬN XÉT CHI TIẾT THEO YÊU CẦU:
        - KHÔNG nhận xét chung chung. KHÔNG tâng bốc cũng KHÔNG hạ thấp HV. Khen/chê rõ ràng, nếu chê phải luôn kèm theo đề xuất phương án.
        - Phải sử dụng ngôn từ lịch sự, mang tính xây dựng nhưng vẫn thể hiện đúng năng lực học viên.
        - Phải đồng nhất giữa các nhận xét từ LMS đến với phía TE, CS/PH.
        - Ở các buổi học thường, nhận xét những vấn đề nổi trội trong buổi học. VÍ DỤ: "Hôm nay con phối hợp với các bạn tốt và thực hiện lắp ráp mô hình nhanh. Tuy nhiên phần lập trình con chưa có sự tập trung dẫn đến chưa hoàn thành được các bài tập mà thầy đề ra. Con cần ôn tập thêm tại nhà theo nội dung thầy gửi và tập trung hơn trong buổi học sau."
        - Đối với lớp Coding và Robotics, bạn PHẢI đảm bảo nhận xét đủ 4 tiêu chí L-L-T-Đ vào mục "Đánh giá chung" ("overall_progress").
        - Đảm bảo "overall_progress" là MỘT đoạn văn liên tục, không chia dòng, không dùng markdown như **bold**, *italic*, gạch đầu dòng, ký hiệu đặc biệt, hoặc cách trình bày kiểu AI response.
        - Nội dung trong đoạn văn phải được chia thành các phân đoạn rõ ràng bằng chỉ mục nội tuyến trong cùng một đoạn, theo định dạng: "[L] ...; [T] ...; [T] ...; [Đ] ...". Không xuống dòng, không tạo list riêng.
        - Khi viết "overall_progress", hãy lần lượt đề cập đủ các ý: Lý do/tiến bộ về tư duy hoặc kiến thức nền, tiếp theo là thao tác/lập trình, tiếp theo là thái độ học tập, cuối cùng là đề xuất/phương án hỗ trợ hoặc lộ trình học tiếp theo.
        - Phần "analysis" của từng tiêu chí phải khớp với dữ liệu điểm số và nhận xét thực tế.
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

exports.getClassesNotifications = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { teacherId, centreIds, roles, statusIn, email } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!teacherId)
      return res.status(400).json({ error: "Teacher ID is required" });

    // Kiểm tra cache trước
    const centresKey = (centreIds || []).sort().join("-");
    const rolesKey = (roles || []).sort().join("-");
    const statusKey = statusIn ? statusIn.sort().join(",") : "DEFAULT";
    const cacheKey = `notif_${teacherId || "no_id"}_${centresKey}_${rolesKey}_${statusKey}`;

    const cachedData = notificationCache.get(cacheKey);
    if (cachedData && cachedData.expiresAt > Date.now()) {
      console.log(
        `[Cache] Trả về notifications từ cache cho teacher: ${teacherId}`,
      );
      return res.json({ success: true, data: cachedData.data });
    }

    // 1. Fetch running classes from cache/API
    const allEnrichedClasses = await ClassCacheService.getEnrichedClasses(
      token,
      teacherId,
      centreIds,
      roles,
      statusIn || ["OPEN", "RUNNING"],
    );

    // Filter to ensure only running classes
    const runningClasses = allEnrichedClasses.filter((cls) =>
      ["OPEN", "RUNNING"].includes(cls.status),
    );

    const classIds = runningClasses.map((c) => c.id);

    if (classIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 2. Fetch details for these classes (includes full slots and studentAttendance) - Sử dụng API tối ưu hoá payload & concurrency
    const client = new LMSClient(token);
    const detailedClasses = [];
    const missingClassIds = [];

    classIds.forEach((id) => {
      const cached = classNotificationDetailsCache.get(id);
      if (cached && cached.expiresAt > Date.now()) {
        detailedClasses.push(cached.data);
      } else {
        missingClassIds.push(id);
      }
    });

    if (missingClassIds.length > 0) {
      const fetchedDetails =
        await client.getClassesNotificationsDetails(missingClassIds);
      fetchedDetails.forEach((cls) => {
        if (cls && cls.id) {
          classNotificationDetailsCache.set(cls.id, {
            data: cls,
            expiresAt: Date.now() + CLASS_NOTIF_DETAILS_TTL,
          });
          detailedClasses.push(cls);
        }
      });
    }

    // 3. Compute notifications
    const now = new Date();
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
    const feedbackList = [];
    const isTE = Array.isArray(roles) && roles.includes("TE");

    const getTeacherNames = (teachersList, roleShortName) => {
      if (!Array.isArray(teachersList)) return "N/A";
      const matched = teachersList.filter(
        (t) => t.role?.shortName === roleShortName && t.isActive !== false,
      );
      if (matched.length > 0) {
        return matched
          .map((t) => t.teacher?.fullName)
          .filter(Boolean)
          .join(", ");
      }
      return "N/A";
    };

    detailedClasses.forEach((cls) => {
      if (!cls || !cls.slots || cls.slots.length === 0) return;

      // Determine user's role in this class
      const currentTeacher = cls.teachers?.find(
        (t) =>
          (t.teacher?.id && t.teacher.id === teacherId) ||
          (t.teacher?.email && t.teacher.email === email),
      );
      const role = currentTeacher?.role?.shortName || "";

      cls.slots.forEach((slot) => {
        if (!slot.date || !slot.endTime) return;

        let slotEndDateTime;
        try {
          if (typeof slot.date === "string" && slot.date.includes("/")) {
            const [d, m, y] = slot.date.split("/").map(Number);
            slotEndDateTime = new Date(y, m - 1, d);
          } else {
            slotEndDateTime = new Date(slot.date);
          }

          if (isNaN(slotEndDateTime.getTime())) throw new Error("Invalid Date");

          let hour = 0,
            minute = 0;
          if (slot.endTime.includes("T")) {
            const dateObj = new Date(slot.endTime);
            hour = dateObj.getHours();
            minute = dateObj.getMinutes();
          } else {
            const timeParts = slot.endTime.split(":");
            hour = parseInt(timeParts[0], 10) || 0;
            minute = parseInt(timeParts[1], 10) || 0;
          }
          slotEndDateTime.setHours(hour, minute, 0, 0);
        } catch (e) {
          return;
        }

        const timeDiff = now.getTime() - slotEndDateTime.getTime();

        if (timeDiff > 0) {
          const studentsNeedingFeedback = (slot.studentAttendance || []).filter(
            (sa) =>
              (sa.status === "PRESENT" ||
                sa.status === "ATTENDED" ||
                sa.status === "LATE" ||
                sa.status === "LATE_ARRIVED") &&
              (!sa.comment || sa.comment.trim() === ""),
          );

          if (studentsNeedingFeedback.length > 0) {
            const isLate = timeDiff > FORTY_EIGHT_HOURS;
            let message = "";

            let lecNameStr = null;
            let taNameStr = null;

            if (isTE) {
              const teachersToUse =
                slot.teachers && slot.teachers.length > 0
                  ? slot.teachers
                  : cls.teachers;
              const taName = getTeacherNames(teachersToUse, "TA");
              const lecName = getTeacherNames(teachersToUse, "LEC");

              if (lecName !== "N/A") lecNameStr = lecName;
              if (taName !== "N/A") taNameStr = taName;

              if (isLate) {
                message = `Lớp ${cls.name} đã trễ nhận xét`;
              } else {
                message = `Lớp ${cls.name} có ${studentsNeedingFeedback.length} học viên cần chấm điểm.`;
              }
            } else {
              if (isLate) {
                message = `Bạn đã trễ nhận xét buổi học lớp ${cls.name} (đã quá 48h).`;
              } else {
                if (role === "TA") {
                  message = `Bạn cần nhanh chóng nhận xét buổi học lớp ${cls.name} để theo kịp tiến độ.`;
                } else if (role === "LEC") {
                  message = `Bạn cần nhận xét hoặc báo TA nhận xét buổi học lớp ${cls.name}.`;
                } else {
                  message = `Bạn có ${studentsNeedingFeedback.length} học viên cần chấm điểm buổi học lớp ${cls.name}.`;
                }
              }
            }

            feedbackList.push({
              classId: cls.id,
              className: cls.name,
              date: slot.date,
              studentCount: studentsNeedingFeedback.length,
              isLate,
              message,
              lec: lecNameStr,
              ta: taNameStr,
            });
          }
        }
      });
    });

    // Sort: late tasks first, then most recent date
    feedbackList.sort((a, b) => {
      if (a.isLate && !b.isLate) return -1;
      if (!a.isLate && b.isLate) return 1;
      // parse dates to compare
      const parseDate = (dStr) => {
        if (dStr.includes("/")) {
          const [d, m, y] = dStr.split("/").map(Number);
          return new Date(y, m - 1, d).getTime();
        }
        return new Date(dStr).getTime();
      };
      return parseDate(b.date) - parseDate(a.date);
    });

    // Lưu vào cache
    notificationCache.set(cacheKey, {
      data: feedbackList,
      expiresAt: Date.now() + NOTIFICATION_CACHE_TTL,
    });

    res.json({ success: true, data: feedbackList });
  } catch (err) {
    console.error("[Controller] getClassesNotifications failed:", err.message);
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
};
