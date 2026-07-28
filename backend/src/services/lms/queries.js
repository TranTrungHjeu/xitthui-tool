/**
 * LMS GraphQL Query Strings
 *
 * All GraphQL query and mutation strings used by the LMS client.
 * Extracted here to make queries searchable, testable, and reusable.
 * IDEs can parse these to provide schema validation.
 */

// ---- Auth & Profile ----

const GET_USER_BY_FIREBASE_ID = `
  query User_getByFirebaseId($id: String!) {
    User_getByFirebaseId(firebaseId: $id) {
      id
    }
  }
`;

const GET_PROFILE = `
  query GetProfile($id: String!) {
    User_getById(id: $id) {
      id email firstName lastName givenName username isActive
    }
  }
`;

// ---- Teachers ----

const GET_TEACHER_BY_USER_ID = `
  query teacherByUserId($user: String) {
    teacherByUserId(payload: { user: $user }) {
      id
      email
      fullName
    }
  }
`;

const GET_TEACHERS = `
  query GetTeachers(
    $search: String,
    $isActive: Boolean,
    $courseLine: String,
    $course: String,
    $pageIndex: Int!,
    $itemsPerPage: Int!,
    $orderBy: String,
    $idNotIn: [String],
    $centers: [String],
    $teacherPointFrom: Float,
    $teacherPointTo: Float,
    $joinedDate: [String]
  ) {
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
        id handleScore hourlyRate username user firebaseId fullName code phoneNumber
        email personalEmail gender dob imageUrl address socialMediaLink courseLines { id name __typename }
        courses { id name shortName courseTopic { id name __typename } __typename }
        notes isActive createdAt createdBy lastModifiedAt lastModifiedBy teacherPoint joinedDate
        centres { id name __typename }
        __typename
      }
      pagination { type total __typename }
      __typename
    }
  }
`;

// ---- Classes ----

const GET_CLASSES = `
  query GetClasses(
    $pageIndex: Int!,
    $itemsPerPage: Int!,
    $orderBy: String,
    $teacherSlot: [String],
    $centres: [String],
    $statusIn: [String]
  ) {
    classes(payload: {
      pageIndex: $pageIndex,
      itemsPerPage: $itemsPerPage,
      orderBy: $orderBy,
      teacherSlots: $teacherSlot,
      centre_in: $centres,
      status_in: $statusIn
    }) {
      data {
        id name level status startDate endDate numberOfSessions sessionHour totalHour
        course { id name shortName }
        centre { id name shortName }
        teachers {
          _id teacher { id username fullName email }
          role { id name shortName }
          isActive
        }
        slots {
          _id date startTime endTime
          teachers { teacher { id fullName } role { shortName } isActive }
        }
      }
      pagination { total }
    }
  }
`;

const GET_CLASS_BY_ID = `
  query GetClassById($id: ID!) {
    classesById(id: $id) {
      id name level rejectNote
      course { id name shortName isActive numberOfSession sessionHour description minStudents maxEnrollSession maxStudents optimalStudents }
      startDate endDate status
      centre { id name shortName }
      numberOfSessions sessionHour totalHour
      slots {
        _id date startTime endTime index sessionHour summary homework learningLessonId
        teachers { _id teacher { id username code fullName email phoneNumber imageUrl }
          role { id name shortName } isActive }
        studentAttendance {
          _id student { id fullName phoneNumber email gender imageUrl }
          comment sendCommentStatus status
        }
      }
      students {
        _id student { id fullName status phoneNumber email gender imageUrl }
        note activeInClass completed
      }
      teachers {
        _id teacher { id username code fullName email phoneNumber imageUrl }
        role { id name shortName }
        isActive
      }
    }
  }
`;

const GET_CLASS_BY_ID_FOR_NOTIFICATIONS = `
  query GetClassByIdForNotifications($id: ID!) {
    classesById(id: $id) {
      id name status
      slots {
        date startTime endTime index
        studentAttendance { comment status }
        teachers {
          teacher { id email personalEmail fullName }
          role { shortName }
          isActive
        }
      }
      teachers {
        teacher { id email personalEmail fullName }
        role { shortName }
      }
    }
  }
`;

// ---- Attendance & Evaluation ----

const UPDATE_SLOT_COMMENT = `
  mutation UpdateSlotComment($payload: UpdateSlotCommentCommand!) {
    classes {
      updateSlotComment(payload: $payload) {
        id
      }
    }
  }
`;

// ---- Course Versions ----

const FIND_COURSE_VERSION_BY_CLASS = `
  query FindCourseVersionByClass($classId: String!) {
    findCourseVersionByClass(payload: { classId: $classId }) {
      usedVersion { id name isEnabled learningCourseId description }
      lessons { id name type isActive learningCourseId displayOrder courseVersionId }
      versions { id name isEnabled learningCourseId description }
    }
  }
`;

// ---- Student Submissions ----

const FIND_STUDENT_SUBMISSION_BY_CLASS = `
  query FindStudentSubmissionByClass($payload: FindStudentSubmissionByClassQuery) {
    findStudentSubmissionByClass(payload: $payload) {
      students { id displayName studentUid __typename }
      lessons { id name type isActive displayOrder __typename }
      submissions {
        id type note score status category classId lessonId learningCourseId studentUid markedAt markedBy
        createdAt submittedAt submittedCount
        content { scratchState type attachments totalQuiz submitQuiz correctAnswer __typename }
        __typename
      }
      __typename
    }
  }
`;

// ---- Schedules ----

const FIND_TEACHER_SCHEDULE = `
  query findTeacherSchedule(
    $dateGte: String!,
    $dateLte: String!,
    $type: [String],
    $teacherId: String!
  ) {
    findTeacherSchedule(payload: {
      date_gte: $dateGte,
      date_lte: $dateLte,
      type_in: $type,
      teacherId_eq: $teacherId
    }) {
      data {
        id teacherId title description date startTime endTime type
        classSite { class { id name } centre { id name } }
        officeHour { type centre { id name } }
      }
    }
  }
`;

const FIND_MULTIPLE_TEACHER_SCHEDULES = `
  query findMultipleTeacherSchedules($dateGte: String!, $dateLte: String!, $type: [String]) {
    __placeholder
  }
`;

module.exports = {
  GET_USER_BY_FIREBASE_ID,
  GET_PROFILE,
  GET_TEACHER_BY_USER_ID,
  GET_TEACHERS,
  GET_CLASSES,
  GET_CLASS_BY_ID,
  GET_CLASS_BY_ID_FOR_NOTIFICATIONS,
  UPDATE_SLOT_COMMENT,
  FIND_COURSE_VERSION_BY_CLASS,
  FIND_STUDENT_SUBMISSION_BY_CLASS,
  FIND_TEACHER_SCHEDULE,
  FIND_MULTIPLE_TEACHER_SCHEDULES,
};
