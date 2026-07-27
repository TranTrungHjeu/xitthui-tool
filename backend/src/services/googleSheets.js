const { google } = require("googleapis");
const { loadServiceAccountCredentials } = require("../utils/googleCredentials");

const { childLogger } = require("../utils/logger.js");
const log = childLogger("GoogleSheets");

let sheetsClient = null;

const getSheetsClient = () => {
  if (sheetsClient) return sheetsClient;

  try {
    const credentials = loadServiceAccountCredentials();
    if (!credentials) {
      // Use console.warn since structured logger is not yet adopted everywhere
      // (Item 4 will replace this with logger.warn).
      if (typeof console !== "undefined" && console.warn) {
        log.warn(
          "[googleSheets] No service account credentials found. " +
            "Set GOOGLE_SERVICE_ACCOUNT_BASE64 or GOOGLE_APPLICATION_CREDENTIALS in env.",
        );
      }
      return null;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"], // Đổi thành spreadsheets nếu cần ghi
    });

    sheetsClient = google.sheets({ version: "v4", auth });
    return sheetsClient;
  } catch (error) {
    if (typeof console !== "undefined" && console.error) {
      log.error("[googleSheets] Error initializing client:", error);
    }
    return null;
  }
};

/**
 * Lấy dữ liệu từ một Google Sheet cụ thể
 * @param {string} spreadsheetId - ID của file Google Sheet
 * @param {string} range - Tên sheet hoặc vùng cần lấy (ví dụ: 'Sheet1!A1:Z')
 * @returns {Promise<Array<Array<string>>>} Mảng 2 chiều chứa dữ liệu
 */
const getSheetData = async (spreadsheetId, range) => {
  try {
    const sheets = getSheetsClient();
    if (!sheets) throw new Error("Google Sheets client not initialized");

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values || [];
  } catch (error) {
    if (typeof console !== "undefined" && console.error) {
      log.error("[googleSheets] Error fetching data:", error);
    }
    throw error;
  }
};

module.exports = {
  getSheetsClient,
  getSheetData,
};
