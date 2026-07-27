/**
 * Shared Role Utilities
 *
 * Centralized role checking functions to ensure consistent role resolution
 * across the application. All role checks should use these utilities.
 *
 * Source of truth for role resolution logic.
 */

const { ROLES, getPermissionsForRoles } = require("../constants/roles");

/**
 * Check if user has TE role
 * @param {Array<String>|undefined} roles - User's roles array
 * @returns {boolean}
 */
function isTE(roles) {
  return Array.isArray(roles) && roles.includes(ROLES.TE);
}

/**
 * Check if user has Teacher role
 * @param {Array<String>|undefined} roles - User's roles array
 * @returns {boolean}
 */
function isTeacher(roles) {
  return Array.isArray(roles) && roles.includes(ROLES.TEACHER);
}

/**
 * Check if user has any elevated role (TE or Teacher)
 * @param {Array<String>|undefined} roles - User's roles array
 * @returns {boolean}
 */
function isElevatedRole(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return false;
  return roles.some((r) => [ROLES.TE, ROLES.TEACHER].includes(r));
}

/**
 * Check if user has specific permission
 * @param {Array<String>|undefined} roles - User's roles array
 * @param {String} permission - Permission to check
 * @returns {boolean}
 */
function hasPermission(roles, permission) {
  const permissions = getPermissionsForRoles(roles);
  return permissions.includes(permission);
}

/**
 * Get permissions for user
 * @param {Array<String>|undefined} roles - User's roles array
 * @returns {Array<String>}
 */
function getUserPermissions(roles) {
  return getPermissionsForRoles(roles);
}

/**
 * Known special accounts that should always be treated as elevated
 * @param {Object} user - User object with username/email
 * @returns {boolean}
 */
function isSpecialAccount(user) {
  if (!user) return false;
  const username = user.username || "";
  const email = (user.email || "").toLowerCase();

  const specialAccounts = [
    "lekhiem2002",
    "I3470",
  ];

  const specialEmails = [
    "lekhiem2002@mindx.net.vn",
    "lethekhiem2002@mindx.net.vn",
    "khiemlt@mindx.com.vn",
    "khiemlt@mindx.net.vn",
  ];

  return (
    specialAccounts.includes(username) ||
    specialEmails.includes(email)
  );
}

module.exports = {
  ROLES,
  isTE,
  isTeacher,
  isElevatedRole,
  hasPermission,
  getUserPermissions,
  isSpecialAccount,
  getPermissionsForRoles,
};
