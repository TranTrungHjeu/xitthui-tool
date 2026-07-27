/**
 * Unit tests for backend/src/utils/roleResolver.js
 *
 * Covers edge cases for the promotion/demotion flow inside
 * resolveUserRolesAndProfile():
 *
 *  - Promotion: TEACHER -> TE (e.g. user is given TE / AcademicOperations
 *    / AcademicManagement / TeacherExperience roles from LMS).
 *  - Demotion: TE -> TEACHER (e.g. TE role revoked from the LMS but Teacher
 *    role remains).
 *  - Special-account override: A regular user (no TE/Teacher from LMS) is
 *    granted TE privileges + the TDM centre is injected into teacherCentres.
 *  - Base user enrichment: fullName is preferred from roleInfos.info when
 *    present; teacherCentres are preferred from roleInfos when baseUser has
 *    none; teacherId is captured from the first TE/Teacher role.
 *  - Permission derivation: appPermissions reflect appRoles via the matrix
 *    defined in constants/roles.js.
 */

const { ROLES, PERMISSIONS } = require("../../constants/roles");
const {
  resolveUserRolesAndProfile,
  DEFAULT_TDM_CENTRE_ID,
} = require("../roleResolver");

// Silence the debug logs in roleResolver during tests so the test output stays clean.
beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore && console.log.mockRestore();
});

