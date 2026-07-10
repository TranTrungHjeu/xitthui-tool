const { OfficeHour } = require("../storage/mongoModels");

exports.getOfficeHours = async (req, res) => {
  console.log("[OfficeHourController] getOfficeHours body:", req.body);
  try {
    const {
      teacherId,
      centreIds,
      roles,
      page = 1,
      limit = 10,
      search = "",
      centre = "all",
      status = "all",
      type = "all",
    } = req.body;

    const isTE = Array.isArray(roles) && roles.includes("TE");

    const queryFilter = {};

    // 1. Authorization & Centre Scope
    if (isTE) {
      // TE: Can see all office hours for their centres
      // If a specific centre is requested, check if it's within TE's centreIds
      if (centre !== "all") {
        queryFilter["centre.id"] = centre;
      } else if (Array.isArray(centreIds) && centreIds.length > 0) {
        queryFilter["centre.id"] = { $in: centreIds };
      } else {
        // Fallback to Thủ Dầu Một if centreIds is empty
        queryFilter["centre.id"] = "6443460f94300678908f7974";
      }
    } else {
      // Regular Teacher: Can only see their own office hours
      if (!teacherId) {
        return res.status(400).json({ error: "Teacher ID is required for teachers" });
      }
      queryFilter["teacher.id"] = teacherId;
    }

    // 2. Search filter
    if (search && search.trim() !== "") {
      const searchRegex = new RegExp(search.trim(), "i");
      queryFilter.$or = [
        { "teacher.fullName": searchRegex },
        { "teacher.code": searchRegex },
        { "class.name": searchRegex },
        { "centre.name": searchRegex },
        { note: searchRegex },
        { type: searchRegex }
      ];
    }

    // 3. Status filter
    if (status !== "all") {
      queryFilter.status = status;
    }

    // 4. Type filter
    if (type !== "all") {
      queryFilter.type = type;
    }

    // 5. Query execution with pagination
    const limitNum = parseInt(limit, 10) || 10;
    const pageNum = parseInt(page, 10) || 1;
    const skipNum = (pageNum - 1) * limitNum;

    console.log("[OfficeHourController] Executing query:", JSON.stringify(queryFilter));

    const total = await OfficeHour.countDocuments(queryFilter);
    const data = await OfficeHour.find(queryFilter)
      .sort({ startTime: -1 })
      .skip(skipNum)
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      data,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (err) {
    console.error("[OfficeHourController] Failed to get office hours:", err.message);
    res.status(500).json({
      success: false,
      error: "Không thể tải danh sách office hours"
    });
  }
};

const axios = require("axios");
const config = require("../config/index");

let cachedMasterToken = null;
let cachedTokenExpiry = 0;

async function getMasterToken() {
  const now = Date.now();
  if (cachedMasterToken && cachedTokenExpiry > now) {
    return cachedMasterToken;
  }

  const lmsAuth = require("../services/lmsAuth");
  
  let authData;
  try {
    authData = await lmsAuth.loginWithUsernameFlow(
      config.lms.masterUsername,
      config.lms.masterPassword
    );
  } catch (err) {
    console.warn("[OfficeHourController] Master username login failed, trying Firebase flow...", err.message);
    authData = await lmsAuth.loginWithCredentials(
      config.lms.masterUsername,
      config.lms.masterPassword
    );
  }

  if (authData && authData.lmsToken) {
    cachedMasterToken = authData.lmsToken;
    // Cache for 50 minutes (Firebase token expires in 1 hour)
    cachedTokenExpiry = now + 50 * 60 * 1000;
    return cachedMasterToken;
  }

  throw new Error("Không thể khởi tạo token quản trị LMS");
}

exports.getOfficeHourById = async (req, res) => {
  try {
    const { id, teacherId, roles } = req.body;

    if (!id) return res.status(400).json({ error: "Office Hour ID is required" });

    const isTE = Array.isArray(roles) && roles.includes("TE");

    // Local Authorization Check using MongoDB record
    const oh = await OfficeHour.findById(id).lean();
    if (oh) {
      if (!isTE) {
        // If not TE, user must be the assigned teacher
        const assignedTeacherId = oh.teacher?.id;
        if (!assignedTeacherId || assignedTeacherId !== teacherId) {
          console.warn(`[OfficeHourController] Unauthorized detail access: request teacher ${teacherId} does not match assigned teacher ${assignedTeacherId}`);
          return res.status(403).json({ error: "Bạn không có quyền xem chi tiết ca trực này" });
        }
      }
    }

    // Get Master token to query LMS live details securely (bypasses user token expiry issues)
    const masterToken = await getMasterToken();

    const query = `query GetOficeHourById($id: ID!) {
      officeHoursById(id: $id) {
        id
        courses {
          id
          name
          shortName
        }
        courseLines {
          id
          name
        }
        courseTopics {
          id
          name
        }
        startTime
        endTime
        status
        centre {
          id
          name
          shortName
        }
        teacher {
          id
          username
          code
          fullName
          imageUrl
          email
          phoneNumber
        }
        class {
          id
          name
          sessions {
            id
            startTime
            endTime
          }
          students
        }
        classSiteId
        note
        managerNote
        type
        links {
          _id
          title
          link
        }
        studentCount
        custom
        createdBy {
          username
        }
        createdAt
        lastModifiedBy {
          username
        }
        lastModifiedAt
        appointments {
          id
          title
          candidate {
            id
            fullName
            email
            phoneNumber
            dob {
              year
              month
              date
            }
          }
          courses {
            id
            name
            shortName
          }
          status
          note
          entranceTest {
            submitUrl
            testFileUrl
            submittedAt
            originalFilename
          }
          resultAfterTrial {
            isTrialed
            isHasOrder
            isHasPayment
          }
          createdAt
        }
        uplevelTestStudents {
          id
          centre {
            id
            name
          }
          class {
            id
            name
            students {
              _id
              student {
                id
                studentId
                fullName
                status
                waitingStatus
                phoneNumber
                email
                gender
                dob
                address
                imageUrl
                facebook
                zalo
                school
                customer {
                  _id
                  fullName
                  phoneNumber
                  email
                  facebook
                  zalo
                }
              }
              note
              activeInClass
              completed
              retentionDate
              createdBy
              createdAt
            }
          }
          student {
            id
            fullName
          }
          status
          note
          fileUrl
        }
        confirmAdditionalInfo {
          confirmAdditionalInfoStatus
          note
        }
      }
    }`;

    console.log(`[OfficeHourController] Fetching detailed office hour ID: ${id} using master token`);
    const response = await axios.post(
      config.lms.gatewayGraphql || "https://lms-api.mindx.edu.vn/",
      {
        operationName: "GetOficeHourById",
        variables: { id },
        query
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${masterToken}`,
          origin: "https://lms.mindx.edu.vn"
        }
      }
    );

    if (response.data.errors) {
      console.error("[OfficeHourController] GraphQL error:", response.data.errors);
      return res.status(400).json({
        success: false,
        error: response.data.errors[0]?.message || "GraphQL Error"
      });
    }

    const data = response.data?.data?.officeHoursById;
    res.json({
      success: true,
      data
    });
  } catch (err) {
    console.error("[OfficeHourController] Failed to get office hour details:", err.message);
    res.status(500).json({
      success: false,
      error: "Không thể tải chi tiết office hour"
    });
  }
};

