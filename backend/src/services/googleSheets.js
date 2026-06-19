const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

const SERVICE_ACCOUNT_FILE = path.join(
  __dirname,
  "../../serviceAccountKey.json",
);

let sheetsClient = null;

const getSheetsClient = () => {
  if (sheetsClient) return sheetsClient;

  try {
    if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
      console.warn(
        "Service account key not found, cannot initialize Google Sheets API",
      );
      return null;
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"], // Đổi thành spreadsheets nếu cần ghi
    });

    sheetsClient = google.sheets({ version: "v4", auth });
    return sheetsClient;
  } catch (error) {
    console.error("Error initializing Google Sheets client:", error);
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
    console.error("Error fetching Google Sheets data:", error);
    throw error;
  }
};

module.exports = {
  getSheetsClient,
  getSheetData,
};
