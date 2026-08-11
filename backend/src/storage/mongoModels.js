const mongoose = require("mongoose");
const { encryptToken, decryptToken } = require("../utils/tokenEncryption");

// 1. Session Schema
const SessionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // sessionId
    userId: { type: String, required: true },
    teacherId: { type: String, default: null },
    lmsRefreshToken: { type: String, default: "" },
    userAgent: { type: String, default: "unknown" },
    centreIds: { type: [String], default: [] },
    roles: { type: [String], default: [] },
    isValid: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now, expires: "30d" } // Auto delete after 30 days
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// Encrypt token before saving (Mongoose 9: use async instead of next())
SessionSchema.pre("save", async function() {
  if (this.isModified("lmsRefreshToken") && this.lmsRefreshToken) {
    this.lmsRefreshToken = encryptToken(this.lmsRefreshToken);
  }
});

// Decrypt token after finding
SessionSchema.post("findOne", function(doc) {
  if (doc && doc.lmsRefreshToken) {
    doc.lmsRefreshToken = decryptToken(doc.lmsRefreshToken);
  }
});
SessionSchema.post("find", function(docs) {
  if (Array.isArray(docs)) {
    docs.forEach(doc => {
      if (doc && doc.lmsRefreshToken) {
        doc.lmsRefreshToken = decryptToken(doc.lmsRefreshToken);
      }
    });
  }
});

// 2. Active Token Schema
const ActiveTokenSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // teacherId || userId
    token: { type: String, required: true },
    centreIds: { type: [String], default: [] },
    roles: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now, expires: "2h" } // Auto delete after 2 hours
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// 3. Notification Ticket Schema
const NotificationTicketSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // `${classId}_${date}`
    classId: { type: String, required: true },
    className: { type: String, required: true },
    date: { type: String, required: true },
    studentCount: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false },
    lec: { type: String, default: null },
    ta: { type: String, default: null },
    te: { type: String, default: null },
    startTime: { type: String, default: null },
    endTime: { type: String, default: null },
    sessionIndex: { type: Number, default: null },
    teacherIds: { type: [String], default: [] },
    centreIds: { type: [String], default: [] },
    updatedAt: { type: Date, default: Date.now, expires: "14d" } // Auto delete after 14 days
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// 4. Student Schema
const StudentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // studentId
    fullName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    classes: [
      {
        id: { type: String, required: true },
        name: { type: String, default: "" },
        status: { type: String, default: "" },
        centreId: { type: String, default: "" },
        teacherIds: { type: [String], default: [] },
        attendanceRate: { type: Number, default: null },
        homeworkRate: { type: Number, default: null }
      }
    ],
    centreIds: { type: [String], default: [] },
    teacherIds: { type: [String], default: [] },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// 5. Class Schema
const ClassSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // LMS classId
    name: { type: String, required: true },
    status: { type: String, required: true },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    course: {
      id: { type: String, default: null },
      name: { type: String, default: null },
      shortName: { type: String, default: null },
    },
    centre: {
      id: { type: String, default: null },
      name: { type: String, default: null },
      shortName: { type: String, default: null },
    },
    teachers: { type: mongoose.Schema.Types.Mixed, default: [] },
    slots: { type: mongoose.Schema.Types.Mixed, default: [] },
    students: { type: mongoose.Schema.Types.Mixed },
    computed: {
      weekdayIndexes: { type: [Number], default: [] },
      lecName: { type: String, default: "-" },
      taName: { type: String, default: "-" },
      timeRange: { type: String, default: "N/A" },
      weekdays: { type: String, default: "N/A" },
      searchString: { type: String, default: "" },
      category: { type: String, default: "unknown" },
      currentSessionIndex: { type: Number, default: 0 }
    },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// 8. Schedule Schema
const ScheduleSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // LMS scheduleId
    teacherId: { type: String, required: true, index: true },
    title: { type: String },
    description: { type: String },
    date: { type: String, index: true },
    startTime: { type: String },
    endTime: { type: String },
    type: { type: String },
    classSite: {
      class: {
        id: { type: String },
        name: { type: String }
      },
      centre: {
        id: { type: String },
        name: { type: String }
      }
    },
    officeHour: {
      type: { type: String },
      centre: {
        id: { type: String },
        name: { type: String }
      }
    },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// 9. Trial Booking Schema (covers trial / substitute / examiner booking kinds)
const TrialBookingSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // `${dateStr}_${slotId}_${slotKind}`
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    slotId: { type: String, required: true }, // e.g. "row_12" or "slot_18:00" or "cs_<scheduleId>"
    slotKind: {
      type: String,
      enum: ["trial", "substitute", "examiner"],
      default: "trial",
      index: true,
    },
    role: { type: String, enum: ["LEC", "TA", "GK", null], default: null },
    classId: { type: String, default: null },
    className: { type: String, default: null },
    sessionIndex: { type: Number, default: null },
    sessionDate: { type: String, default: null }, // YYYY-MM-DD (for substitute/examiner)
    timeSlot: { type: String, required: true }, // e.g. "18:00" or "9H"
    normalizedTime: { type: String, required: true }, // "HH:MM"
    subject: { type: String, default: "N/A" },
    type: { type: String, default: "N/A" },
    roomLink: { type: String, default: "" },
    students: { type: [String], default: [] },
    rowIndex: { type: Number, default: null }, // sheet row number (trial only)
    teacherId: { type: String, default: null },
    teacherCode: { type: String, default: null },
    teacherName: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

TrialBookingSchema.index({ date: 1, slotKind: 1, role: 1 });

// 9b. Booking Audit Schema
const BookingAuditSchema = new mongoose.Schema(
  {
    action: { type: String, enum: ["assign", "unassign"], required: true },
    bookingType: {
      type: String,
      enum: ["trial", "substitute", "examiner"],
      required: true,
    },
    classId: { type: String, default: null },
    className: { type: String, default: null },
    sessionIndex: { type: Number, default: null },
    sessionDate: { type: String, default: null },
    slotId: { type: String, default: null },
    slotKind: { type: String, default: null },
    role: { type: String, default: null },
    teacherId: { type: String, default: null },
    teacherCode: { type: String, default: null },
    teacherName: { type: String, default: null },
    performedBy: { type: String, default: null },
    performedByName: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

BookingAuditSchema.index({ sessionDate: 1, classId: 1 });

// 10. Office Hour Schema
const OfficeHourSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // LMS officeHourId
    courses: [
      {
        id: { type: String },
        name: { type: String },
        shortName: { type: String }
      }
    ],
    courseLines: [
      {
        id: { type: String },
        name: { type: String }
      }
    ],
    courseTopics: [
      {
        id: { type: String },
        name: { type: String }
      }
    ],
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true },
    status: { type: String, required: true },
    centre: {
      id: { type: String, required: true, index: true },
      name: { type: String },
      shortName: { type: String }
    },
    teacher: {
      id: { type: String, index: true },
      username: { type: String },
      code: { type: String },
      fullName: { type: String },
      imageUrl: { type: String },
      email: { type: String, index: true },
      phoneNumber: { type: String }
    },
    class: {
      id: { type: String },
      name: { type: String }
    },
    classSiteId: { type: String },
    note: { type: String },
    managerNote: { type: String },
    type: { type: String },
    links: [
      {
        _id: { type: String },
        title: { type: String },
        link: { type: String }
      }
    ],
    studentCount: { type: Number, default: 0 },
    custom: { type: mongoose.Schema.Types.Mixed },
    createdBy: {
      username: { type: String }
    },
    createdAt: { type: Date },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// 11. Teacher Visibility Preferences Schema
const TeacherVisibilityPrefsSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // userId
    hiddenTeacherIds: { type: [String], default: [] },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// 12. Teacher Schema (synced from LMS by TeacherScheduler)
const TeacherSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // LMS teacherId
    fullName: { type: String, default: "" },
    username: { type: String, default: "" },
    user: { type: String, default: "" },
    firebaseId: { type: String, default: "" },
    code: { type: String, default: "" },
    email: { type: String, default: "" },
    personalEmail: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    gender: { type: String, default: "" },
    dob: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    address: { type: String, default: "" },
    socialMediaLink: { type: String, default: "" },
    notes: { type: String, default: "" },
    handleScore: { type: Number, default: null },
    hourlyRate: { type: Number, default: null },
    teacherPoint: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    joinedDate: { type: String, default: "" },
    createdAt: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    lastModifiedAt: { type: String, default: "" },
    lastModifiedBy: { type: String, default: "" },
    centres: [
      {
        id: { type: String, default: null },
        name: { type: String, default: null }
      }
    ],
    courseLines: [
      {
        id: { type: String, default: null },
        name: { type: String, default: null }
      }
    ],
    courses: [
      {
        id: { type: String, default: null },
        name: { type: String, default: null },
        shortName: { type: String, default: null },
        courseTopic: {
          id: { type: String, default: null },
          name: { type: String, default: null }
        }
      }
    ],
    syncedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// 13. Trial Report Schema (PDFs stored in Cloudflare R2)
const TrialReportSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // R2 object key (uuidv4-style id)
    fileId: { type: String, required: true },
    fileName: { type: String, default: "" },
    mimeType: { type: String, default: "application/pdf" },
    size: { type: Number, default: null },
    webViewLink: { type: String, default: "" }, // presigned R2 download URL (refreshed on demand)
    webContentLink: { type: String, default: "" },
    // R2 object key for the canonical storage layer.
    // Added when the upload went through R2; null/empty for legacy Drive rows.
    r2Key: { type: String, default: "" },
    parentFolderId: { type: String, default: "" }, // kept for legacy compat only
    reportType: {
      type: String,
      enum: ["Kiro4+", "Robotics", "Coding", "Art", "pdf-upload"],
      default: "pdf-upload",
      index: true,
    },
    classDate: { type: Date, default: null },
    teacherCode: { type: String, default: "" },
    teacherName: { type: String, default: "" },
    studentName: { type: String, default: "" },
    uploadedBy: { type: String, default: null },
    uploadedByName: { type: String, default: "" },
    uploadedByEmail: { type: String, default: "" },
    deletedAt: { type: Date, default: null, index: true },
    // === Versioning (correction re-uploads) ===
    // Each re-upload with the same studentName + teacherName + classDate
    // bumps `version` and links to the previous row via `previousReportId`.
    // `reportGroupId` is a stable id shared across all versions of the same
    // phiếu so a future "timeline" view can fetch the whole lineage in one
    // query.
    version: { type: Number, default: 1, index: true },
    previousReportId: {
      type: String,
      default: null,
    },
    reportGroupId: { type: String, default: "", index: true },
  },
  { timestamps: true }
);

