const axios = require("axios");
const LMSClient = require("../services/lmsClient");
const { isLmsAuthError } = require("../utils/authError");
const ClassCacheService = require("../services/classCache");
const FirestoreNotification = require("../storage/notificationStorage");
const NotificationScheduler = require("../services/notificationScheduler");
const FirestoreStudent = require("../storage/studentStorage");
const StudentScheduler = require("../services/studentScheduler");
const { VertexAI } = require("@google-cloud/vertexai");
const {
  getClassWeekdayIndexes,
  getRealTeacherByRole,
  getClassTimeRange,
  getClassWeekdays,
  getCurrentSessionIndex,
} = require("../utils/classHelpers");

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
      category = "all",
    } = req.body;

    const isTE = Array.isArray(roles) && roles.includes("TE");

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!isTE && !teacherId)
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
        category,
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

    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
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
    
    // 1. Try to get from in-memory cache first
    if (!noCache) {
      const cached = classDetailsCache.get(classId);
      if (cached && cached.expiresAt > now) {
        console.log(
          `[Cache] Trả về class details từ cache cho lớp: ${classId}`,
        );
        return res.json({ success: true, data: cached.data });
      }

      // 2. Try to get from MongoDB second
      const { Class } = require("../storage/mongoModels");
      try {
        const dbClass = await Class.findById(classId).lean();
        // Check if detailed information (like students roster) is already synced
        if (dbClass && dbClass.students !== undefined) {
          console.log(`[MongoDB] Trả về class details từ MongoDB cho lớp: ${classId}`);
          const formattedClass = {
            ...dbClass,
            id: dbClass._id,
          };
          classDetailsCache.set(classId, {
            data: formattedClass,
            expiresAt: Date.now() + CLASS_DETAILS_TTL,
          });
          return res.json({ success: true, data: formattedClass });
        }
      } catch (dbErr) {
        console.warn(`[MongoDB] Failed to find class details: ${dbErr.message}`);
      }
    }

    // 3. Fallback: Fetch from LMS
    const client = new LMSClient(token);
    const data = await client.getClassById(classId);

    if (data && data.id) {
      // Save this detailed class to MongoDB for future queries
      const { Class } = require("../storage/mongoModels");
      const { getCourseCategory } = require("../utils/courseConfig");
      
      const weekdayIndexes = getClassWeekdayIndexes(data);
      const lecName = getRealTeacherByRole(data, "LEC") || "-";
      const taName = getRealTeacherByRole(data, "TA") || "-";
      const timeRange = getClassTimeRange(data);
      const weekdays = getClassWeekdays(data);
      const category = getCourseCategory(data.name || data.course?.name || "");
      const currentSessionIndex = getCurrentSessionIndex(data);
      const searchString = [
        data.name,
        data.course?.shortName,
        data.centre?.name,
        data.centre?.shortName,
        lecName,
        taName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const doc = {
        name: data.name,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        course: data.course,
        centre: data.centre,
        teachers: data.teachers,
        slots: data.slots,
        students: data.students || [],
        computed: {
          weekdayIndexes,
          lecName,
          taName,
          timeRange,
          weekdays,
          searchString,
          category,
          currentSessionIndex
        },
        updatedAt: new Date()
      };

      try {
        await Class.updateOne(
          { _id: data.id },
          { $set: doc },
          { upsert: true }
        );
        console.log(`[MongoDB] Saved detailed class ${data.id} to MongoDB`);
      } catch (saveErr) {
        console.error(`[MongoDB] Failed to save detailed class ${data.id}:`, saveErr.message);
      }

      const formattedClass = {
        ...doc,
        id: data.id,
      };

      classDetailsCache.set(data.id, {
        data: formattedClass,
        expiresAt: Date.now() + CLASS_DETAILS_TTL,
      });
      res.json({ success: true, data: formattedClass });
    } else {
      res.json({ success: true, data });
    }
  } catch (err) {
    console.error("[Controller] getClassById failed:", err.message);
    console.error(
      "[Controller] LMS error response:",
      JSON.stringify(err.response?.data || {}, null, 2),
    );

    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
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
      // 1. Try to get from in-memory cache first
      classIds.forEach((id) => {
        const cached = classDetailsCache.get(id);
        if (cached && cached.expiresAt > now) {
          results.push(cached.data);
        } else {
          missingIds.push(id);
        }
      });

      // 2. Try to get from MongoDB second
      if (missingIds.length > 0) {
        const { Class } = require("../storage/mongoModels");
        try {
          const dbClasses = await Class.find({ _id: { $in: missingIds } }).lean();
          const dbClassesMap = new Map(dbClasses.map(c => [c._id, c]));
          const stillMissing = [];
          
          missingIds.forEach((id) => {
            const dbClass = dbClassesMap.get(id);
            if (dbClass && dbClass.students !== undefined) {
              const formattedClass = {
                ...dbClass,
                id: dbClass._id,
              };
              classDetailsCache.set(id, {
                data: formattedClass,
                expiresAt: Date.now() + CLASS_DETAILS_TTL,
              });
              results.push(formattedClass);
            } else {
              stillMissing.push(id);
            }
          });

          missingIds.length = 0;
          missingIds.push(...stillMissing);
        } catch (dbErr) {
          console.warn(`[MongoDB] Failed to find multiple class details: ${dbErr.message}`);
        }
      }
    } else {
      missingIds.push(...classIds);
    }

    // 3. Fallback: Fetch from LMS for whatever is still missing
    if (missingIds.length > 0) {
      const client = new LMSClient(token);
      const fetchedData = await client.getClassesDetails(missingIds);

      const { Class } = require("../storage/mongoModels");
      const { getCourseCategory } = require("../utils/courseConfig");

      for (const item of fetchedData) {
        if (item && item.id) {
          const weekdayIndexes = getClassWeekdayIndexes(item);
          const lecName = getRealTeacherByRole(item, "LEC") || "-";
          const taName = getRealTeacherByRole(item, "TA") || "-";
          const timeRange = getClassTimeRange(item);
          const weekdays = getClassWeekdays(item);
          const category = getCourseCategory(item.name || item.course?.name || "");
          const currentSessionIndex = getCurrentSessionIndex(item);
          const searchString = [
            item.name,
            item.course?.shortName,
            item.centre?.name,
            item.centre?.shortName,
            lecName,
            taName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const doc = {
            name: item.name,
            status: item.status,
            startDate: item.startDate,
            endDate: item.endDate,
            course: item.course,
            centre: item.centre,
            teachers: item.teachers,
            slots: item.slots,
            students: item.students || [],
            computed: {
              weekdayIndexes,
              lecName,
              taName,
              timeRange,
              weekdays,
              searchString,
              category,
              currentSessionIndex
            },
            updatedAt: new Date()
          };

          try {
            await Class.updateOne(
              { _id: item.id },
              { $set: doc },
              { upsert: true }
            );
            console.log(`[MongoDB] Saved detailed class ${item.id} to MongoDB`);
          } catch (saveErr) {
            console.error(`[MongoDB] Failed to save detailed class ${item.id}:`, saveErr.message);
          }

          const formattedClass = {
            ...doc,
            id: item.id,
          };

          classDetailsCache.set(item.id, {
            data: formattedClass,
            expiresAt: Date.now() + CLASS_DETAILS_TTL,
          });
          results.push(formattedClass);
        }
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    const statusCode = isLmsAuthError(err) ? 401 : (err.response?.status || 500);
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
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res
      .status(statusCode)
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
    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
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

    // Normalize attachment URLs to be absolute
    if (data && Array.isArray(data.submissions)) {
      data.submissions.forEach(sub => {
        if (sub.content && sub.content.attachments) {
          let list = [];
          const atts = sub.content.attachments;
          if (Array.isArray(atts)) {
            list = atts;
          } else if (typeof atts === "string" && atts.trim() !== "") {
            try {
              list = JSON.parse(atts);
            } catch (e) {
              list = [atts];
            }
          } else if (atts) {
            list = [atts];
          }

          const normalized = list.map(att => {
            let url = "";
            if (typeof att === "string") {
              url = att;
            } else if (att && typeof att === "object") {
              url = att.url || att.link || att.path || att.downloadUrl || "";
            }

            if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
              const base = (process.env.MINDX_LMS_ASSETS_BASE_URL || "https://mindx-learning-materials.hn.ss.bfcplatform.vn").replace(/\/$/, "");
              const cleanPath = url.startsWith("/") ? url : `/${url}`;
              return `${base}${cleanPath}`;
            }
            return url;
          }).filter(Boolean);

          sub.content.attachments = normalized;
        }
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("[Controller] getSubmissions failed:", err.message);
    console.error(
      "[Controller] LMS error response:",
      JSON.stringify(err.response?.data || {}, null, 2),
    );

    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
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
    const statusCode = isLmsAuthError(err) ? 401 : 200;
    res.status(statusCode).json({
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

    const isTE = Array.isArray(roles) && roles.includes("TE");

    const parsedCentreIds = Array.isArray(centreIds)
      ? centreIds.map((c) => (typeof c === "object" ? c.id : c))
      : centreIds;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!isTE && !teacherId)
      return res.status(400).json({ error: "Teacher ID is required" });

    // Kiểm tra cache trước
    const centresKey = (parsedCentreIds || []).sort().join("-");
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

    console.time("Fetch Notifications");
    let tickets = [];
    if (isTE) {
      tickets = await FirestoreNotification.getTicketsForTE(parsedCentreIds);
    } else {
      // GIÁO VIÊN THƯỜNG -> GỌI REALTIME
      const allEnrichedClasses = await ClassCacheService.getEnrichedClasses(
        token,
        teacherId,
        parsedCentreIds,
        roles,
        ["OPEN", "RUNNING"],
      );
      const runningClasses = allEnrichedClasses.filter((cls) =>
        ["OPEN", "RUNNING"].includes(cls.status),
      );
      const classIdsToFetch = runningClasses.map((c) => c.id);

      if (classIdsToFetch.length > 0) {
        const client = new LMSClient(token);
        const fetchedDetails =
          await client.getClassesNotificationsDetails(classIdsToFetch);

        const now = new Date();
        const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

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

        for (const cls of fetchedDetails) {
          if (!cls || !cls.id || !cls.slots || cls.slots.length === 0) continue;

          const classCacheInfo = runningClasses.find((c) => c.id === cls.id);
          const className = classCacheInfo ? classCacheInfo.name : cls.name;

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

              if (isNaN(slotEndDateTime.getTime()))
                throw new Error("Invalid Date");

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
              const studentsNeedingFeedback = (
                slot.studentAttendance || []
              ).filter(
                (sa) =>
                  (sa.status === "PRESENT" ||
                    sa.status === "ATTENDED" ||
                    sa.status === "LATE" ||
                    sa.status === "LATE_ARRIVED") &&
                  (!sa.comment || sa.comment.trim() === ""),
              );

              if (studentsNeedingFeedback.length > 0) {
                const isLate = timeDiff > FORTY_EIGHT_HOURS;

                const teachersToUse =
                  slot.teachers && slot.teachers.length > 0
                    ? slot.teachers
                    : cls.teachers;
                const taName = getTeacherNames(teachersToUse, "TA");
                const lecName = getTeacherNames(teachersToUse, "LEC");
                const teName = getTeacherNames(teachersToUse, "TE");

                // Thêm ticket cho realtime
                tickets.push({
                  classId: cls.id,
                  className: className,
                  date: slot.date,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  sessionIndex: slot.index,
                  studentCount: studentsNeedingFeedback.length,
                  isLate,
                  lec: lecName !== "N/A" ? lecName : null,
                  ta: taName !== "N/A" ? taName : null,
                  te: teName !== "N/A" ? teName : null,
                });
              }
            }
          });
        }
      }
    }
    console.timeEnd("Fetch Notifications");

    const feedbackList = [];

    // Để tối ưu hiển thị message (tuỳ theo role đối với LEC/TA)
    const isTeacherRoleTA = roles?.includes("TA");
    const isTeacherRoleLEC = roles?.includes("LEC");

    tickets.forEach((ticket) => {
      let message = "";
      if (isTE) {
        if (ticket.isLate) {
          message = `Lớp ${ticket.className} đã trễ nhận xét`;
        } else {
          message = `Lớp ${ticket.className} có ${ticket.studentCount} học viên cần chấm điểm.`;
        }
      } else {
        if (ticket.isLate) {
          message = `Bạn đã trễ nhận xét buổi học lớp ${ticket.className} (đã quá 48h).`;
        } else {
          if (isTeacherRoleTA) {
            message = `Bạn cần nhanh chóng nhận xét buổi học lớp ${ticket.className} để theo kịp tiến độ.`;
          } else if (isTeacherRoleLEC) {
            message = `Bạn cần nhận xét hoặc báo TA nhận xét buổi học lớp ${ticket.className}.`;
          } else {
            message = `Bạn có ${ticket.studentCount} học viên cần chấm điểm buổi học lớp ${ticket.className}.`;
          }
        }
      }

      feedbackList.push({
        classId: ticket.classId,
        className: ticket.className,
        date: ticket.date,
        startTime: ticket.startTime,
        endTime: ticket.endTime,
        sessionIndex: ticket.sessionIndex,
        studentCount: ticket.studentCount,
        isLate: ticket.isLate,
        message,
        lec: ticket.lec,
        ta: ticket.ta,
        te: ticket.te,
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

    // Lưu vào cache RAM
    notificationCache.set(cacheKey, {
      data: feedbackList,
      expiresAt: Date.now() + NOTIFICATION_CACHE_TTL,
    });

    res.json({ success: true, data: feedbackList });
  } catch (err) {
    console.error("[Controller] getClassesNotifications failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message, data: [] });
  }
};

exports.syncNotifications = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { roles } = req.body;
    const isTE = Array.isArray(roles) && roles.includes("TE");

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!isTE)
      return res
        .status(403)
        .json({ error: "Access denied. TE role required." });

    console.log("[Controller] Manual notification sync triggered by TE");

    // Chạy đồng bộ thông báo
    await NotificationScheduler.syncAllNotifications();

    // Xoá cache để lấy data mới
    notificationCache.clear();

    res.json({ success: true, message: "Đồng bộ thông báo thành công" });
  } catch (err) {
    console.error("[Controller] syncNotifications failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
};

exports.sendNotificationEmails = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { roles } = req.body;
    const isTE = Array.isArray(roles) && roles.includes("TE");

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!isTE)
      return res
        .status(403)
        .json({ error: "Access denied. TE role required." });

    console.log("[Controller] Manual email notification triggered by TE");

    // Chỉ gọi hàm gửi mail từ scheduler (đã viết sẵn logic nhóm và gửi)
    await NotificationScheduler.sendReminderEmails();

    res.json({ success: true, message: "Đã gửi email nhắc nhở thành công" });
  } catch (err) {
    console.error("[Controller] sendNotificationEmails failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
};

exports.getStudents = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }

    const {
      teacherId,
      centreIds,
      roles,
      statusIn = ["RUNNING", "OPEN", "PRE_OPEN"],
      page = 1,
      limit = 20,
      search = "",
      centre = "all",
      classId = "all", // Option to filter by a specific class
    } = req.body;

    const isTE = Array.isArray(roles) && roles.includes("TE");

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!isTE && !teacherId)
      return res.status(400).json({ error: "Teacher ID is required" });

    // 1. Get all students from Firestore by teacherId or centreIds
    let allStudents = await FirestoreStudent.getStudentsForUser(
      teacherId,
      centreIds,
      roles,
    );

    // 2. Filter by specific centre if selected
    if (centre !== "all") {
      allStudents = allStudents.filter((student) =>
        student.classes.some((c) => c.centreId === centre),
      );
    }

    // 3. Filter by specific classId if selected
    if (classId !== "all") {
      allStudents = allStudents.filter((student) =>
        student.classes.some((c) => c.id === classId),
      );
    }

    // 4. Filter by class status
    if (statusIn && statusIn.length > 0) {
      allStudents = allStudents.filter((student) =>
        student.classes.some((c) => statusIn.includes(c.status)),
      );
    }

    // 5. Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      allStudents = allStudents.filter((student) => {
        const searchString =
          `${student.fullName} ${student.email} ${student.phone}`.toLowerCase();
        return searchString.includes(searchLower);
      });
    }

    // 6. Sort students alphabetically
    allStudents.sort((a, b) => a.fullName.localeCompare(b.fullName));

    // 7. Pagination
    const total = allStudents.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const validPage = Math.max(1, Math.min(page, Math.max(1, totalPages)));
    const startIndex = (validPage - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedStudents = allStudents.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedStudents,
      meta: {
        total,
        page: validPage,
        limit,
        totalPages,
      },
    });
  } catch (err) {
    console.error("[Controller] getStudents failed:", err.message);
    const statusCode = isLmsAuthError(err) ? 401 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
};

