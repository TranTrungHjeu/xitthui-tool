const googleSheetsService = require("../services/googleSheets");

// Mặc định là ID từ yêu cầu của người dùng
const DEFAULT_SPREADSHEET_ID = "127e4Xljxfbar_GSpWeV4K_ntgYXEGTIHOKKOx8UNymM";
const SERVICE_ACCOUNT_EMAIL =
  "firebase-adminsdk-fbsvc@xitthui-tool-2be21.iam.gserviceaccount.com";

const getSpreadsheetData = async (req, res) => {
  const { spreadsheetId = DEFAULT_SPREADSHEET_ID, range } = req.query;
  let data = null;
  let sheetName = range || "";

  try {
    const sheets = googleSheetsService.getSheetsClient();
    if (!sheets) {
      throw new Error(
        "Google Sheets client chưa được khởi tạo. Vui lòng kiểm tra file serviceAccountKey.json.",
      );
    }

    let targetRange = range;
    let availableSheets = [];

    // Luôn lấy metadata để lấy danh sách sheet
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    if (metadata.data.sheets) {
      availableSheets = metadata.data.sheets.map(
        (sheet) => sheet.properties.title,
      );
    }

    // Tìm sheet theo tuần chứa ngày hiện tại
    if (!targetRange && availableSheets.length > 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      let matchedSheet = null;

      for (const sheet of availableSheets) {
        const datePattern = /(\d{1,2})\/(\d{1,2})/g;
        const matches = [...sheet.matchAll(datePattern)];

        if (matches.length >= 2) {
          const startDay = parseInt(matches[0][1]);
          const startMonth = parseInt(matches[0][2]) - 1;
          const endDay = parseInt(matches[1][1]);
          const endMonth = parseInt(matches[1][2]) - 1;

          let startYear = currentYear;
          let endYear = currentYear;

          // Xử lý chuyển năm (vd: 29/12 - 04/01)
          if (startMonth === 11 && endMonth === 0) {
            if (now.getMonth() === 0) startYear = currentYear - 1; // Đang ở tháng 1
            if (now.getMonth() === 11) endYear = currentYear + 1; // Đang ở tháng 12
          }

          const startDate = new Date(startYear, startMonth, startDay, 0, 0, 0);
          const endDate = new Date(endYear, endMonth, endDay, 23, 59, 59);

          if (now >= startDate && now <= endDate) {
            matchedSheet = sheet;
            break;
          }
        }
      }

      // Nếu không khớp ngày hiện tại, lấy sheet có mẫu ngày (thường là mới nhất) hoặc sheet đầu
      if (!matchedSheet) {
        // Tìm sheet cuối cùng (vì danh sách thường có sheet cũ ở trên, sheet mới ở dưới)
        // hoặc ngược lại, lấy sheet đầu tiên nếu không ai khớp.
        targetRange = availableSheets[0];
      } else {
        targetRange = matchedSheet;
      }
    }

    sheetName = targetRange;

    data = await googleSheetsService.getSheetData(spreadsheetId, targetRange);

    // Đính kèm availableSheets vào object data hoặc truyền ra ngoài catch block
    req.availableSheets = availableSheets; // lưu tạm vào req để dùng phía dưới
  } catch (error) {
    console.error("Lỗi gọi Google Sheets API:", error.message);

    // Gợi ý cho người dùng cách phân quyền
    const errorMsg =
      error.message.includes("caller does not have permission") ||
      error.status === 403
        ? `Không có quyền truy cập Google Sheet này. Hãy chắc chắn rằng bạn đã SHARE quyền xem (Viewer) cho email Service Account: ${SERVICE_ACCOUNT_EMAIL}`
        : `Lỗi kết nối Google Sheets: ${error.message}`;

    return res.status(error.status || 500).json({
      success: false,
      error: errorMsg,
      serviceAccountEmail: SERVICE_ACCOUNT_EMAIL,
    });
  }

  try {
    if (!data || data.length === 0) {
      return res.json({ success: true, data: [], headers: [], sheetName });
    }

    // Tìm dòng header thực sự: là dòng đầu tiên có nhiều hơn 1 cột chứa text
    // Vì đôi khi dòng 0 chỉ là Title bị merge cell hoặc rỗng
    let headerIndex = 0;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const nonEmptyCells = data[i].filter(
        (cell) => cell && cell.trim() !== "",
      );
      if (nonEmptyCells.length > 1) {
        headerIndex = i;
        break;
      }
    }

    // Lọc bỏ những cột trống hoàn toàn ở cuối dòng header
    const rawHeaders = data[headerIndex] || [];
    let lastNonEmptyIndex = rawHeaders.length - 1;
    while (
      lastNonEmptyIndex >= 0 &&
      (!rawHeaders[lastNonEmptyIndex] ||
        rawHeaders[lastNonEmptyIndex].trim() === "")
    ) {
      lastNonEmptyIndex--;
    }

    // Chống trùng lặp tên cột (React Table cần tên cột duy nhất)
    const headerCount = {};
    const headers = rawHeaders.slice(0, lastNonEmptyIndex + 1).map((h, i) => {
      let name = h ? h.trim() : `Column_${i + 1}`;
      if (headerCount[name]) {
        headerCount[name]++;
        name = `${name} (${headerCount[name]})`;
      } else {
        headerCount[name] = 1;
      }
      return name;
    });

    const rows = data.slice(headerIndex + 1).map((row) => {
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = row[index] || "";
      });
      return rowData;
    });

    res.json({
      success: true,
      data: rows,
      headers: headers,
      sheetName: sheetName,
      availableSheets: req.availableSheets || [sheetName],
      isFallback: false,
    });
  } catch (error) {
    console.error("Lỗi xử lý dữ liệu:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi xử lý dữ liệu bảng tính",
    });
  }
};


