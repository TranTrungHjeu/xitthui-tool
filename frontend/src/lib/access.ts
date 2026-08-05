import {
  FileText,
  MessageSquare,
  GraduationCap,
  BookOpen,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Role-based navigation visibility for the dashboard.
 *
 * The User's `appRoles` and `appPermissions` are arrays of string literals
 * (see `frontend/src/types/index.ts` AppRole / AppPermission, which mirror
 * the canonical backend constants in `backend/src/constants/roles.js`).
 *
 * Each NAV_ACCESS entry lists the roles and permissions that grant access.
 * Visibility is evaluated with OR-logic: matching ANY listed role OR ANY
 * listed permission is sufficient. Unknown hrefs fail-open (return true) so
 * new routes don't accidentally hide themselves.
 */

export interface NavAccessEntry {
  href: string;
  label: string;
  roles: string[];
  permissions: string[];
  /**
   * Optional per-entry gate. Return true to allow access, false to deny.
   * Used when the standard role/permission check is insufficient (e.g. a
   * feature is scoped to a single named account rather than a role).
   */
  customCheck?: (user: AccessUser | null | undefined) => boolean;
}

export interface AccessUser {
  appRoles?: string[];
  appPermissions?: string[];
}

export interface PublicToolEntry {
  /** Slug used in the `/dashboard/tools/<key>` route. */
  key: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Tools that are visible to every visitor (logged in or not).
 * When a guest clicks a "Công cụ hỗ trợ" link from /login, they're routed
 * to `/dashboard/tools/<key>` which renders the matching tool inside the
 * dashboard shell. Logged-in users see these in addition to their
 * role-gated routes.
 */
export const PUBLIC_TOOLS: PublicToolEntry[] = [
  {
    key: "trial-report",
    label: "Phiếu trải nghiệm",
    icon: FileText,
  },
  {
    key: "zalo",
    label: "Nhận xét Zalo",
    icon: MessageSquare,
  },
  {
    key: "lms",
    label: "Nhận xét LMS",
    icon: GraduationCap,
  },
  {
    key: "lesson",
    label: "Nội dung buổi học",
    icon: BookOpen,
  },
  {
    key: "payroll",
    label: "Check công lương",
    icon: Wallet,
  },
];

export const PUBLIC_TOOL_HREFS = PUBLIC_TOOLS.map((t) => t.key);

export const NAV_ACCESS: NavAccessEntry[] = [
  {
    href: "/dashboard",
    label: "Tổng quan",
    roles: ["TEACHER", "TE"],
    permissions: ["ACCESS_DASHBOARD"],
  },
  {
    href: "/dashboard/classes",
    label: "Lớp học",
    roles: ["TEACHER", "TE"],
    permissions: ["VIEW_OWN_SCHEDULE", "MANAGE_ALL_SCHEDULES"],
  },
  {
    href: "/dashboard/students",
    label: "Học viên",
    roles: ["TEACHER", "TE"],
    permissions: ["VIEW_OWN_SCHEDULE"],
  },
  {
    href: "/dashboard/personnel",
    label: "Nhân sự",
    roles: ["TE"],
    permissions: ["MANAGE_TEACHERS", "MANAGE_SYSTEM"],
  },
  {
    href: "/dashboard/schedules",
    label: "Lịch làm việc",
    roles: ["TEACHER", "TE"],
    permissions: ["VIEW_OWN_SCHEDULE", "MANAGE_ALL_SCHEDULES"],
  },
  {
    href: "/dashboard/spreadsheet",
    label: "Book giáo viên",
    roles: ["TEACHER", "TE"],
    permissions: ["ACCESS_DASHBOARD"],
  },
  {
    href: "/dashboard/office-hours",
    label: "Office Hours",
    roles: ["TEACHER", "TE"],
    permissions: ["ACCESS_DASHBOARD"],
  },
  {
    href: "/dashboard/payroll",
    label: "Công lương",
    roles: ["TE"],
    permissions: ["MANAGE_SYSTEM"],
  },
  {
    // Payroll issue reports — TDM teacher → TE thekhiem → Tech team.
    // Gated to the named account only (not all TE).
    href: "/dashboard/payroll/reports",
    label: "Báo cáo công lương",
    roles: ["TE"],
    permissions: ["MANAGE_SYSTEM"],
    customCheck: (user) => {
      if (!user) return false;
      const username = (user as any).username;
      const email = (user as any).email;
      const allowedUsernames = ["lekhiem2002", "I3470"];
      const allowedEmails = [
        "lekhiem2002@mindx.net.vn",
        "lethekhiem2002@mindx.net.vn",
        "khiemlt@mindx.com.vn",
        "khiemlt@mindx.net.vn",
      ];
      return (
        (typeof username === "string" && allowedUsernames.includes(username)) ||
        (typeof email === "string" && allowedEmails.includes(email))
      );
    },
  },
  {
    href: "/dashboard/settings",
    label: "Cài đặt",
    roles: ["TEACHER", "TE"],
    permissions: ["ACCESS_DASHBOARD"],
  },
];

export const DEFAULT_FALLBACK_HREF = "/dashboard";

export function canAccessNav(
  user: AccessUser | null | undefined,
  href: string,
): boolean {
  const entry = NAV_ACCESS.find((item) => item.href === href);
  if (!entry) return true;

  // Custom gate first — short-circuits if it explicitly denies.
  if (typeof entry.customCheck === "function") {
    if (!entry.customCheck(user)) return false;
  }

  const userRoles = user?.appRoles ?? [];
  const userPermissions = user?.appPermissions ?? [];

  const roleMatch = entry.roles.some((r) => userRoles.includes(r));
  if (roleMatch) return true;

  return entry.permissions.some((p) => userPermissions.includes(p));
}