describe("roleResolver - resolveUserRolesAndProfile()", () => {
  test("returns a student unchanged (no roles, no permissions)", () => {
    const baseUser = { username: "student01", email: "student01@mindx.edu.vn" };
    const profile = resolveUserRolesAndProfile(baseUser, []);

    expect(profile.appRoles).toEqual([]);
    expect(profile.appPermissions).toEqual([]);
    expect(profile.teacherId).toBeNull();
    expect(profile.username).toBe("student01");
  });

  test("promotes to TEACHER when roleInfos carries 'Teacher'", () => {
    const baseUser = { username: "teacher01" };
    const roleInfos = [
      {
        role: { name: "Teacher" },
        info: {
          _id: "teacher_001",
          fullName: "Nguyen Van A",
          centres: [],
        },
      },
    ];

    const profile = resolveUserRolesAndProfile(baseUser, roleInfos);

    expect(profile.appRoles).toEqual([ROLES.TEACHER]);
    expect(profile.teacherId).toBe("teacher_001");
    expect(profile.fullName).toBe("Nguyen Van A");
    expect(profile.appPermissions).toEqual(expect.arrayContaining([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.VIEW_OWN_SCHEDULE,
    ]));
    expect(profile.appPermissions).not.toContain(PERMISSIONS.MANAGE_SYSTEM);
  });

  test("promotes to TE when roleInfos carries 'TE'", () => {
    const baseUser = { username: "te_user" };
    const roleInfos = [
      {
        role: { name: "TE" },
        info: { _id: "te_001", fullName: "Tran Thi B", centres: [] },
      },
    ];

    const profile = resolveUserRolesAndProfile(baseUser, roleInfos);

    expect(profile.appRoles).toContain(ROLES.TE);
    expect(profile.appPermissions).toContain(PERMISSIONS.MANAGE_SYSTEM);
  });

  test("promotes to TE via alias 'TeacherExperience'", () => {
    const baseUser = { username: "te_user2" };
    const roleInfos = [
      {
        role: { name: "TeacherExperience" },
        info: { _id: "te_002", fullName: "Alias TE User", centres: [] },
      },
    ];

    const profile = resolveUserRolesAndProfile(baseUser, roleInfos);

    expect(profile.appRoles).toContain(ROLES.TE);
  });

  test("promotes to TE via alias 'AcademicOperations'", () => {
    const baseUser = { username: "ao_user" };
    const roleInfos = [
      {
        role: { name: "AcademicOperations" },
        info: { _id: "ao_001", centres: [] },
      },
    ];

    const profile = resolveUserRolesAndProfile(baseUser, roleInfos);
    expect(profile.appRoles).toContain(ROLES.TE);
  });

  test("promotes to TE via alias 'AcademicManagement'", () => {
    const baseUser = { username: "am_user" };
    const roleInfos = [
      {
        role: { name: "AcademicManagement" },
        info: { _id: "am_001", centres: [] },
      },
    ];

    const profile = resolveUserRolesAndProfile(baseUser, roleInfos);
    expect(profile.appRoles).toContain(ROLES.TE);
  });

  test("grants BOTH TE + TEACHER when both roles exist on LMS", () => {
    const baseUser = { username: "dual_user" };
    const roleInfos = [
      {
        role: { name: "Teacher" },
        info: { _id: "t_001", fullName: "Dual User", centres: [] },
      },
      {
        role: { name: "TE" },
        info: { _id: "t_001", centres: [] },
      },
    ];

    const profile = resolveUserRolesAndProfile(baseUser, roleInfos);

    expect(profile.appRoles).toContain(ROLES.TEACHER);
    expect(profile.appRoles).toContain(ROLES.TE);
    expect(profile.appPermissions).toContain(PERMISSIONS.MANAGE_SYSTEM);
  });

  test("demotion edge: TE role revoked but Teacher remains -> result is TEACHER only", () => {
    // 'Teacher' is present (active); 'TE' was once present but is now inactive.
    // The implementation accepts Teacher role regardless of isActive, but only
    // adds TE/Teacher/Academic* roles. We simulate an LMS payload where TE is
    // simply absent.
    const baseUser = { username: "demoted_user" };
    const roleInfos = [
      {
        role: { name: "Teacher" },
        info: {
          _id: "t_002",
          fullName: "Demoted User",
          centres: [],
          isActive: true,
        },
      },
      // No TE role provided.
    ];

    const profile = resolveUserRolesAndProfile(baseUser, roleInfos);

    expect(profile.appRoles).toContain(ROLES.TEACHER);
    expect(profile.appRoles).not.toContain(ROLES.TE);
    expect(profile.appPermissions).not.toContain(PERMISSIONS.MANAGE_SYSTEM);
  });

  test("uses teacherCentres from roleInfos.info (overrides baseUser)", () => {
    const baseUser = {
      username: "teacher_with_centres",
      centres: [{ _id: "base_centre_id", name: "Base Centre" }],
    };
    const roleInfos = [
      {
        role: { name: "Teacher" },
        info: {
          _id: "t_003",
          centres: [
            { _id: "centre_a", name: "Centre A", shortName: "CA" },
            { _id: "centre_b", name: "Centre B" },
          ],
        },
      },
    ];

    const profile = resolveUserRolesAndProfile(baseUser, roleInfos);

    const ids = profile.teacherCentres.map((c) => c.id);
    expect(ids).toContain("centre_a");
    expect(ids).toContain("centre_b");
    expect(ids).not.toContain("base_centre_id"); // baseUser centres overridden
  });

  test("falls back to baseUser.centres when roleInfos.info has none", () => {
    const baseUser = {
      username: "fallback_user",
      centres: [{ _id: "fb_centre", name: "Fallback Centre" }],
    };
    const roleInfos = [
      {
        role: { name: "Teacher" },
        info: { _id: "t_004", centres: [] },
      },
    ];

    const profile = resolveUserRolesAndProfile(baseUser, roleInfos);
    const ids = profile.teacherCentres.map((c) => c.id);
    expect(ids).toContain("fb_centre");
  });

  test("extracts teacherId from roleInfos.info._id (preferred) and falls back to .id", () => {
    const with_id = resolveUserRolesAndProfile(
      { username: "u1" },
      [{ role: { name: "Teacher" }, info: { id: "t_id_only" } }],
    );
    expect(with_id.teacherId).toBe("t_id_only");

    const with_underscore = resolveUserRolesAndProfile(
      { username: "u2" },
      [{ role: { name: "Teacher" }, info: { _id: "t_underscore_only" } }],
    );
    expect(with_underscore.teacherId).toBe("t_underscore_only");

    const both = resolveUserRolesAndProfile(
      { username: "u3" },
      [{ role: { name: "Teacher" }, info: { _id: "t_under", id: "t_id" } }],
    );
    // _id is checked first
    expect(both.teacherId).toBe("t_under");
  });

  test("isSpecialAccount override grants TE + injects TDM centre", () => {
    const baseUser = {
      username: "lekhiem2002",
      email: "khiemlt@mindx.net.vn",
    };
    const profile = resolveUserRolesAndProfile(baseUser, []);

    expect(profile.appRoles).toContain(ROLES.TE);

    const ids = profile.teacherCentres.map((c) => c.id);
    expect(ids).toContain(DEFAULT_TDM_CENTRE_ID);
    expect(profile.appPermissions).toContain(PERMISSIONS.MANAGE_SYSTEM);
  });

  test("isSpecialAccount override does NOT duplicate TDM centre when already present", () => {
    const baseUser = {
      username: "lekhiem2002",
      email: "khiemlt@mindx.net.vn",
    };
    const roleInfos = [
      {
        role: { name: "Teacher" },
        info: {
          _id: "special_t",
          centres: [
            { _id: DEFAULT_TDM_CENTRE_ID, name: "Existing TDM" },
          ],
        },
      },
    ];

    const profile = resolveUserRolesAndProfile(baseUser, roleInfos);

    const tdmCount = profile.teacherCentres.filter(
      (c) => c.id === DEFAULT_TDM_CENTRE_ID,
    ).length;
    expect(tdmCount).toBe(1);
  });

  test("isSpecialAccount can be overridden via TDM_CENTRE_ID env variable", () => {
    const original = process.env.TDM_CENTRE_ID;
    process.env.TDM_CENTRE_ID = "custom_centre_999";

    try {
      const profile = resolveUserRolesAndProfile(
        { username: "lekhiem2002" },
        [],
      );
      const ids = profile.teacherCentres.map((c) => c.id);
      expect(ids).toContain("custom_centre_999");
      expect(ids).not.toContain(DEFAULT_TDM_CENTRE_ID);
    } finally {
      if (original === undefined) {
        delete process.env.TDM_CENTRE_ID;
      } else {
        process.env.TDM_CENTRE_ID = original;
      }
    }
  });

  test("ignores non-Teacher/non-TE roles when computing appRoles", () => {
    const baseUser = { username: "noise_user" };
    const roleInfos = [
      {
        role: { name: "Student" },
        info: { _id: "student_role_id", centres: [] },
      },
      {
        role: { name: "Parent" },
        info: { _id: "parent_role_id", centres: [] },
      },
    ];

    const profile = resolveUserRolesAndProfile(baseUser, roleInfos);
    expect(profile.appRoles).toEqual([]);
    expect(profile.teacherId).toBeNull();
  });

  test("appPermissions are derived from appRoles via the permission matrix", () => {
    const baseUser = { username: "perm_user" };
    const roleInfos = [
      {
        role: { name: "TE" },
        info: { _id: "perm_t", centres: [] },
      },
    ];

    const profile = resolveUserRolesAndProfile(baseUser, roleInfos);
    expect(profile.appPermissions).toEqual(expect.arrayContaining([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.MANAGE_ALL_SCHEDULES,
      PERMISSIONS.MANAGE_TEACHERS,
      PERMISSIONS.MANAGE_SYSTEM,
    ]));
  });

  test("preserves baseUser fields via spread", () => {
    const baseUser = {
      username: "preserve_user",
      email: "preserve@example.com",
      customField: "keep_me",
    };
    const profile = resolveUserRolesAndProfile(baseUser, []);
    expect(profile.username).toBe("preserve_user");
    expect(profile.email).toBe("preserve@example.com");
    expect(profile.customField).toBe("keep_me");
  });
});

describe("roleResolver - DEFAULT_TDM_CENTRE_ID", () => {
  test("is exported as a non-empty string constant", () => {
    expect(typeof DEFAULT_TDM_CENTRE_ID).toBe("string");
    expect(DEFAULT_TDM_CENTRE_ID.length).toBeGreaterThan(0);
  });
});