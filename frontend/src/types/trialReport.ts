/**
 * Types cho feature "Quản lý lớp học trải nghiệm".
 *
 * Backend đứng giữa frontend và Google Drive API. Frontend chỉ thao tác với
 * các DTO bên dưới, không bao giờ gọi trực tiếp Drive API.
 */

export type ReportType =
  | "Kiro4+"
  | "Robotics"
  | "Coding"
  | "Art"
  | "pdf-upload";

export type TemplateFieldKey =
  | "lessonTitle"
  | "objectives"
  | "activities"
  | "studentFeedback"
  | "projectName"
  | "partsUsed"
  | "programmingConcepts"
  | "observations"
  | "projectTitle"
  | "language"
  | "keyConcepts"
  | "challenges"
  | "medium"
  | "techniques";

export interface DriveFolder {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string | null;
  modifiedTime?: string | null;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string | null;
  modifiedTime?: string | null;
  size?: number | null;
  webViewLink?: string | null;
  webContentLink?: string | null;
  parents?: string[];
}

export interface TrialReport {
  _id: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  size?: number | null;
  webViewLink?: string;
  webContentLink?: string;
  parentFolderId: string;
  reportType: ReportType;
  classDate?: string | null;
  teacherCode?: string;
  teacherName?: string;
  studentName?: string;
  uploadedBy?: string | null;
  uploadedByName?: string;
  uploadedByEmail?: string;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type TrialReportLogAction =
  | "upload"
  | "delete"
  | "restore"
  | "create-folder"
  | "delete-request";

export interface TrialReportLog {
  _id: string;
  action: TrialReportLogAction;
  reportId?: string | null;
  reportType?: string;
  fileName?: string;
  targetUserId?: string | null;
  performedBy?: string | null;
  performedByName?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  createdAt?: string;
}

export type DeleteRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed";

export interface DeleteRequest {
  _id: string;
  reportId: string;
  fileName: string;
  requestedBy?: string | null;
  requestedByName?: string;
  reason: string;
  status: DeleteRequestStatus;
  reviewedBy?: string | null;
  reviewedByName?: string;
  reviewedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Canonical payload for the new browser-OAuth upload flow. The PDF has
 * already been pushed to Drive by the browser; we just send back the
 * resulting file metadata so the backend can upsert it into Mongo.
 */
export interface RegisterReportPayload {
  driveFileId: string;
  fileName: string;
  mimeType?: string;
  size?: number | null;
  webViewLink?: string | null;
  webContentLink?: string | null;
  parentFolderId?: string | null;
  reportType?: ReportType;
  classDate?: string | null;
  teacherCode?: string;
  teacherName?: string;
  studentName: string;
  uploadedByEmail?: string | null;
  sessionId?: string | null;
}

/**
 * @deprecated Use `RegisterReportPayload`. The legacy upload routes
 * (`/trial-report/reports`, `/trial-report/upload`) remain backward-
 * compatible by delegating to `registerReport`.
 */
export interface CreateReportPayload {
  driveFileId?: string;
  folderId?: string | null;
  reportType: ReportType;
  classDate?: string | null;
  teacherCode?: string;
  teacherName?: string;
  studentName: string;
  fileName: string;
  payload?: Record<string, unknown>;
  pdfBase64?: string;
  sessionId?: string | null;
}

/**
 * @deprecated Use `RegisterReportPayload`.
 */
export interface UploadPdfPayload extends CreateReportPayload {}

export type LegacyCreateReportPayload = CreateReportPayload | UploadPdfPayload;

export interface RequestDeletePayload {
  reportId: string;
  reason: string;
  sessionId?: string | null;
}

export interface ReviewDeleteRequestPayload {
  action: "approve" | "reject";
  note?: string;
  sessionId?: string | null;
}

export interface AllReportsQuery {
  from?: string;
  to?: string;
  teacherCode?: string;
  studentName?: string;
  reportType?: ReportType;
  page?: number;
  pageSize?: number;
  sessionId?: string | null;
}

export interface DeleteRequestsQuery {
  status?: DeleteRequestStatus | "all";
  page?: number;
  pageSize?: number;
  sessionId?: string | null;
}

export interface Kiro4PlusForm {
  lessonTitle: string;
  objectives: string;
  activities: string;
  studentFeedback: string;
}

export interface RoboticsForm {
  projectName: string;
  partsUsed: string;
  programmingConcepts: string;
  observations: string;
}

export interface CodingForm {
  projectTitle: string;
  language: string;
  keyConcepts: string;
  challenges: string;
}

export interface ArtForm {
  projectTitle: string;
  medium: string;
  techniques: string;
  observations: string;
}

// Base type for all trial report data
export interface BaseTrialReportData {
  studentName: string;
  teacher: string;
  age_grade?: string;
  date: string;
  subject?: string;
  campus?: string;
  city?: string;
  teacherComment?: string;
  recommendation?: string;
}

// Robotics Report Data
export interface RoboticsCapability {
  score: 1 | 2 | 3 | 4 | 5;
}

export type RoboticsScore = 1 | 2 | 3 | 4 | 5;

export interface RoboticsReportData extends BaseTrialReportData {
  subject: string;
  recognition?: RoboticsCapability;
  assembly?: RoboticsCapability;
  programming?: RoboticsCapability;
  communication?: RoboticsCapability;
}

// Coding Report Data
export interface CodingCriteriaGroup {
  [key: string]: number;
}

export interface CodingReportData extends BaseTrialReportData {
  subject: string;
  computationalThinking?: CodingCriteriaGroup;
  creativity?: CodingCriteriaGroup;
  communication?: CodingCriteriaGroup;
  problemSolving?: CodingCriteriaGroup;
  computerSkills?: CodingCriteriaGroup;
}

// Art Report Data
export interface ArtCapability {
  score: 1 | 2 | 3 | 4;
}

export type ArtScore = 1 | 2 | 3 | 4;

export interface ArtReportData extends BaseTrialReportData {
  subject: string;
  technology?: ArtCapability;
  creativity?: ArtCapability;
  designPrinciples?: ArtCapability;
  communication?: ArtCapability;
  selfLearning?: ArtCapability;
  campus?: string;
}

// Kiro 4+ Report Data
export type Kiro4PlusScore = 1 | 2 | 3 | 4 | 5;

export interface Kiro4PlusCapability {
  score: Kiro4PlusScore;
}

export interface Kiro4PlusReportData extends BaseTrialReportData {
  subject: string;
  recognition?: Kiro4PlusCapability;
  assembly?: Kiro4PlusCapability;
  programming?: Kiro4PlusCapability;
  communication?: Kiro4PlusCapability;
}

export type TrialReportForm =
  | Kiro4PlusForm
  | RoboticsForm
  | CodingForm
  | ArtForm;

export interface ReportTemplateField {
  key: TemplateFieldKey;
  label: string;
  placeholder?: string;
}

export interface ReportTemplateMeta {
  type: ReportType;
  title: string;
  fields: ReportTemplateField[];
}

export const REPORT_TEMPLATES: ReportTemplateMeta[] = [
  {
    type: "Kiro4+",
    title: "Kiro 4+",
    fields: [
      { key: "lessonTitle", label: "Tên bài học", placeholder: "VD: Làm quen cảm biến" },
      { key: "objectives", label: "Mục tiêu", placeholder: "Liệt kê mục tiêu buổi học" },
      { key: "activities", label: "Hoạt động", placeholder: "Mô tả các hoạt động chính" },
      { key: "studentFeedback", label: "Phản hồi học viên" },
    ],
  },
  {
    type: "Robotics",
    title: "Robotics",
    fields: [
      { key: "projectName", label: "Tên dự án", placeholder: "VD: Xe tránh vật cản" },
      { key: "partsUsed", label: "Linh kiện sử dụng" },
      { key: "programmingConcepts", label: "Khái niệm lập trình" },
      { key: "observations", label: "Quan sát của giáo viên" },
    ],
  },
  {
    type: "Coding",
    title: "Coding",
    fields: [
      { key: "projectTitle", label: "Tên dự án" },
      { key: "language", label: "Ngôn ngữ / công cụ", placeholder: "VD: Scratch, Python..." },
      { key: "keyConcepts", label: "Khái niệm chính" },
      { key: "challenges", label: "Thử thách & cách vượt qua" },
    ],
  },
  {
    type: "Art",
    title: "Art",
    fields: [
      { key: "projectTitle", label: "Tên tác phẩm" },
      { key: "medium", label: "Chất liệu", placeholder: "VD: Màu nước, đất sét..." },
      { key: "techniques", label: "Kỹ thuật" },
      { key: "observations", label: "Quan sát" },
    ],
  },
];