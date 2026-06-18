const { ROLES, getPermissionsForRoles } = require("../constants/roles");

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
    console.log(
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
      if (r.role?.name === "Teacher" /* && r.info?.isActive */) {
        appRoles.add(ROLES.TEACHER);
        // Cập nhật profile tốt nhất từ info của Teacher (vì có thể baseUser bị rỗng)
        if (r.info.fullName) finalFullName = r.info.fullName;
        if (Array.isArray(r.info.centres) && r.info.centres.length > 0) {
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
        teacherId = r.info._id || r.info.id || teacherId;
      }
    });
    console.log("[RoleResolver] Resolved teacherId:", teacherId);
  }

  // 2. Rule gán Role thủ công (Đặc quyền cho tài khoản TE: lekhiem2002)
  const isKheim =
    baseUser.username === "lekhiem2002" ||
    baseUser.email === "lekhiem2002@mindx.net.vn" ||
    baseUser.email === "lethekhiem2002@mindx.net.vn" ||
    baseUser.username === "I3470" ||
    baseUser.email === "khiemlt@mindx.com.vn";

  if (isKheim) {
    appRoles.add(ROLES.TE);
    // Tiêm cứng trung tâm Thủ Dầu Một để lấy đúng class ở TDM, thay vì load toàn bộ class của hệ thống
    const tdmCentre = {
      id: "6443460f94300678908f7974",
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
};
