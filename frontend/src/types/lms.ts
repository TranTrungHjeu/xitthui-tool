/**
 * Types for the public `/lms` Teacher Assistant page.
 *
 * Mirrors the structure returned by the LMS service in the main repo
 * (`backend/src/services/lmsClient.js`, `lms/queries.js`) and the
 * payloads the new `backend/src/controllers/lmsController.js` expects.
 */

export type LmsSubject = "coding" | "robotic" | "art" | "general";

export interface LmsSubjectOption {
  key: LmsSubject;
  label: string;
}

export const LMS_SUBJECTS: LmsSubjectOption[] = [
  { key: "coding", label: "Coding" },
  { key: "robotic", label: "Robotic" },
  { key: "art", label: "Art" },
];

/**
 * Map a free-form class subject string (as returned by the API on
 * `LmsClassSummary.subject`, e.g. "Coding", "Robotic", "Art", "Lập trình",
 * "Lego Robotics", ...) to the closest `LmsSubject` tab key.
 *
 * Returns `null` when no mapping can be inferred — callers should treat that
 * as "keep current tab".
 */
export function resolveSubjectFromClass(
  raw: string | null | undefined,
): LmsSubject | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase().trim();
  if (!s) return null;

  // Vietnamese + English keywords grouped by target tab.
  const coding = [
    "coding",
    "code",
    "lap trinh",
    "lập trình",
    "lap-trinh",
    "programming",
    "scratch",
    "python",
    "web",
    "javascript",
  ];
  const robotic = [
    "robotic",
    "robotics",
    "robot",
    "lego",
    "arduino",
    "microbit",
    "stem",
  ];
  const art = ["art", "drawing", "design", "do hoa", "đồ họa", "thiet ke", "thiết kế"];

  if (coding.some((k) => s.includes(k))) return "coding";
  if (robotic.some((k) => s.includes(k))) return "robotic";
  if (art.some((k) => s.includes(k))) return "art";
  return null;
}

/**
 * Filter a list of classes down to those whose `subject` string resolves to
 * the given target `LmsSubject`. Classes whose subject cannot be resolved
 * (`null`) are kept — we don't want to silently drop them when the API
 * returns an unknown value; they should still be selectable.
 */
export function filterClassesBySubject(
  classes: readonly LmsClassSummary[],
  target: LmsSubject,
): LmsClassSummary[] {
  return classes.filter((c) => {
    const resolved = resolveSubjectFromClass(c.subject);
    return resolved === null || resolved === target;
  });
}

/**
 * Natural sort (so "Lớp 2" comes before "Lớp 10"). Case-insensitive.
 * Stable: equal keys keep their original order.
 */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Sort classes alphabetically by `name` using natural ordering. Does not
 * mutate the input array.
 */
export function sortClassesByName(
  classes: readonly LmsClassSummary[],
): LmsClassSummary[] {
  return [...classes].sort((a, b) =>
    naturalCompare(a.name || "", b.name || ""),
  );
}

export interface LmsClassSummary {
  id: string;
  name: string;
  status?: string;
  subject?: string;
  level?: string;
  isOwner?: boolean;
  course?: { id?: string; name?: string; shortName?: string } | null;
  centre?: { id?: string; name?: string; shortName?: string } | null;
}

export interface LmsStudent {
  id: string;
  fullName: string;
  username?: string;
  email?: string;
}

export interface LmsCriteriaItem {
  id?: string;
  label: string;
  value?: string;
}

export interface LmsCriteriaSection {
  title: string;
  criteria: LmsCriteriaItem[];
}

export interface LmsCriteriaTemplate {
  _id: string;
  id?: string;
  name: string;
  subject: LmsSubject;
  type: "default" | "custom";
  sections: LmsCriteriaSection[];
  createdBy?: string | null;
  updatedAt?: string;
}

export interface LmsGenerateCommentPayload {
  classId?: string;
  studentId?: string;
  studentName?: string;
  sessionNumber?: number;
  rawNote: string;
  criteria?: LmsCriteriaSection[];
  criteriaTemplateName?: string;
  history?: Array<{ session: number | string; comment: string }>;
  subject?: LmsSubject;
  token?: string;
  sessionId?: string;
}

export interface LmsGenerateCommentResponse {
  success: boolean;
  aiUnavailable?: boolean;
  reason?: string;
  data: {
    text: string | null;
    sections: string[];
    classId?: string | null;
    studentId?: string | null;
  };
}

export interface LmsSyncClassPayload {
  classId: string;
}

export interface LmsSyncClassResponse {
  success: boolean;
  data: {
    class: {
      id: string;
      name: string;
      status?: string;
      course?: { id?: string; name?: string } | null;
      centre?: { id?: string; name?: string } | null;
    };
    students: LmsStudent[];
    submissions: unknown[];
    lessons: unknown[];
  };
}

export interface LmsSaveCriteriaPayload {
  id?: string;
  name: string;
  subject: LmsSubject;
  sections: LmsCriteriaSection[];
  type?: "default" | "custom";
}

export interface LmsChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export interface LmsChatPayload {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  systemPrompt?: string;
}

export interface LmsChatResponse {
  success: boolean;
  aiUnavailable?: boolean;
  reason?: string;
  data: { text: string | null };
}

export interface LmsGetClassesParams {
  status?: "RUNNING" | "FINISHED" | "ALL";
  teacherCode?: string;
  search?: string;
}

export interface LmsClassesResponse {
  success: boolean;
  count?: number;
  data: LmsClassSummary[];
}

export interface LmsCommentHistoryItem {
  session: number | null;
  date?: string | null;
  comment: string;
}

export interface LmsCommentHistoryResponse {
  success: boolean;
  classId?: string;
  studentId?: string;
  data: { history: LmsCommentHistoryItem[] };
}
