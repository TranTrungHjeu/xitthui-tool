function fetchTeachersToSheet() {
  const sheetName = "Nhân sự TDM";
  const tokenSheetName = "Token";

  // Lấy sheet chứa token
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tokenSheet = ss.getSheetByName(tokenSheetName);
  if (!tokenSheet) {
    throw new Error("Không tìm thấy sheet chứa token!");
  }

  // Lấy token từ ô A1
  const token = tokenSheet.getRange("A1").getValue().toString().trim();
  if (!token) {
    throw new Error("Ô A1 ở sheet Token đang trống. Vui lòng nhập token.");
  }

  // Chuẩn bị sheet dữ liệu
  let dataSheet = ss.getSheetByName(sheetName);
  if (!dataSheet) {
    dataSheet = ss.insertSheet(sheetName);
  }
  dataSheet.clearContents();

  // Payload GraphQL
  const payload = {
    operationName: "GetTeachers",
    variables: {
      type: "OFFSET",
      search: "",
      isActive: true,
      pageIndex: 0,
      itemsPerPage: 100,
      orderBy: "createdAt_desc",
      centers: ["6443460f94300678908f7974"],
      teacherPointRange: [null, null],
      joinedDate: [null, null]
    },
    query: `
      query GetTeachers($search: String, $isActive: Boolean, $courseLine: String, $course: String, $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String, $idNotIn: [String], $centers: [String], $teacherPointFrom: Float, $teacherPointTo: Float, $joinedDate: [String]) {
        teachers(payload: {
          searchString_wordSearch: $search,
          isActive_eq: $isActive,
          courseLines_eq: $courseLine,
          courses_eq: $course,
          id_nin: $idNotIn,
          pageIndex: $pageIndex,
          itemsPerPage: $itemsPerPage,
          orderBy: $orderBy,
          centres_in: $centers,
          teacherPoint_gte: $teacherPointFrom,
          teacherPoint_lte: $teacherPointTo,
          joinedDate: $joinedDate
        }) {
          data {
            id
            username
            user
            firebaseId
            fullName
            code
            phoneNumber
            email
            personalEmail
            gender
          }
          pagination {
            total
          }
        }
      }
    `
  };

  // Gửi request
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

  const response = UrlFetchApp.fetch(
    'https://lms-api.mindx.edu.vn/', // ✅ đúng
    options
  );
  
  const json = JSON.parse(response.getContentText());

  const teacherData = json.data?.teachers?.data || [];

  const headers = [
    "ID", "Username", "User", "Firebase ID", "Full Name", "Code", 
    "Phone Number", "Email", "Personal Email", "Gender"
  ];

  const rows = teacherData.map(t => [
    t.id,
    t.username,
    t.user,
    t.firebaseId,
    t.fullName,
    t.code,
    t.phoneNumber,
    t.email,
    t.personalEmail,
    t.gender
  ]);

  dataSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length > 0) {
    dataSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