TrialReportSchema.index({ classDate: 1, teacherCode: 1, deletedAt: 1 });
TrialReportSchema.index({ reportType: 1, createdAt: -1 });
// Composite index used by the version-bump lookup in the upload flow:
// "find the latest non-deleted row for this studentName/teacherName/classDate".
TrialReportSchema.index({
  studentName: 1,
  teacherName: 1,
  classDate: 1,
  deletedAt: 1,
  version: -1,
});

// 14. Trial Report Log Schema (audit trail — auto-deleted after 90 days)
const TrialReportLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["upload", "delete", "restore", "create-folder", "delete-request"],
      required: true,
    },
    reportId: { type: String, default: null },
    reportType: { type: String, default: "" },
    fileName: { type: String, default: "" },
    targetUserId: { type: String, default: null },
    performedBy: { type: String, default: null },
    performedByName: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now, expires: "90d", index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// NOTE: `TrialReportDeleteRequest` schema was removed when the 2-step
// request/review workflow was retired. The delete-password gate on
// `POST /trial-report/reports/:id/direct-delete` replaced it.

// 16. Lesson Schema (curriculum content for MindX subjects)
const LessonSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // `lsn_${courseCode}_${idx}`
    lessonCode: { type: String, default: "" },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    subject: {
      type: String,
      enum: ["Coding", "Robotics", "Art", "Kiro"],
      required: true,
    },
    courseCode: { type: String, default: "" },
    courseName: { type: String, default: "" },
    lessonNumber: { type: Number, default: 0 },
    duration: { type: Number, default: 60 },
    objectives: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    materials: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    createdBy: { type: String, default: null },
    createdByName: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

LessonSchema.index({ subject: 1, courseCode: 1, lessonNumber: 1 });
LessonSchema.index({ title: "text", description: "text", tags: "text" });

