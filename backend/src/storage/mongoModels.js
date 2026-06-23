const mongoose = require("mongoose");

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

// 5. Zalo Session Schema
const ZaloSessionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // zaloUserId
    lmsToken: { type: String, default: "" },
    lmsRefreshToken: { type: String, default: "" },
    mindxUser: { type: mongoose.Schema.Types.Mixed, default: null },
    firebaseUid: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now, expires: "30d" } // Auto-delete after 30 days
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// 6. Zalo Config Schema
const ZaloConfigSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // 'global_config'
    targetChatId: { type: String, default: null },
    lmsToken: { type: String, default: null },
    lmsRefreshToken: { type: String, default: null },
    mindxUser: { type: mongoose.Schema.Types.Mixed, default: null },
    reminderTimes: { type: [String], default: [] }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// 7. Class Schema
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

// 9. Trial Booking Schema
const TrialBookingSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // `${dateStr}_row_${rowIndex}` or `${dateStr}_slot_${normalizedTime}`
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    timeSlot: { type: String, required: true }, // e.g. "18:00" or "9H"
    normalizedTime: { type: String, required: true }, // "HH:MM"
    subject: { type: String, default: "N/A" },
    type: { type: String, default: "N/A" },
    roomLink: { type: String, default: "" },
    students: { type: [String], default: [] },
    rowIndex: { type: Number, default: null }, // sheet row number (if applicable)
    teacherId: { type: String, default: null }, // assigned teacher ID
    teacherCode: { type: String, default: null }, // assigned teacher code
    teacherName: { type: String, default: null }, // assigned teacher name
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

module.exports = {
  Session: mongoose.model("Session", SessionSchema),
  ActiveToken: mongoose.model("ActiveToken", ActiveTokenSchema),
  NotificationTicket: mongoose.model("NotificationTicket", NotificationTicketSchema),
  Student: mongoose.model("Student", StudentSchema),
  ZaloSession: mongoose.model("ZaloSession", ZaloSessionSchema),
  ZaloConfig: mongoose.model("ZaloConfig", ZaloConfigSchema),
  Class: mongoose.model("Class", ClassSchema),
  Schedule: mongoose.model("Schedule", ScheduleSchema),
  TrialBooking: mongoose.model("TrialBooking", TrialBookingSchema)
};
