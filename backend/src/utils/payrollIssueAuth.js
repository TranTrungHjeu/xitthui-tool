/**
 * Auth helpers for the payroll issue-report flow.
 *
 * GV centres are stored as `Teacher.centres[i].id` (MongoDB centreId).
 * To check whether a GV belongs to the TDM centre we compare against
 * `getTdmCentreId()` (env-overridable constant).
 */

const { Teacher } = require("../storage/mongoModels");
const { getTdmCentreId } = require("../constants/centreIds");
const { childLogger } = require("./logger");

const log = childLogger("PayrollIssueAuth");

const TDM_CENTRE_SHORTNAME = "TDM";

/**
 * Resolve the caller's teacherCentres array from the active session.
 *   1. Use teacherCentres attached by roleResolver when available.
 *   2. Fall back to a Teacher lookup by session.teacherId.
 *   3. Return [] if nothing found.
 */
async function resolveTeacherCentres(req) {
  const user = req.trialReportUser;
  if (user && Array.isArray(user.teacherCentres) && user.teacherCentres.length > 0) {
    return user.teacherCentres;
  }
  const teacherId = user?.teacherId;
  if (!teacherId) return [];
  try {
    const teacher = await Teacher.findById(teacherId).lean();
    if (!teacher || !Array.isArray(teacher.centres)) return [];
    return teacher.centres.map((c) => ({ id: c.id, name: c.name }));
  } catch (err) {
    log.warn("[payrollIssueAuth] resolveTeacherCentres failed: %s", err.message);
    return [];
  }
}

/**
 * @returns {boolean} true if the caller's session belongs to TDM centre.
 */
async function isTdmMember(req) {
  const centres = await resolveTeacherCentres(req);
  const tdmId = getTdmCentreId();
  return centres.some((c) => c.id === tdmId);
}

/**
 * Express middleware: require the caller to be an authenticated GV
 * whose teacherCentres include TDM. Returns 401/403 on failure.
 */
function requireTdmTeacher() {
  return async (req, res, next) => {
    try {
      const user = req.trialReportUser;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
          code: "EAUTHREQUIRED",
        });
      }
      const ok = await isTdmMember(req);
      if (!ok) {
        return res.status(403).json({
          success: false,
          error: "Only teachers of TDM centre may submit payroll issue reports.",
          code: "ENOTDMMEMBER",
        });
      }
      return next();
    } catch (err) {
      log.error("[payrollIssueAuth] requireTdmTeacher error: %s", err.message);
      return res.status(500).json({
        success: false,
        error: "Authorization check failed",
        code: "EAUTHERROR",
      });
    }
  };
}

module.exports = {
  TDM_CENTRE_SHORTNAME,
  resolveTeacherCentres,
  isTdmMember,
  requireTdmTeacher,
};
