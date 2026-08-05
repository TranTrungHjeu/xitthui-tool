/**
 * Access helpers for the payroll issue report flow.
 */

/**
 * Returns true if the given user is a teacher whose `teacherCentres`
 * include the TDM centre. Used to gate the "Report công lương"
 * button on the public payroll page.
 */
export function isTdMTeacher(user: any): boolean {
  if (!user) return false;
  const centres = user.teacherCentres;
  if (!Array.isArray(centres) || centres.length === 0) return false;
  return centres.some((c: any) => {
    if (typeof c === "string") return c === "TDM";
    if (c && typeof c === "object") {
      return (
        c.shortName === "TDM" ||
        c.name === "Thủ Dầu Một" ||
        c.name === "Thủ Dầu Một - Bình Dương"
      );
    }
    return false;
  });
}
