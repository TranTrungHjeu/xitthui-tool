/**
 * Danh sách các Role chuẩn được sử dụng trong nội bộ MindX Support Tools.
 * Việc này giúp tách biệt hoàn toàn Role của hệ thống MindX gốc và hệ thống hiện tại,
 * dễ dàng mở rộng thêm các Role mới (như ADMIN, MANAGER) sau này.
 */
const ROLES = {
  TEACHER: "TEACHER",
  TE: "TE", // Teacher Experience / Quản lý
};

/**
 * Danh sách các Permission (quyền chi tiết) để kiểm tra hành động cụ thể.
 * Tương lai, có thể check bằng Permission thay vì check Role cứng.
 */
const PERMISSIONS = {
  ACCESS_DASHBOARD: "ACCESS_DASHBOARD",
  VIEW_OWN_SCHEDULE: "VIEW_OWN_SCHEDULE",
  MANAGE_ALL_SCHEDULES: "MANAGE_ALL_SCHEDULES",
  MANAGE_TEACHERS: "MANAGE_TEACHERS",
  MANAGE_SYSTEM: "MANAGE_SYSTEM",
};

/**
 * Ma trận phân quyền: Role nào sẽ có những Permission nào.
 */
const ROLE_PERMISSIONS = {
  [ROLES.TEACHER]: [
    PERMISSIONS.ACCESS_DASHBOARD,
    PERMISSIONS.VIEW_OWN_SCHEDULE,
  ],
  [ROLES.TE]: [
    PERMISSIONS.ACCESS_DASHBOARD,
    PERMISSIONS.VIEW_OWN_SCHEDULE,
    PERMISSIONS.MANAGE_ALL_SCHEDULES,
    PERMISSIONS.MANAGE_TEACHERS,
    PERMISSIONS.MANAGE_SYSTEM,
  ],
};

/**
 * Lấy danh sách tất cả các permission gộp lại từ mảng roles của một user
 * @param {Array<String>} roles
 * @returns {Array<String>}
 */
function getPermissionsForRoles(roles) {
  const permissions = new Set();
  if (Array.isArray(roles)) {
    roles.forEach((role) => {
      const rolePerms = ROLE_PERMISSIONS[role] || [];
      rolePerms.forEach((p) => permissions.add(p));
    });
  }
  return Array.from(permissions);
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissionsForRoles,
};