exports.syncStudents = async (req, res) => {
  try {
    let token = req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }
    const { roles } = req.body;
    const isTE = Array.isArray(roles) && roles.includes("TE");

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!isTE)
      return res
        .status(403)
        .json({ error: "Access denied. TE role required." });

    console.log("[Controller] Manual student sync triggered by TE");

    // Return early to not block UI
    res.json({ success: true, message: "Đồng bộ học viên đang chạy ngầm..." });

    // Run sync in background
    StudentScheduler.syncAllStudents();
  } catch (err) {
    console.error("[Controller] syncStudents failed:", err.message);
    if (!res.headersSent) {
      const statusCode = isLmsAuthError(err) ? 401 : 500;
      res.status(statusCode).json({ success: false, error: err.message });
    }
  }
};

exports.downloadAttachment = async (req, res) => {
  try {
    let key = req.query.key || "";
    if (!key) {
      return res.status(400).send("Parameter 'key' is required.");
    }

    // Extract path starting with 'uploads/' if key is a full URL or starts with '/'
    if (key.startsWith("http://") || key.startsWith("https://")) {
      try {
        const urlObj = new URL(key);
        key = urlObj.pathname;
      } catch (e) {
        // use key as is
      }
    }

    if (key.startsWith("/")) {
      key = key.substring(1);
    }

    console.log(`[Controller] downloadAttachment: key = "${key}"`);

    // Fetch the presigned URL from MindX resources API
    const response = await axios.get("https://resources.mindx.edu.vn/api/v1/get-presigned-url", {
      params: { key }
    });

    if (response.data && response.data.success && response.data.url) {
      return res.redirect(response.data.url);
    } else {
      console.error("[Controller] Failed to get presigned URL:", response.data);
      return res.status(500).send("Could not retrieve download link from MindX API.");
    }
  } catch (err) {
    console.error("[Controller] downloadAttachment error:", err.message);
    return res.status(500).send(`Error processing download: ${err.message}`);
  }
};
