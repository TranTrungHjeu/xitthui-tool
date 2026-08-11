/**
 * Report Audit Log Model
 *
 * Tracks who did what to a phiếu (trial report). This collection is
 * separate from the legacy `TrialReportLog` so the schema can evolve
 * independently while that collection is left untouched.
 *
 * Collection: `report_audit_logs`
 *
 * Fields:
 *   reportId   — _id of the TrialReport document (indexed)
 *   actorId    — userId or teacherId of the performer
 *   actorName  — denormalised display name
 *   action     — e.g. "upload", "delete-request", "delete", "approve", "reject"
 *   at         — timestamp (indexed, TTL: 90 days)
 *   meta       — flexible extra payload (reason, ip, r2Key, etc.)
 */

const mongoose = require("mongoose");

const ReportAuditLogSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      required: true,
      index: true,
    },
    actorId: {
      type: String,
      default: null,
    },
    actorName: {
      type: String,
      default: "",
    },
    action: {
      type: String,
      required: true,
      enum: [
        "upload",
        "delete-request",
        "delete",
        "restore",
        "approve",
        "reject",
      ],
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    // createdAt becomes `at` via this alias; updatedAt is not used.
    timestamps: { createdAt: "at", updatedAt: false },
    // TTL: 90 days — auto-delete keeps the collection lean without a
    // separate cleanup job.
    expires: "90d",
  },
);

// Compound index for the typical access pattern: filter by reportId,
// sort descending by `at` (createdAt), cap at N results.
ReportAuditLogSchema.index({ reportId: 1, at: -1 });

const ReportAuditLog = mongoose.model("ReportAuditLog", ReportAuditLogSchema);

module.exports = ReportAuditLog;
