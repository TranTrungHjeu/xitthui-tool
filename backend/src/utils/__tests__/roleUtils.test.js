/**
 * Unit tests for backend/src/utils/roleUtils.js
 *
 * Covers:
 *  - isTE()
 *  - isTeacher()
 *  - isElevatedRole()
 *  - hasPermission()
 *  - getUserPermissions()
 *  - isSpecialAccount()
 *  - ROLES constants export
 *
 * Source of truth for these tests is the public API of roleUtils.js plus the
 * role/permission matrix declared in backend/src/constants/roles.js.
 */

const {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissionsForRoles,
} = require("../../constants/roles");

const {
  isTE,
  isTeacher,
  isElevatedRole,
  hasPermission,
  getUserPermissions,
  isSpecialAccount,
} = require("../roleUtils");

describe("roleUtils - isTE()", () => {
  test("returns true when roles contains ROLES.TE", () => {
    expect(isTE(["TE"])).toBe(true);
  });

  test("returns true when TE is present alongside other roles", () => {
    expect(isTE(["TEACHER", "TE"])).toBe(true);
    expect(isTE(["TE", "TEACHER", "STUDENT"])).toBe(true);
  });

  test("returns false when roles does not contain TE", () => {
    expect(isTE(["TEACHER"])).toBe(false);
    expect(isTE(["STUDENT"])).toBe(false);
    expect(isTE(["ADMIN"])).toBe(false);
  });

  test("returns false for empty / non-array inputs", () => {
    expect(isTE([])).toBe(false);
    expect(isTE(undefined)).toBe(false);
    expect(isTE(null)).toBe(false);
    expect(isTE("TE")).toBe(false);
    expect(isTE({})).toBe(false);
  });

  test("is case-sensitive: lowercase 'te' must NOT match", () => {
    expect(isTE(["te"])).toBe(false);
  });
});

describe("roleUtils - isTeacher()", () => {
  test("returns true when roles contains ROLES.TEACHER", () => {
    expect(isTeacher(["TEACHER"])).toBe(true);
  });

  test("returns true when TEACHER is combined with TE", () => {
    expect(isTeacher(["TEACHER", "TE"])).toBe(true);
  });

  test("returns false for TE-only user (TE is not TEACHER)", () => {
    expect(isTeacher(["TE"])).toBe(false);
  });

  test("returns false for students, admins, and unknown roles", () => {
    expect(isTeacher(["STUDENT"])).toBe(false);
    expect(isTeacher(["ADMIN"])).toBe(false);
    expect(isTeacher([])).toBe(false);
    expect(isTeacher(undefined)).toBe(false);
    expect(isTeacher(null)).toBe(false);
  });
});

describe("roleUtils - isElevatedRole()", () => {
  test("returns true for TE", () => {
    expect(isElevatedRole(["TE"])).toBe(true);
  });

  test("returns true for TEACHER", () => {
    expect(isElevatedRole(["TEACHER"])).toBe(true);
  });

  test("returns true for combined TE+TEACHER", () => {
    expect(isElevatedRole(["TE", "TEACHER"])).toBe(true);
  });

  test("returns false for non-elevated roles", () => {
    expect(isElevatedRole(["STUDENT"])).toBe(false);
    expect(isElevatedRole(["ADMIN"])).toBe(false);
    expect(isElevatedRole(["STUDENT", "TEACHER"])).toBe(true); // TEACHER still elevated
  });

  test("returns false for empty / non-array inputs", () => {
    expect(isElevatedRole([])).toBe(false);
    expect(isElevatedRole(undefined)).toBe(false);
    expect(isElevatedRole(null)).toBe(false);
    expect(isElevatedRole("TE")).toBe(false);
  });
});

