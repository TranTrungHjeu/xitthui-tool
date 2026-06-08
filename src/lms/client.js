const axios = require("axios");
const config = require("../config");

class LMSClient {
  constructor(token) {
    this.token = token;
    this.gatewayUrl = config.lms.gatewayGraphql;
    this.baseUrl = config.lms.baseGraphql;

    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Origin: "https://lms.mindx.edu.vn",
      Referer: "https://lms.mindx.edu.vn/",
    };
  }

  async getTeacherId(uid) {
    console.log(`[LMSClient] getTeacherId for UID: ${uid}`);

    // If it's a 24-char hex, it's a MindX User ID
    const isMindXId = /^[0-9a-fA-F]{24}$/.test(uid);

    if (isMindXId) {
      return await this.getTeacherIdByUserId(uid);
    } else {
      // It's likely a Firebase UID, need to get MindX User ID first
      const userId = await this.getUserIdByFirebaseId(uid);
      if (userId) {
        return await this.getTeacherIdByUserId(userId);
      }
    }

    throw new Error(`Could not find Teacher ID for UID: ${uid}`);
  }

  async getUserIdByFirebaseId(firebaseUid) {
    console.log(
      `[LMSClient] Getting MindX User ID from Firebase UID: ${firebaseUid}`,
    );
    const query = `
      query User_getByFirebaseId($id: String!) {
        User_getByFirebaseId(firebaseId: $id) {
          id
        }
      }
    `;
    try {
      const res = await axios.post(
        this.baseUrl,
        {
          operationName: "User_getByFirebaseId",
          query,
          variables: { id: firebaseUid },
        },
        { headers: this.headers },
      );

      if (res.data.errors) {
        console.error(
          `[LMSClient] User_getByFirebaseId errors:`,
          JSON.stringify(res.data.errors, null, 2),
        );
      }

      return res.data.data?.User_getByFirebaseId?.id;
    } catch (err) {
      console.error(`[LMSClient] User_getByFirebaseId failed: ${err.message}`);
      if (err.response) {
        console.error(
          `[LMSClient] Response data:`,
          JSON.stringify(err.response.data, null, 2),
        );
      }
      return null;
    }
  }

  async getTeacherIdByUserId(userId) {
    console.log(`[LMSClient] Getting Teacher ID from MindX User ID: ${userId}`);
    // Sửa truy vấn: Sử dụng chính xác Query từ hệ thống LMS gốc
    const query = `
      query teacherByUserId($user: String) {
        teacherByUserId(payload: { user: $user }) {
          id
          email
        }
      }
    `;

    try {
      const res = await axios.post(
        this.gatewayUrl,
        {
          operationName: "teacherByUserId",
          query,
          variables: { user: userId },
        },
        { headers: this.headers },
      );

      if (res.data.errors) {
        console.error(
          `[LMSClient] teacherByUserId errors:`,
          JSON.stringify(res.data.errors, null, 2),
        );
        throw new Error(res.data.errors[0].message);
      }

      const teacher = res.data.data?.teacherByUserId;
      if (teacher && teacher.id) {
        console.log(
          `[LMSClient] Found Teacher: ${teacher.email} (ID: ${teacher.id})`,
        );
        return teacher.id;
      }

      console.warn(`[LMSClient] No teacher found for User ID: ${userId}`);
      throw new Error(`Không tìm thấy Teacher ID cho User ${userId}`);
    } catch (err) {
      console.error(
        `[LMSClient] teacherByUserId request failed: ${err.message}`,
      );
      if (err.response) {
        console.error(
          `[LMSClient] Error response body:`,
          JSON.stringify(err.response.data, null, 2),
        );
      }
      throw err;
    }
  }

  async getClasses(teacherId) {
    const query = `
      query GetClasses($teacherId: String, $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String) {
        classes(payload: {teacher_equals: $teacherId, pageIndex: $pageIndex, itemsPerPage: $itemsPerPage, orderBy: $orderBy}) {
          data {
            id
            name
            level
            status
            startDate
            endDate
            numberOfSessions
            sessionHour
            totalHour
            course {
              id
              name
              shortName
            }
            centre {
              id
              name
              shortName
            }
            teachers {
              _id
              teacher {
                id
                username
                fullName
                email
              }
              role {
                id
                name
                shortName
              }
              isActive
            }
            slots {
              _id
              date
              startTime
              endTime
              summary
              studentAttendance {
                _id
                student {
                  id
                  fullName
                }
                status
                comment
                sendCommentStatus
              }
            }
          }
        }
      }
    `;
    const variables = {
      teacherId,
      pageIndex: 0,
      itemsPerPage: 100,
      orderBy: "createdAt_desc",
    };

    const res = await axios.post(
      this.gatewayUrl,
      {
        operationName: "GetClasses",
        query,
        variables,
      },
      { headers: this.headers },
    );

    if (res.data.errors) throw new Error(res.data.errors[0].message);
    return res.data.data.classes.data;
  }

  async updateEvaluation(payload) {
    const query = `
      mutation UpdateSlotComment($payload: UpdateSlotCommentCommand!) {
        classes {
          updateSlotComment(payload: $payload) {
            id
          }
        }
      }
    `;

    const res = await axios.post(
      this.gatewayUrl,
      {
        operationName: "UpdateSlotComment",
        query,
        variables: { payload },
      },
      { headers: this.headers },
    );

    if (res.data.errors) throw new Error(res.data.errors[0].message);
    return res.data.data.classes.updateSlotComment;
  }

  async query(operationName, query, variables) {
    const res = await axios.post(
      this.gatewayUrl,
      {
        operationName,
        query,
        variables,
      },
      { headers: this.headers },
    );

    if (res.data.errors) throw new Error(res.data.errors[0].message);
    return res.data.data;
  }
}

module.exports = LMSClient;