const { Schedule, TrialBooking } = require("../storage/mongoModels");
const LMSClient = require("../services/lmsClient");

function parseTrialSlotTimes(timeSlot, dateStr) {
  const timeLower = timeSlot.toLowerCase();
  let startHour = 9;
  let startMinute = 0;

  // Match formats like "18:30", "18h30", "9h", "09:00"
  const match = timeLower.match(/(\d+)(?:\s*(?:h|:)\s*(\d+))?/);
  if (match) {
    const hh = parseInt(match[1], 10);
    if (hh >= 0 && hh <= 23) {
      startHour = hh;
    }
    if (match[2]) {
      const mm = parseInt(match[2], 10);
      if (mm >= 0 && mm <= 59) {
        startMinute = mm;
      }
    }
  }

  const startTime = new Date(`${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00+07:00`);
  const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration

  return { startTime, endTime };
}

const getTrialAvailabilities = async (req, res) => {
  let token = req.query.token;
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return res.status(400).json({ success: false, error: "Token is required" });
  }

  const { spreadsheetId = DEFAULT_SPREADSHEET_ID, sheetName, dateStr, centreIds } = req.query;
  if (!dateStr) {
    return res.status(400).json({ success: false, error: "dateStr (YYYY-MM-DD) is required" });
  }

  try {
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ success: false, error: "Invalid dateStr format" });
    }

    const sheets = googleSheetsService.getSheetsClient();
    if (!sheets) {
      throw new Error("Google Sheets client chưa được khởi tạo.");
    }

    let availableSheets = [];
    const metadata = await sheets.spreadsheets.get({ spreadsheetId });
    if (metadata.data.sheets) {
      availableSheets = metadata.data.sheets.map((sheet) => sheet.properties.title);
    }

    let finalSheetName = sheetName;
    if (!finalSheetName && availableSheets.length > 0) {
      const currentYear = targetDate.getFullYear();
      for (const sheet of availableSheets) {
        const datePattern = /(\d{1,2})\/(\d{1,2})/g;
        const matches = [...sheet.matchAll(datePattern)];

        if (matches.length >= 2) {
          const startDay = parseInt(matches[0][1]);
          const startMonth = parseInt(matches[0][2]) - 1;
          const endDay = parseInt(matches[1][1]);
          const endMonth = parseInt(matches[1][2]) - 1;

          let startYear = currentYear;
          let endYear = currentYear;

          if (startMonth === 11 && endMonth === 0) {
            if (targetDate.getUTCMonth() === 0) startYear = currentYear - 1;
            if (targetDate.getUTCMonth() === 11) endYear = currentYear + 1;
          }

          const startDate = new Date(startYear, startMonth, startDay, 0, 0, 0);
          const endDate = new Date(endYear, endMonth, endDay, 23, 59, 59);

          if (targetDate >= startDate && targetDate <= endDate) {
            finalSheetName = sheet;
            break;
          }
        }
      }
      if (!finalSheetName) {
        finalSheetName = availableSheets[0];
      }
    }

    if (!finalSheetName) {
      return res.json({ success: true, trials: [], sheetName: "", datesWithTrials: [] });
    }

    const sheetRows = await googleSheetsService.getSheetData(spreadsheetId, finalSheetName);
    if (!sheetRows || sheetRows.length === 0) {
      return res.json({ success: true, trials: [], sheetName: finalSheetName, datesWithTrials: [] });
    }

    let headerIndex = 0;
    for (let i = 0; i < Math.min(10, sheetRows.length); i++) {
      const nonEmptyCells = sheetRows[i].filter((cell) => cell && cell.trim() !== "");
      if (nonEmptyCells.length > 1) {
        headerIndex = i;
        break;
      }
    }
    const rows = sheetRows.slice(headerIndex + 1);

    // Thu thập các ngày trong tuần của sheet này có học viên đăng ký trực trial
    let currentDayDateStr = null;
    let currentDayHasTrials = false;
    const datesWithTrialsSet = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const col0 = (row[0] || "").trim().toUpperCase();
      const col1 = (row[1] || "").trim();

      const isDayHeader = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].includes(col0);

      if (isDayHeader) {
        if (currentDayDateStr && currentDayHasTrials) {
          datesWithTrialsSet.add(currentDayDateStr);
        }
        
        currentDayDateStr = null;
        currentDayHasTrials = false;
        
        const parts = col1.split("/");
        if (parts.length >= 2) {
          const day = parts[0].trim().padStart(2, '0');
          const month = parts[1].trim().padStart(2, '0');
          let year = targetDate.getFullYear();
          if (parts.length >= 3) {
            let yr = parts[2].trim();
            if (yr.length === 2) {
              year = `20${yr}`;
            } else if (yr.length === 4) {
              year = yr;
            }
          }
          currentDayDateStr = `${year}-${month}-${day}`;
        }
      } else {
        const ca = (row[2] || "").trim();
        if (ca) {
          const student1 = (row[6] || "").trim();
          const student2 = (row[8] || "").trim();
          const student3 = (row[10] || "").trim();
          const hasStudents = student1 || student2 || student3;
          if (hasStudents) {
            currentDayHasTrials = true;
          }
        }
      }
    }
    if (currentDayDateStr && currentDayHasTrials) {
      datesWithTrialsSet.add(currentDayDateStr);
    }
    const datesWithTrials = Array.from(datesWithTrialsSet).sort();

    const weekdays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const targetDayName = weekdays[targetDate.getUTCDay()];
    const formattedDaySlash = `${targetDate.getUTCDate().toString().padStart(2, '0')}/${(targetDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;

    let targetDayRows = [];
    let insideTargetDay = false;
    let originalIndices = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const col0 = (row[0] || "").trim().toUpperCase();
      const col1 = (row[1] || "").trim();

      const isDayHeader = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].includes(col0);

      if (isDayHeader) {
        if (insideTargetDay) {
          break;
        }
        if (col0 === targetDayName && col1.includes(formattedDaySlash)) {
          insideTargetDay = true;
          continue;
        }
      }

      if (insideTargetDay) {
        targetDayRows.push(row);
        originalIndices.push(headerIndex + 2 + i);
      }
    }

    function normalizeTimeSlot(timeSlot) {
      const timeLower = timeSlot.toLowerCase().trim();
      let hour = 9;
      let minute = 0;

      const match = timeLower.match(/(\d+)(?:\s*(?:h|:)\s*(\d+))?/);
      if (match) {
        hour = parseInt(match[1], 10);
        if (match[2]) {
          minute = parseInt(match[2], 10);
        }
      }
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    const trialsFromSheet = [];
    targetDayRows.forEach((row, index) => {
      const ca = (row[2] || "").trim();
      if (!ca) return;

      const bomon = (row[3] || "").trim();
      const type = (row[4] || "").trim();
      const roomLink = (row[5] || "").trim();
      const student1 = (row[6] || "").trim();
      const student2 = (row[8] || "").trim();
      const student3 = (row[10] || "").trim();
      
      const studentsList = [student1, student2, student3].filter(Boolean);

      trialsFromSheet.push({
        rowIndex: originalIndices[index],
        timeSlot: ca,
        normalizedTime: normalizeTimeSlot(ca),
        subject: bomon || "Trống",
        type: type || "N/A",
        roomLink,
        students: studentsList,
      });
    });

    // Only display slots that have students registered in the Google Sheet
    const trials = trialsFromSheet.filter(t => t.students && t.students.length > 0);

    // Sort chronologically by normalizedTime
    trials.sort((a, b) => a.normalizedTime.localeCompare(b.normalizedTime));

    let finalCentreIds = [];
    if (centreIds) {
      finalCentreIds = Array.isArray(centreIds) ? centreIds : centreIds.split(",").filter(Boolean);
    }
    if (finalCentreIds.length === 0) {
      finalCentreIds = ["6443460f94300678908f7974"];
    }

    const client = new LMSClient(token);
    const teachersRes = await client.getTeachers(finalCentreIds, 0, 150);
    const teachers = teachersRes.data || [];
    const teacherIds = teachers.map((t) => t.id).filter(Boolean);

    let schedules = [];
    if (teacherIds.length > 0) {
      schedules = await Schedule.find({
        teacherId: { $in: teacherIds },
        date: { $regex: `^${dateStr}` },
      }).lean();
    }

    const schedulesByTeacher = {};
    teacherIds.forEach((id) => {
      schedulesByTeacher[id] = [];
    });
    schedules.forEach((sch) => {
      if (schedulesByTeacher[sch.teacherId]) {
        schedulesByTeacher[sch.teacherId].push(sch);
      }
    });

    // Fetch existing assignments for this date
    const bookings = await TrialBooking.find({ date: dateStr }).lean();
    const bookingsMap = {};
    bookings.forEach((booking) => {
      const slotId = booking._id.replace(`${dateStr}_`, "");
      bookingsMap[slotId] = booking;
    });

    const trialsWithAvailabilities = trials.map((trial) => {
      const { startTime, endTime } = parseTrialSlotTimes(trial.timeSlot, dateStr);

      const slotId = trial.rowIndex ? `row_${trial.rowIndex}` : `slot_${trial.normalizedTime}`;
      const booking = bookingsMap[slotId];
      const assignedTeacher = booking ? {
        id: booking.teacherId,
        code: booking.teacherCode,
        fullName: booking.teacherName
      } : null;

      const presentAtBranch = [];
      const notPresentAtBranch = [];

      teachers.forEach((teacher) => {
        // Skip if this teacher is already assigned to this slot
        if (assignedTeacher && assignedTeacher.id === teacher.id) {
          return;
        }

        const teacherSchedules = schedulesByTeacher[teacher.id] || [];
        const activeSchedules = teacherSchedules.filter(
          (sch) => sch.type === "CLASS_SESSION" || sch.type === "OFFICE_HOURS"
        );

        let isOverlapping = false;
        activeSchedules.forEach((sch) => {
          const schStart = new Date(sch.startTime);
          const schEnd = new Date(sch.endTime);

          if (!isNaN(schStart.getTime()) && !isNaN(schEnd.getTime())) {
            if (schStart < endTime && schEnd > startTime) {
              isOverlapping = true;
            }
          }
        });

        if (!isOverlapping) {
          const hasClassesToday = activeSchedules.length > 0;
          const teacherInfo = {
            id: teacher.id,
            fullName: teacher.fullName,
            code: teacher.code,
            schedulesToday: activeSchedules.map((sch) => ({
              title: sch.title,
              type: sch.type,
              time: `${new Date(sch.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' })} - ${new Date(sch.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' })}`
            }))
          };

          if (hasClassesToday) {
            presentAtBranch.push(teacherInfo);
          } else {
            notPresentAtBranch.push(teacherInfo);
          }
        }
      });

      return {
        ...trial,
        slotId,
        slotStart: startTime.toISOString(),
        slotEnd: endTime.toISOString(),
        assignedTeacher,
        availabilities: {
          presentAtBranch,
          notPresentAtBranch
        }
      };
    });

    res.json({
      success: true,
      sheetName: finalSheetName,
      trials: trialsWithAvailabilities,
      datesWithTrials,
    });
  } catch (error) {
    console.error("Lỗi getTrialAvailabilities:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi xử lý khả dụng giáo viên trực trial",
    });
  }
};

const assignTrialTeacher = async (req, res) => {
  const {
    dateStr,
    slotId,
    teacherId,
    teacherCode,
    teacherName,
    timeSlot,
    normalizedTime,
    subject,
    type,
    roomLink,
    students,
    rowIndex
  } = req.body;

  if (!dateStr || !slotId || !teacherId) {
    return res.status(400).json({ success: false, error: "dateStr, slotId, and teacherId are required" });
  }

  try {
    const id = `${dateStr}_${slotId}`;
    await TrialBooking.findByIdAndUpdate(
      id,
      {
        date: dateStr,
        timeSlot,
        normalizedTime,
        subject: subject || "Trống",
        type: type || "N/A",
        roomLink: roomLink || "",
        students: students || [],
        rowIndex: rowIndex || null,
        teacherId,
        teacherCode,
        teacherName,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Lỗi assignTrialTeacher:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const unassignTrialTeacher = async (req, res) => {
  const { dateStr, slotId } = req.body;

  if (!dateStr || !slotId) {
    return res.status(400).json({ success: false, error: "dateStr and slotId are required" });
  }

  try {
    const id = `${dateStr}_${slotId}`;
    await TrialBooking.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Lỗi unassignTrialTeacher:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getSpreadsheetData,
  getTrialAvailabilities,
  assignTrialTeacher,
  unassignTrialTeacher,
};

