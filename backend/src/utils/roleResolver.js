const { ROLES, getPermissionsForRoles } = require("../constants/roles");
const { isSpecialAccount } = require("./roleUtils");
const { DEFAULT_TDM_CENTRE_ID, getTdmCentreId } = require("../constants/centreIds");

const { childLogger } = require("./logger.js");
const log = childLogger("RoleResolver");

/**
 * Default centre ID for TDM (Thủ Dầu Một)
 * Re-exported for backward compatibility; the canonical definition lives in
 * `constants/centreIds.js`. New code should import directly from there.
 */
const _defaultTdmCentreIdExport = DEFAULT_TDM_CENTRE_ID;
void _defaultTdmCentreIdExport; // keep the re-export explicit

/**
 * Hàm đánh giá và chuẩn hóa tài khoản từ MindX API thành profile của App.
 *
 * @param {Object} baseUser - Dữ liệu lấy từ `User_getByFirebaseId`
 * @param {Array} roleInfos - Mảng dữ liệu lấy từ `FindInfoInRoleById`
 * @returns {Object} Normalized user profile với appRoles và appPermissions
 */
function resolveUserRolesAndProfile(baseUser, roleInfos = []) {
  const appRoles = new Set();
  let finalFullName =
    [baseUser.firstName, baseUser.lastName].filter(Boolean).join(" ") ||
    baseUser.username;
  let teacherCentres = [];
  let teacherId = null;

  // Lấy danh sách trung tâm từ baseUser (nếu có)
  if (Array.isArray(baseUser.centres)) {
    teacherCentres = baseUser.centres
      .map((c) => {
        const id = c._id || c.id || (typeof c === "string" ? c : null);
        return {
          id,
          name: typeof c === "object" ? c.name || c.shortName || "" : "",
          shortName: typeof c === "object" ? c.shortName || "" : "",
        };
      })
      .filter((c) => c.id);
  }

  // 1. Phân tích các role trả về từ lms-api.mindx.edu.vn (Profile Giảng viên)
  if (Array.isArray(roleInfos)) {
    log.info(
      "[RoleResolver] User roleInfos:",
      JSON.stringify(
        roleInfos.map((r) => ({
          roleName: r.role?.name,
          isActive: r.info?.isActive,
          id: r.info?.id,
          _id: r.info?._id,
        })),
        null,
        2,
      ),
    );
    roleInfos.forEach((r) => {
      // NOTE: Cho phép nhận diện Teacher kể cả khi isActive là false tạm thời để xem log
      const roleName = r.role?.name;
      const isTeacherRole = roleName === "Teacher";
      const isTeRole =
        roleName === "TE" ||
        roleName === "TeacherExperience" ||
        roleName === "AcademicOperations" ||
        roleName === "AcademicManagement";

      if (isTeacherRole || isTeRole) {
        if (isTeacherRole) {
          appRoles.add(ROLES.TEACHER);
        }
        if (isTeRole) {
          appRoles.add(ROLES.TE);
        }

        // Cập nhật profile tốt nhất từ info (vì có thể baseUser bị rỗng)
        if (r.info?.fullName) finalFullName = r.info.fullName;
        if (r.info && Array.isArray(r.info.centres) && r.info.centres.length > 0) {
          teacherCentres = r.info.centres
            .map((c) => {
              const id = c._id || c.id || (typeof c === "string" ? c : null);
              return {
                id,
                name: typeof c === "object" ? c.name || c.shortName || "" : "",
                shortName: typeof c === "object" ? c.shortName || "" : "",
              };
            })
            .filter((c) => c.id);
        }
        if (r.info) {
          teacherId = r.info._id || r.info.id || teacherId;
        }
      }
    });
    log.info("[RoleResolver] Resolved teacherId:", teacherId);
  }

  // 2. Rule gán Role thủ công (Đặc quyền cho tài khoản TE đặc biệt)
  // Sử dụng hàm isSpecialAccount từ roleUtils để đảm bảo tính nhất quán
  if (isSpecialAccount(baseUser)) {
    appRoles.add(ROLES.TE);
    // Tiêm trung tâm Thủ Dầu Một để lấy đúng class ở TDM, thay vì load toàn bộ class của hệ thống
    const tdmCentreId = getTdmCentreId();
    const tdmCentre = {
      id: tdmCentreId,
      name: "Thủ Dầu Một - Bình Dương",
      shortName: "TDM",
    };
    if (!teacherCentres.some((c) => c.id === tdmCentre.id)) {
      teacherCentres.push(tdmCentre);
    }
  }

  // Chuyển Set thành Array
  const finalAppRoles = Array.from(appRoles);

  // 3. Khởi tạo mảng permissions dựa trên appRoles đã chốt
  const appPermissions = getPermissionsForRoles(finalAppRoles);

  return {
    ...baseUser,
    fullName: finalFullName,
    appRoles: finalAppRoles,
    appPermissions,
    teacherCentres,
    teacherId,
  };
}

module.exports = {
  resolveUserRolesAndProfile,
  DEFAULT_TDM_CENTRE_ID,
};
