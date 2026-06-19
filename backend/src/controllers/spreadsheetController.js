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

module.exports = {
  getSpreadsheetData,
};