describe("roleUtils - hasPermission()", () => {
  test("TE has all elevated permissions", () => {
    expect(hasPermission(["TE"], PERMISSIONS.ACCESS_DASHBOARD)).toBe(true);
    expect(hasPermission(["TE"], PERMISSIONS.VIEW_OWN_SCHEDULE)).toBe(true);
    expect(hasPermission(["TE"], PERMISSIONS.MANAGE_ALL_SCHEDULES)).toBe(true);
    expect(hasPermission(["TE"], PERMISSIONS.MANAGE_TEACHERS)).toBe(true);
    expect(hasPermission(["TE"], PERMISSIONS.MANAGE_SYSTEM)).toBe(true);
  });

  test("TEACHER has dashboard + own schedule but NOT elevated permissions", () => {
    expect(hasPermission(["TEACHER"], PERMISSIONS.ACCESS_DASHBOARD)).toBe(true);
    expect(hasPermission(["TEACHER"], PERMISSIONS.VIEW_OWN_SCHEDULE)).toBe(true);
    expect(hasPermission(["TEACHER"], PERMISSIONS.MANAGE_ALL_SCHEDULES)).toBe(false);
    expect(hasPermission(["TEACHER"], PERMISSIONS.MANAGE_TEACHERS)).toBe(false);
    expect(hasPermission(["TEACHER"], PERMISSIONS.MANAGE_SYSTEM)).toBe(false);
  });

  test("unknown roles have no permissions", () => {
    expect(hasPermission(["STUDENT"], PERMISSIONS.ACCESS_DASHBOARD)).toBe(false);
    expect(hasPermission(["ADMIN"], PERMISSIONS.MANAGE_SYSTEM)).toBe(false);
  });

  test("returns false for empty / invalid inputs", () => {
    expect(hasPermission([], PERMISSIONS.ACCESS_DASHBOARD)).toBe(false);
    expect(hasPermission(undefined, PERMISSIONS.ACCESS_DASHBOARD)).toBe(false);
    expect(hasPermission(null, PERMISSIONS.ACCESS_DASHBOARD)).toBe(false);
  });

  test("full role x permission matrix", () => {
    const matrix = [
      [ROLES.TE, ROLE_PERMISSIONS[ROLES.TE]],
      [ROLES.TEACHER, ROLE_PERMISSIONS[ROLES.TEACHER]],
    ];

    for (const [role, expectedPerms] of matrix) {
      // Every permission declared in matrix must pass hasPermission
      for (const perm of expectedPerms) {
        expect(hasPermission([role], perm)).toBe(true);
      }
      // Permissions NOT declared must fail
      const allPerms = Object.values(PERMISSIONS);
      const otherPerms = allPerms.filter((p) => !expectedPerms.includes(p));
      for (const perm of otherPerms) {
        expect(hasPermission([role], perm)).toBe(false);
      }
    }
  });
});

describe("roleUtils - getUserPermissions()", () => {
  test("returns the full TE permission list", () => {
    const perms = getUserPermissions(["TE"]);
    expect(perms).toEqual(expect.arrayContaining([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.VIEW_OWN_SCHEDULE,
      PERMISSIONS.MANAGE_ALL_SCHEDULES,
      PERMISSIONS.MANAGE_TEACHERS,
      PERMISSIONS.MANAGE_SYSTEM,
    ]));
  });

  test("TE+TEACHER dedupes the permissions (no duplicate entries)", () => {
    const perms = getUserPermissions(["TE", "TEACHER"]);
    const uniquePerms = Array.from(new Set(perms));
    expect(perms.length).toBe(uniquePerms.length);
  });

  test("returns empty array for non-array input", () => {
    expect(getUserPermissions(undefined)).toEqual([]);
    expect(getUserPermissions(null)).toEqual([]);
  });

  test("returns empty array when roles are unknown", () => {
    expect(getUserPermissions(["STUDENT"])).toEqual([]);
    expect(getUserPermissions(["ADMIN", "STUDENT"])).toEqual([]);
  });
});

describe("roleUtils - isSpecialAccount()", () => {
  test("returns true for special username 'lekhiem2002'", () => {
    expect(isSpecialAccount({ username: "lekhiem2002" })).toBe(true);
  });

  test("returns true for special username 'I3470'", () => {
    expect(isSpecialAccount({ username: "I3470" })).toBe(true);
  });

  test("returns true for any of the special emails (case-insensitive)", () => {
    const emails = [
      "lekhiem2002@mindx.net.vn",
      "lethekhiem2002@mindx.net.vn",
      "khiemlt@mindx.com.vn",
      "khiemlt@mindx.net.vn",
    ];
    for (const email of emails) {
      expect(isSpecialAccount({ email })).toBe(true);
      expect(isSpecialAccount({ email: email.toUpperCase() })).toBe(true);
    }
  });

  test("returns false for regular users", () => {
    expect(isSpecialAccount({ username: "normal_user" })).toBe(false);
    expect(isSpecialAccount({ email: "user@mindx.edu.vn" })).toBe(false);
    expect(isSpecialAccount({ username: "normal_user", email: "normal@mindx.edu.vn" })).toBe(false);
  });

  test("returns false when user object is missing or fields are empty", () => {
    expect(isSpecialAccount(null)).toBe(false);
    expect(isSpecialAccount(undefined)).toBe(false);
    expect(isSpecialAccount({})).toBe(false);
    expect(isSpecialAccount({ username: "" })).toBe(false);
    expect(isSpecialAccount({ email: "" })).toBe(false);
  });
});

describe("roleUtils - constants re-export", () => {
  test("exports ROLES.TEACHER and ROLES.TE", () => {
    expect(ROLES.TEACHER).toBe("TEACHER");
    expect(ROLES.TE).toBe("TE");
  });
});