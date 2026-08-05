const mongoose = require("mongoose");

// Email send log — used for dedupe (avoid sending the same reminder twice on
// the same day) and for audit/debug. TTL 30 days after last update.
const NotificationEmailLogSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // `${kind}:${email}:${dedupeKey}`
    kind: {
      type: String,
      enum: ["reminder", "weekly_digest"],
      required: true,
      index: true,
    },
    email: { type: String, required: true, index: true },
    // For 'reminder': "YYYY-MM-DD" (Vietnam day).
    // For 'weekly_digest': "YYYY-Www" (ISO week key).
    dedupeKey: { type: String, required: true, index: true },
    // Free-form context (classId, centreId, etc.) for debugging.
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
    teacherName: { type: String, default: null },
    subject: { type: String, default: null },
    messageId: { type: String, default: null },
    status: {
      type: String,
      enum: ["sent", "failed"],
      required: true,
    },
    error: { type: String, default: null },
    sentAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now, expires: "30d" },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

NotificationEmailLogSchema.index({ kind: 1, email: 1, dedupeKey: 1 });

module.exports = mongoose.model(
  "NotificationEmailLog",
  NotificationEmailLogSchema,
);
