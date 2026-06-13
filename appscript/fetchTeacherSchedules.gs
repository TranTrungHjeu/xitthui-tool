function fetchTeacherSchedules() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tokenSheet = ss.getSheetByName("Token");
  const idSheet = ss.getSheetByName("Nhân sự TDM");
  const dateSheet = ss.getSheetByName("Lịch theo tuần");

  const outputSheetName = "Lịch rảnh";
  
  if (!tokenSheet || !idSheet) throw new Error("Không tìm thấy sheet Token hoặc Nhân sự TDM");

  const token = tokenSheet.getRange("A1").getValue().toString().trim();
  if (!token) throw new Error("Token trống. Vui lòng nhập vào ô A1 của sheet Token");

  const ids = idSheet.getRange("A2:A" + idSheet.getLastRow()).getValues().flat().filter(String);
  if (ids.length === 0) throw new Error("Không có teacherId nào trong cột A của sheet Nhân sự TDM");

  let outputSheet = ss.getSheetByName(outputSheetName);
  if (!outputSheet) outputSheet = ss.insertSheet(outputSheetName);
  outputSheet.clearContents();

  const headers = [
    "Teacher ID", "Title", "Description", "Date", "Start Time", "End Time",
    "Type", "Class Name", "Center Name", "Office Hour Type"
  ];
  outputSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  const { dateGte, dateLte } = getWeekRangeISOFromB2(dateSheet);
  Logger.log({ dateGte, dateLte });

  let allRows = [];

  ids.forEach((teacherId, index) => {
    Logger.log(`--- Đang gọi lịch cho teacherId: ${teacherId} (index ${index + 1}/${ids.length}) ---`);

    const payload = {
      operationName: "findTeacherSchedule",
      variables: {
        dateGte,
        dateLte,
        type: ["CLASS_SESSION", "OFFICE_HOURS", "AVAILABLE"],
        teacherId: teacherId.toString()
      },
      query: `
        query findTeacherSchedule($dateGte: String!, $dateLte: String!, $type: [String], $teacherId: String!, $slotIdNin: [String], $officeHourIdNin: [String]) {
          findTeacherSchedule(payload: {
            date_gte: $dateGte,
            date_lte: $dateLte,
            type_in: $type,
            teacherId_eq: $teacherId,
            slotId_nin: $slotIdNin,
            officeHourId_nin: $officeHourIdNin
          }) {
            data {
              id
              teacherId
              title
              description
              date
              startTime
              endTime
              type
              classSite {
                class { name }
                centre { name }
              }
              officeHour {
                type
                centre { name }
              }
            }
          }
        }
      `
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: {
        'Authorization': token,
        'Accept': '*/*',
        'Origin': 'https://lms.mindx.vn',
        'Referer': 'https://lms.mindx.vn/',
        'Content-Language': 'vi'
      },
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch('https://lms-api.mindx.edu.vn/', options);
      const json = JSON.parse(response.getContentText());
      const schedules = json.data?.findTeacherSchedule?.data || [];

      Logger.log(`✓ Nhận được ${schedules.length} lịch cho teacherId: ${teacherId}`);
      Logger.log(`↪️ Data trả về:\n${JSON.stringify(schedules, null, 2)}`);

      schedules.forEach(sch => {
        allRows.push([
          teacherId,
          sch.title || "",
          sch.description || "",
          sch.date || "",
          sch.startTime || "",
          sch.endTime || "",
          sch.type || "",
          sch.classSite?.class?.name || "",
          sch.classSite?.centre?.name || sch.officeHour?.centre?.name || "",
          sch.officeHour?.type || ""
        ]);
      });

    } catch (e) {
      Logger.log(`✗ Lỗi khi gọi lịch teacherId: ${teacherId} — ${e.message}`);
      allRows.push([teacherId, "Lỗi khi gọi API", e.message]);
    }
  });

  if (allRows.length > 0) {
    outputSheet.getRange(2, 1, allRows.length, headers.length).setValues(allRows);
  } else {
    outputSheet.getRange(2, 1).setValue("Không có dữ liệu lịch rảnh nào.");
  }

  Logger.log("✅ Hoàn tất lấy lịch tất cả teacherId.");
}

// Helper: tính khoảng tuần (Thứ Hai -> Chủ Nhật) từ ô B2 và trả ISO UTC
function getWeekRangeISOFromB2(dateSheet) {
  const raw = dateSheet.getRange("B2").getValue();
  
  if (!raw) throw new Error('Ô "Lịch theo tuần"!B2 đang trống');

  // Bảo đảm là Date và chốt về "nửa đêm giờ địa phương" của ngày trong B2
  const d = (raw instanceof Date) ? raw : new Date(raw);
  if (isNaN(d)) throw new Error('Giá trị ở B2 không phải ngày hợp lệ');

  const localMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()); // 00:00 local
  // JS: Chủ nhật=0 ... Thứ hai=1 ... Thứ bảy=6
  const diffToMonday = (localMidnight.getDay() + 6) % 7; // số ngày lùi về Thứ Hai
  const startLocal = new Date(localMidnight);
  startLocal.setDate(localMidnight.getDate() - diffToMonday);
  startLocal.setHours(0, 0, 0, 0); // Thứ Hai 00:00 (giờ VN)

  const endLocal = new Date(startLocal);
  endLocal.setDate(startLocal.getDate() + 6);
  endLocal.setHours(23, 59, 59, 999); // CN 23:59:59.999 (giờ VN)

  // toISOString() => UTC với hậu tố Z
  return {
    dateGte: startLocal.toISOString(),
    dateLte: endLocal.toISOString(),
  };
}
