const axios = require("axios");
const config = require("../config/index");

class LMSClient {
  constructor(token) {
    this.token = token;
    const lmsConfig = config.lms;
    this.gatewayUrl = lmsConfig.gatewayGraphql;
    this.baseUrl = lmsConfig.baseGraphql;

    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Origin: lmsConfig.origin || "",
      Referer: lmsConfig.referer || "",
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

  async getTeacherByUserId(userId) {
    console.log(
      `[LMSClient] Getting Teacher info from MindX User ID: ${userId}`,
    );
    const query = `
      query teacherByUserId($user: String) {
        teacherByUserId(payload: { user: $user }) {
          id
          email
          fullName
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
        return teacher;
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

  async getTeacherIdByUserId(userId) {
    const teacher = await this.getTeacherByUserId(userId);
    return teacher.id;
  }

  async getClasses(
    teacherId = null,
    centreIds = null,
    statusIn = null,
    fetchAllPages = false,
  ) {
    console.log("[LMSClient] getClasses start.", {
      teacherId,
      centreIds,
      fetchAllPages,
      statusIn,
    });
    try {
      const payloadFields = [];
      const signatureFields = [
        "$pageIndex: Int!",
        "$itemsPerPage: Int!",
        "$orderBy: String",
      ];

      if (teacherId) {
        payloadFields.push("teacher_equals: $teacherId");
        signatureFields.push("$teacherId: String");
      }
      if (centreIds && centreIds.length > 0) {
        payloadFields.push("centre_in: $centres");
        signatureFields.push("$centres: [String]");
      }
      if (statusIn && statusIn.length > 0) {
        payloadFields.push("status_in: $statusIn");
        signatureFields.push("$statusIn: [String]");
      }
      payloadFields.push("pageIndex: $pageIndex");
      payloadFields.push("itemsPerPage: $itemsPerPage");
      payloadFields.push("orderBy: $orderBy");

      const payloadStr = payloadFields.join(", ");
      const signatureStr = signatureFields.join(", ");

      const query = `
      query GetClasses(${signatureStr}) {
        classes(payload: {${payloadStr}}) {
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
              teachers {
                teacher {
                  id
                  fullName
                }
                role {
                  shortName
                }
                isActive
              }
            }
          }
          pagination {
            total
          }
        }
      }
    `;
      let allData = [];
      let currentPageIndex = 0;
      const itemsPerPage = 100;
      let hasMore = true;

      while (hasMore) {
        const variables = {
          teacherId: teacherId || undefined,
          centres: centreIds && centreIds.length > 0 ? centreIds : undefined,
          statusIn: statusIn && statusIn.length > 0 ? statusIn : undefined,
          pageIndex: currentPageIndex,
          itemsPerPage,
          orderBy: "createdAt_desc",
        };

        let res;
        let retries = 2;
        while (retries >= 0) {
          try {
            res = await axios.post(
              this.gatewayUrl,
              {
                operationName: "GetClasses",
                query,
                variables,
              },
              { headers: this.headers },
            );
            break;
          } catch (e) {
            if (e.response && e.response.status === 502 && retries > 0) {
              console.log(
                `[LMSClient] 502 Bad Gateway for GetClasses. Retrying... (${retries} left)`,
              );
              retries--;
              await new Promise((r) => setTimeout(r, 1000));
            } else {
              throw e;
            }
          }
        }

        if (!res || !res.data) {
          throw new Error("Empty response from LMS API");
        }

        if (res.data.errors) {
          console.error(
            "[LMSClient] GetClasses GraphQL errors:",
            res.data.errors,
          );
          throw new Error(res.data.errors[0].message);
        }

        if (!res.data.data || !res.data.data.classes) {
          console.error(
            "[LMSClient] GetClasses: Invalid response structure",
            res.data,
          );
          return allData;
        }

        const pageData = res.data.data.classes.data || [];
        const totalCount = res.data.data.classes.pagination?.total || 0;
        allData = allData.concat(pageData);

        if (
          !fetchAllPages ||
          pageData.length === 0 ||
          allData.length >= totalCount
        ) {
          hasMore = false;
        } else {
          currentPageIndex++;
        }
      }

      return allData;
    } catch (err) {
      console.error("[LMSClient] getClasses failed:", err.message);
      throw err;
    }
  }

  async getClassByIdForNotifications(classId) {
    // Tối ưu hoá câu query GraphQL, CHỈ lấy những trường cần thiết cho việc tính Notifications
    try {
      const query = `
      query GetClassByIdForNotifications($id: ID!) {
        classesById(id: $id) {
          id
          name
          status
          slots {
            date
            endTime
            studentAttendance {
              comment
              status
            }
            teachers {
              teacher {
                id
                email
                personalEmail
                fullName
              }
              role {
                shortName
              }
              isActive
            }
          }
          teachers {
            teacher {
              id
              email
              personalEmail
              fullName
            }
            role {
              shortName
            }
          }
        }
      }
      `;
      const variables = { id: classId };

      const res = await axios.post(
        this.gatewayUrl,
        {
          operationName: "GetClassByIdForNotifications",
          query,
          variables,
        },
        { headers: this.headers },
      );

      if (!res || !res.data) {
        throw new Error("Empty response from LMS API");
      }

      if (res.data.errors) {
        throw new Error(res.data.errors[0].message);
      }

      return res.data.data?.classesById;
    } catch (err) {
      console.error(
        `[LMSClient] getClassByIdForNotifications failed for ${classId}:`,
        err.message,
      );
      throw err;
    }
  }

  async getClassesNotificationsDetails(classIds) {
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return [];
    }

    const results = [];
    // Tăng batch size để lấy dữ liệu nhanh hơn, bỏ delay cứng
    const batchSize = 6;

    for (let i = 0; i < classIds.length; i += batchSize) {
      const batch = classIds.slice(i, i + batchSize);
      console.log(
        `[LMSClient] Fetching notification details batch ${Math.floor(i / batchSize) + 1} (${batch.length} classes)...`,
      );

      const batchResults = await Promise.all(
        batch.map(async (classId) => {
          let retries = 2;
          while (retries >= 0) {
            try {
              return await this.getClassByIdForNotifications(classId);
            } catch (err) {
              // Lỗi xác thực thì văng ra ngoài ngay
              if (
                err.message.includes("Authentication failed") ||
                err.message.includes("auth") ||
                err.response?.status === 401 ||
                err.response?.status === 403
              ) {
                throw err;
              }
              // Lỗi mạng hoặc 502/429 => Retry
              if (retries > 0) {
                console.log(
                  `[LMSClient] Retrying fetch for class ${classId} due to error: ${err.message}. Retries left: ${retries}`,
                );
                await new Promise((r) => setTimeout(r, 500)); // Đợi nhẹ 0.5s trước khi retry
                retries--;
              } else {
                return null;
              }
            }
          }
          return null;
        }),
      );
      results.push(...batchResults);
    }

    return results.filter(Boolean);
  }

  async getClassesDetails(classIds) {
    console.log(
      "[LMSClient] getClassesDetails start. Number of classIds:",
      classIds?.length || 0,
    );

    if (!Array.isArray(classIds) || classIds.length === 0) {
      return [];
    }

    // Tối ưu: Xử lý theo batch để tránh làm quá tải Gateway LMS (Promise.all quá nhiều request cùng lúc)
    const results = [];
    const batchSize = 4;

    for (let i = 0; i < classIds.length; i += batchSize) {
      const batch = classIds.slice(i, i + batchSize);
      console.log(
        `[LMSClient] Fetching batch ${Math.floor(i / batchSize) + 1} (${batch.length} classes)...`,
      );

      const batchResults = await Promise.all(
        batch.map(async (classId) => {
          try {
            return await this.getClassById(classId);
          } catch (err) {
            console.error(
              `[LMSClient] Failed to fetch details for class ${classId}:`,
              err.message,
            );
            return null;
          }
        }),
      );
      results.push(...batchResults);
    }

    const filteredResults = results.filter(Boolean);
    console.log(
      `[LMSClient] getClassesDetails finished. Found ${filteredResults.length}/${classIds.length} details.`,
    );

    return filteredResults;
  }

  async getClassById(classId) {
    console.log("[LMSClient] getClassById start. ClassId:", classId);
    try {
      // Sử dụng query GetClassById chuẩn lms để lấy đầy đủ chi tiết lớp học phục vụ trang chi tiết (bao gồm slots, teachers, studentAttendance,...)
      const query = `
      query GetClassById($id: ID!) {
        classesById(id: $id) {
          id
          name
          level
          rejectNote
          course {
            id
            name
            shortName
            isActive
            numberOfSession
            sessionHour
            description
            minStudents
            maxEnrollSession
            maxStudents
            optimalStudents
          }
          startDate
          endDate
          status
          centre {
            id
            name
            shortName
          }
          numberOfSessions
          sessionHour
          totalHour
          slots {
            _id
            date
            startTime
            endTime
            index
            sessionHour
            summary
            homework
            learningLessonId
            teachers {
              _id
              teacher {
                id
                username
                code
                fullName
                email
                phoneNumber
                imageUrl
              }
              role {
                id
                name
                shortName
              }
              isActive
            }
            studentAttendance {
              _id
              student {
                id
                fullName
                phoneNumber
                email
                gender
                imageUrl
              }
              comment
              sendCommentStatus
              status
            }
          }
          students {
            _id
            student {
              id
              fullName
              status
              phoneNumber
              email
              gender
              imageUrl
            }
            note
            activeInClass
            completed
          }
          teachers {
            _id
            teacher {
              id
              username
              code
              fullName
              email
              phoneNumber
              imageUrl
            }
            role {
              id
              name
              shortName
            }
            isActive
          }
        }
      }
      `;
      const variables = { id: classId };

      // Thêm retry đơn giản cho lỗi 502 với Exponential Backoff
      let res;
      let retries = 4;
      let delay = 1000;
      while (retries >= 0) {
        try {
          res = await axios.post(
            this.gatewayUrl,
            {
              operationName: "GetClassById",
              query,
              variables,
            },
            { headers: this.headers },
          );
          break; // success
        } catch (e) {
          if (e.response && e.response.status === 502 && retries > 0) {
            console.log(
              `[LMSClient] 502 Bad Gateway for GetClassById(${classId}). Retrying... (${retries} left)`,
            );
            retries--;
            await new Promise((r) => setTimeout(r, delay));
            delay *= 2;
          } else {
            throw e;
          }
        }
      }

      if (!res || !res.data) {
        throw new Error("Empty response from LMS API");
      }

      if (res.data.errors) {
        throw new Error(res.data.errors[0].message);
      }

      return res.data.data?.classesById;
    } catch (err) {
      console.error(
        `[LMSClient] getClassByIdForNotifications failed for ${classId}:`,
        err.message,
      );
      throw err;
    }
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

    if (!res || !res.data) throw new Error("Empty response from LMS API");
    if (res.data.errors) throw new Error(res.data.errors[0].message);
    return res.data.data?.classes?.updateSlotComment;
  }

  async getCourseVersionByClass(classId) {
    console.log("[LMSClient] getCourseVersionByClass start. ClassId:", classId);
    try {
      const query = `
      query FindCourseVersionByClass($classId: String!) {
        findCourseVersionByClass(payload: { classId: $classId }) {
          usedVersion {
            id
            name
            isEnabled
            learningCourseId
            description
          }
          lessons {
            id
            name
            type
            isActive
            learningCourseId
            displayOrder
            courseVersionId
          }
          versions {
            id
            name
            isEnabled
            learningCourseId
            description
          }
        }
      }
      `;

      const res = await axios.post(
        this.gatewayUrl,
        {
          operationName: "FindCourseVersionByClass",
          query,
          variables: { classId },
        },
        { headers: this.headers },
      );

      if (!res || !res.data) throw new Error("Empty response from LMS API");
      if (res.data.errors) {
        console.error(
          "[LMSClient] FindCourseVersionByClass errors:",
          JSON.stringify(res.data.errors, null, 2),
        );
        throw new Error(res.data.errors[0].message);
      }

      const data = res.data.data?.findCourseVersionByClass;
      if (!data) return null;

      const usedVersionId = data.usedVersion?.id;
      const lessons = Array.isArray(data.lessons)
        ? data.lessons
            .filter(
              (lesson) =>
                lesson.isActive &&
                lesson.courseVersionId === usedVersionId &&
                ["REVIEW_AND_PRACTICE", "CHECKPOINT"].includes(lesson.type),
            )
            .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
        : [];

      return {
        usedVersion: data.usedVersion,
        lessons,
        versions: data.versions || [],
      };
    } catch (err) {
      console.error(
        "[LMSClient] getCourseVersionByClass failed:",
        err.message,
        err.response?.data ? JSON.stringify(err.response.data, null, 2) : "",
      );
      throw err;
    }
  }

  async getStudentSubmissionsByClass(classId) {
    console.log(
      "[LMSClient] getStudentSubmissionsByClass start. ClassId:",
      classId,
    );
    try {
      const query = `
      query FindStudentSubmissionByClass($payload: FindStudentSubmissionByClassQuery) {
        findStudentSubmissionByClass(payload: $payload) {
          students {
            id
            displayName
            studentUid
            __typename
          }
          lessons {
            id
            name
            type
            isActive
            displayOrder
            __typename
          }
          submissions {
            id
            type
            note
            score
            status
            category
            classId
            lessonId
            learningCourseId
            studentUid
            markedAt
            markedBy
            createdAt
            submittedAt
            submittedCount
            content {
              scratchState
              type
              attachments
              totalQuiz
              submitQuiz
              correctAnswer
              __typename
            }
            __typename
          }
          __typename
        }
      }
      `;

      const res = await axios.post(
        this.gatewayUrl,
        {
          operationName: "FindStudentSubmissionByClass",
          query,
          variables: {
            payload: { classId },
          },
        },
        { headers: this.headers },
      );

      if (!res || !res.data) throw new Error("Empty response from LMS API");
      if (res.data.errors) {
        console.error(
          "[LMSClient] GraphQL errors:",
          JSON.stringify(res.data.errors, null, 2),
        );
        throw new Error(res.data.errors[0].message);
      }

      const raw = res.data.data?.findStudentSubmissionByClass;
      if (!raw) return { students: [], lessons: [], submissions: [] };

      return {
        students: raw.students || [],
        lessons: raw.lessons || [],
        submissions: raw.submissions || [],
      };
    } catch (err) {
      console.error(
        "[LMSClient] getStudentSubmissionsByClass failed:",
        err.message,
        err.response?.data ? JSON.stringify(err.response.data, null, 2) : "",
      );
      throw err;
    }
  }

  async getProfile(userId) {
    try {
      const query = `query GetProfile($id: String!) { User_getById(id: $id) { id email firstName lastName givenName username isActive } }`;
      const profileRes = await axios.post(
        this.baseUrl,
        {
          operationName: "GetProfile",
          query,
          variables: { id: userId },
        },
        { headers: this.headers },
      );
      if (profileRes.data.errors) {
        console.error("[LMSClient] GetProfile errors:", profileRes.data.errors);
        return null;
      }
      return profileRes.data.data?.User_getById;
    } catch (err) {
      console.error("[LMSClient] GetProfile request failed:", err.message);
      return null;
    }
  }

  async getTeacherSchedules(teacherId, dateGte, dateLte) {
    console.log(
      `[LMSClient] getTeacherSchedules start for teacher: ${teacherId}`,
    );
    try {
      const query = `
        query findTeacherSchedule($dateGte: String!, $dateLte: String!, $type: [String], $teacherId: String!) {
          findTeacherSchedule(payload: {
            date_gte: $dateGte,
            date_lte: $dateLte,
            type_in: $type,
            teacherId_eq: $teacherId
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
                class { id name }
                centre { id name }
              }
              officeHour {
                type
                centre { id name }
              }
            }
          }
        }
      `;

      const variables = {
        dateGte,
        dateLte,
        type: ["CLASS_SESSION", "OFFICE_HOURS"], // Loại bỏ "AVAILABLE" khỏi request để server không trả về dữ liệu rỗng
        teacherId: teacherId.toString(),
      };

      const res = await axios.post(
        this.gatewayUrl,
        {
          operationName: "findTeacherSchedule",
          query,
          variables,
        },
        { headers: this.headers },
      );

      if (res.data.errors) {
        console.error(
          `[LMSClient] findTeacherSchedule errors for ${teacherId}:`,
          res.data.errors,
        );
        throw new Error(res.data.errors[0].message);
      }

      return res.data.data?.findTeacherSchedule?.data || [];
    } catch (err) {
      console.error(
        `[LMSClient] getTeacherSchedules failed for ${teacherId}:`,
        err.message,
      );
      throw err;
    }
  }

  async getTeacherSchedulesBatch(teacherIds, dateGte, dateLte) {
    console.log(
      `[LMSClient] getTeacherSchedulesBatch start for ${teacherIds.length} teachers`,
    );
    if (!teacherIds || teacherIds.length === 0) return [];

    try {
      const allResults = [];
      const batchSize = 20;

      for (let i = 0; i < teacherIds.length; i += batchSize) {
        const chunk = teacherIds.slice(i, i + batchSize);

        const queries = chunk
          .map((id) => {
            const safeId = id.toString().replace(/[^a-zA-Z0-9]/g, "");
            return `
            t_${safeId}: findTeacherSchedule(payload: {
              date_gte: $dateGte,
              date_lte: $dateLte,
              type_in: $type,
              teacherId_eq: "${id}"
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
                  class { id name }
                  centre { id name }
                }
                officeHour {
                  type
                  centre { id name }
                }
              }
            }
          `;
          })
          .join("\n");

        const query = `
          query findMultipleTeacherSchedules($dateGte: String!, $dateLte: String!, $type: [String]) {
            ${queries}
          }
        `;

        const variables = {
          dateGte,
          dateLte,
          type: ["CLASS_SESSION", "OFFICE_HOURS"],
        };

        const res = await axios.post(
          this.gatewayUrl,
          {
            operationName: "findMultipleTeacherSchedules",
            query,
            variables,
          },
          { headers: this.headers },
        );

        if (res.data.errors) {
          const failedPaths = res.data.errors
            .map((err) => err.path?.[0])
            .filter(Boolean);
          console.warn(
            `[LMSClient] getTeacherSchedulesBatch partial errors for ${res.data.errors.length} teachers. Failed paths (Forbidden, etc.):`,
            failedPaths.join(", "),
          );
        }

        const data = res.data.data || {};
        Object.keys(data).forEach((key) => {
          const list = data[key]?.data || [];
          // Extract the original teacher ID from the alias (e.g., t_6a2a...)
          const actualTeacherId = key.replace(/^t_/, "");

          list.forEach((sch) => {
            // Guarantee teacherId is populated, because LMS might omit it
            sch.teacherId = sch.teacherId || actualTeacherId;
          });

          allResults.push(...list);
        });
      }

      return allResults;
    } catch (err) {
      console.error(
        `[LMSClient] getTeacherSchedulesBatch general failure:`,
        err.message,
      );
      return [];
    }
  }

  async getTeachers(
    centers = ["6443460f94300678908f7974"],
    pageIndex = 0,
    itemsPerPage = 100,
  ) {
    console.log("[LMSClient] getTeachers start. Centers:", centers);
    try {
      const query = `
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
              handleScore
              hourlyRate
              username
              user
              firebaseId
              fullName
              code
              phoneNumber
              email
              personalEmail
              gender
              dob
              imageUrl
              address
              socialMediaLink
              courseLines {
                id
                name
                __typename
              }
              courses {
                id
                name
                shortName
                courseTopic {
                  id
                  name
                  __typename
                }
                __typename
              }
              notes
              isActive
              createdAt
              createdBy
              lastModifiedAt
              lastModifiedBy
              teacherPoint
              joinedDate
              centres {
                id
                name
                __typename
              }
              __typename
            }
            pagination {
              type
              total
              __typename
            }
            __typename
          }
        }
      `;
      const variables = {
        search: "",
        pageIndex,
        itemsPerPage,
        orderBy: "createdAt_desc",
        centers,
        joinedDate: [null, null],
      };

      const res = await axios.post(
        this.gatewayUrl,
        {
          operationName: "GetTeachers",
          query,
          variables,
        },
        { headers: this.headers },
      );

      if (!res || !res.data) throw new Error("Empty response from LMS API");
      if (res.data.errors) {
        console.error(
          "[LMSClient] GetTeachers GraphQL errors:",
          JSON.stringify(res.data.errors, null, 2),
        );
        throw new Error(res.data.errors[0].message);
      }

      return res.data.data?.teachers || { data: [], pagination: { total: 0 } };
    } catch (err) {
      console.error(
        "[LMSClient] getTeachers failed:",
        err.message,
        err.response?.data ? JSON.stringify(err.response.data, null, 2) : "",
      );
      throw err;
    }
  }

  async query(operationName, query, variables, retries = 2) {
    try {
      const res = await axios.post(
        this.gatewayUrl,
        {
          operationName,
          query,
          variables,
        },
        { headers: this.headers },
      );

      if (res.data.errors) {
        const firstError = res.data.errors[0].message;
        // Nếu gặp lỗi Connection dropped (mã 14) và vẫn còn số lần thử lại
        if (
          (firstError.includes("14 UNAVAILABLE") ||
            firstError.includes("Connection dropped")) &&
          retries > 0
        ) {
          console.warn(
            `[LMSClient] Connection dropped. Retrying... (${retries} left)`,
          );
          // Đợi 1s trước khi thử lại
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return this.query(operationName, query, variables, retries - 1);
        }
        throw new Error(firstError);
      }
      return res.data.data;
    } catch (err) {
      if (retries > 0 && err.code !== "ECONNABORTED") {
        console.warn(
          `[LMSClient] Request failed. Retrying... (${retries} left)`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.query(operationName, query, variables, retries - 1);
      }
      throw err;
    }
  }
}

module.exports = LMSClient;