// 17. Lesson Content Schema (ordered blocks that make up a lesson)
const LessonContentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // `cnt_${lessonId}_${blockIdx}`
    lessonId: { type: String, required: true, ref: "Lesson" },
    lessonTitle: { type: String, default: "" },
    blockType: {
      type: String,
      enum: ["intro", "concept", "activity", "quiz", "wrap-up"],
      default: "intro",
    },
    blockIndex: { type: Number, default: 0 },
    title: { type: String, default: "" },
    content: { type: String, default: "" },
    resources: {
      type: [
        {
          url: { type: String, default: "" },
          label: { type: String, default: "" }
        }
      ],
      default: []
    },
    estimatedMinutes: { type: Number, default: 0 },
    createdBy: { type: String, default: null },
    createdByName: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

LessonContentSchema.index({ lessonId: 1, blockIndex: 1 });

// 18. LMS Criteria Template Schema (criteria for teacher comment generation)
const LMSCriteriaSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    subject: {
      type: String,
      enum: ["coding", "robotic", "art", "general"],
      default: "general",
      index: true,
    },
    type: { type: String, enum: ["default", "custom"], default: "custom" },
    sections: {
      type: [
        {
          title: { type: String, default: "" },
          criteria: {
            type: [
              {
                id: { type: String, default: "" },
                label: { type: String, default: "" },
                value: { type: String, default: "" },
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
    },
    createdBy: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

LMSCriteriaSchema.index({ subject: 1, type: 1 });

// 19b. Student Comment Schema (cached teacher comments per student per session, refreshed by scheduler)
const StudentCommentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // `${classId}::${studentId}::${sessionIndex}`
    classId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    sessionIndex: { type: Number, required: true },
    sessionDate: { type: String, default: null },
    comment: { type: String, default: "" },
    className: { type: String, default: null },
    studentName: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

StudentCommentSchema.index({ classId: 1, studentId: 1, sessionIndex: 1 }, { unique: true });

// 20. Zalo Comment Template Schema
const ZaloTemplateSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    template: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

// 21. Payroll Period Schema
// A "period" represents one monthly payroll file uploaded by a TE.
// All PayrollRecord rows for that month carry `periodId` so they can be
// archived or purged atomically by flipping status / expiresAt.
const PayrollPeriodSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // slug from label
    label: { type: String, required: true }, // e.g. "Công GV T7/2026"
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    originalFileName: { type: String, default: "" },
    uploadedById: { type: String, default: null },
    uploadedByName: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now },
    recordCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
    // Mongo TTL — auto-delete after expiresAt (see PAYROLL_TTL_MONTHS).
    expiresAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

PayrollPeriodSchema.index({ status: 1, year: -1, month: -1, uploadedAt: -1 });
// TTL: when `expiresAt` arrives, MongoDB removes the document. Set when
// the period is created (PAYROLL_TTL_MONTHS from .env). Note: only one
// TTL index is allowed per collection; nothing else here uses TTL so we
// can safely add this one.
PayrollPeriodSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 22. Payroll Record Schema
// Each row of the uploaded xlsx becomes one document. _id is composite
// (`${periodId}:${rowIndex}`) so re-uploading the same file (different
// periodId suffix) doesn't collide.
const PayrollRecordSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    periodId: { type: String, required: true, index: true },

    // Class / session metadata
    centreShortname: { type: String, default: "", index: true },
    classSiteCentre: { type: String, default: "" },
    type: {
      type: String,
      enum: ["CLASS", "OFFICE_HOURS"],
      default: "CLASS",
      index: true,
    },
    className: { type: String, default: "", index: true },
    classSite: { type: String, default: "" },
    course: { type: String, default: "" },
    courseLine: { type: String, default: "" },

    // Teacher metadata
    teacherName: { type: String, default: "", index: true },
    workEmail: { type: String, default: "", index: true },
    personalEmail: { type: String, default: "", index: true },
    username: { type: String, default: "", index: true },
    classRole: { type: String, default: "", index: true }, // LEC / TA / Fixed
    status: {
      type: String,
      enum: ["CHECKED", "UNCHECKED"],
      default: "UNCHECKED",
      index: true,
    },

    // Time / hours
    slotTime: { type: Date, default: null, index: true },
    slotDuration: { type: Number, default: 0 }, // raw slot count from sheet
    effectiveDuration: { type: Number, default: 0 }, // hours paid
    studentCount: { type: Number, default: 0 },

    // Free-text notes
    requestedBy: { type: String, default: "" },
    note: { type: String, default: "" },
    managerNote: { type: String, default: "" },
    confirmStatus: { type: String, default: "" },
    confirmNote: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PayrollRecordSchema.index({ periodId: 1, teacherName: 1 });
PayrollRecordSchema.index({ periodId: 1, className: 1 });
PayrollRecordSchema.index({ periodId: 1, status: 1, classRole: 1 });

// 23. Payroll Issue Report Schema
// Reports submitted by GV TDM when a salary row looks "Uncheck vô lý":
// flagged as UNCHECKED but still showing up in totals. TE thekhiem later
// collates these and emails the Tech team.
const PayrollIssueReportSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // uuid
    payrollRecordId: { type: String, required: true }, // ref PayrollRecord._id = `${periodId}:${rowIndex}`
    periodId: { type: String, required: true, index: true },
    centreShortname: { type: String, required: true, index: true }, // snapshot "TDM"
    teacherName: { type: String, default: "" },
    teacherUsername: { type: String, default: "" },
    teacherWorkEmail: { type: String, default: "" },
    teacherClassName: { type: String, default: "" },
    teacherSlotTime: { type: String, default: null },
    teacherEffectiveDuration: { type: Number, default: 0 },
    payrollRecordStatus: {
      type: String,
      enum: ["CHECKED", "UNCHECKED"],
      default: "UNCHECKED",
    },
    reason: { type: String, required: true },
    reporterUserId: { type: String, default: null },
    reporterUsername: { type: String, required: true },
    reporterFullName: { type: String, default: "" },
    reporterEmail: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "notified", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
    emailHistory: [
      {
        sentAt: { type: Date, default: Date.now },
        sentByUserId: { type: String, default: null },
        sentByName: { type: String, default: "" },
        to: { type: [String], default: [] },
        cc: { type: [String], default: [] },
        subject: { type: String, default: "" },
        messageId: { type: String, default: "" },
        success: { type: Boolean, default: false },
        error: { type: String, default: "" },
      },
    ],
    reviewedByUserId: { type: String, default: null },
    reviewedByName: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: "" },
  },
  { timestamps: true },
);
PayrollIssueReportSchema.index({ status: 1, createdAt: -1 });
PayrollIssueReportSchema.index({ periodId: 1, status: 1 });
PayrollIssueReportSchema.index({ reporterUsername: 1, createdAt: -1 });

module.exports = {
  Session: mongoose.model("Session", SessionSchema),
  ActiveToken: mongoose.model("ActiveToken", ActiveTokenSchema),
  NotificationTicket: mongoose.model("NotificationTicket", NotificationTicketSchema),
  Student: mongoose.model("Student", StudentSchema),
  Class: mongoose.model("Class", ClassSchema),
  Schedule: mongoose.model("Schedule", ScheduleSchema),
  TrialBooking: mongoose.model("TrialBooking", TrialBookingSchema),
  BookingAudit: mongoose.model("BookingAudit", BookingAuditSchema),
  OfficeHour: mongoose.model("OfficeHour", OfficeHourSchema),
  TeacherVisibilityPrefs: mongoose.model("TeacherVisibilityPrefs", TeacherVisibilityPrefsSchema),
  Teacher: mongoose.model("Teacher", TeacherSchema),
  TrialReport: mongoose.model("TrialReport", TrialReportSchema),
  TrialReportLog: mongoose.model("TrialReportLog", TrialReportLogSchema),
  Lesson: mongoose.model("Lesson", LessonSchema),
  LessonContent: mongoose.model("LessonContent", LessonContentSchema),
  LMSCriteria: mongoose.model("LMSCriteria", LMSCriteriaSchema),
  StudentComment: mongoose.model("StudentComment", StudentCommentSchema),
  ZaloTemplate: mongoose.model("ZaloTemplate", ZaloTemplateSchema),
  PayrollPeriod: mongoose.model("PayrollPeriod", PayrollPeriodSchema),
  PayrollRecord: mongoose.model("PayrollRecord", PayrollRecordSchema),
  PayrollIssueReport: mongoose.model(
    "PayrollIssueReport",
    PayrollIssueReportSchema,
  ),
};

