export type PayrollType = "CLASS" | "OFFICE_HOURS";
export type PayrollStatus = "CHECKED" | "UNCHECKED";
export type PayrollPeriodStatus = "active" | "archived";

export interface PayrollPeriod {
  _id: string;
  label: string;
  month: number;
  year: number;
  originalFileName: string;
  uploadedById: string | null;
  uploadedByName: string;
  uploadedAt: string;
  recordCount: number;
  status: PayrollPeriodStatus;
  expiresAt: string | null;
  updatedAt?: string;
  createdAt?: string;
}

export interface PayrollRecord {
  _id: string;
  periodId: string;

  centreShortname: string;
  classSiteCentre: string;
  type: PayrollType;
  className: string;
  classSite: string;
  course: string;
  courseLine: string;

  teacherName: string;
  workEmail: string;
  personalEmail: string;
  username: string;
  classRole: string;
  status: PayrollStatus;

  slotTime: string | null;
  slotDuration: number;
  effectiveDuration: number;
  studentCount: number;

  requestedBy: string;
  note: string;
  managerNote: string;
  confirmStatus: string;
  confirmNote: string;
}

export interface PayrollKpis {
  totalRecords: number;
  totalSlots: number;
  totalEffectiveHours: number;
  totalStudents: number;
  checkedCount: number;
  uncheckedCount: number;
  teacherCount: number;
}

export interface PayrollByRole {
  role: string;
  count: number;
  hours: number;
  checked: number;
}

export interface PayrollByCentre {
  centre: string;
  count: number;
  hours: number;
}

export interface PayrollByStatus {
  status: PayrollStatus;
  count: number;
}

export interface PayrollCentreOption {
  id: string;
  label: string;
  count: number;
}

export interface PayrollSummary {
  periodId: string;
  kpis: PayrollKpis;
  byRole: PayrollByRole[];
  byCentre: PayrollByCentre[];
  byStatus: PayrollByStatus[];
}

export interface PayrollMonthlyRollup {
  username: string;
  teacherName: string;
  workEmail: string;
  totalSessions: number;
  checkedSessions: number;
  lecCount: number;
  taCount: number;
  ohCount: number;
  totalEffectiveHours: number;
  totalStudents: number;
  centres: string[];
}

export interface PayrollSearchParams {
  q?: string;
  periodId?: string;
  type?: PayrollType;
  classRole?: string;
  centre?: string;
  status?: PayrollStatus;
  month?: number;
  year?: number;
  page?: number;
  pageSize?: number;
}

export interface PayrollPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PayrollSearchResponse {
  data: PayrollRecord[];
  pagination: PayrollPagination;
}

export interface PayrollPreviewRow {
  idx: number;
  teacherName: string;
  className: string;
  classRole: string;
  type: PayrollType;
  status: PayrollStatus;
  slotTime: string | null;
  slotDuration: number;
  effectiveDuration: number;
  centreShortname: string;
}

export interface PayrollPreviewResponse {
  periodMeta: {
    _id: string;
    label: string;
    month: number;
    year: number;
    originalFileName: string;
  };
  preview: PayrollPreviewRow[];
  totalRecords: number;
  warnings: { row: number; reason: string }[];
}

export interface PayrollUploadResponse {
  periodId: string;
  label: string;
  month: number;
  year: number;
  recordCount: number;
  warnings: { row: number; reason: string }[];
  expiresAt: string;
}

export type PayrollIssueStatus =
  | "pending"
  | "notified"
  | "resolved"
  | "dismissed";

export interface PayrollIssueReport {
  _id: string;
  payrollRecordId: string;
  periodId: string;
  centreShortname: string;
  teacherName: string;
  teacherUsername: string;
  teacherWorkEmail: string;
  teacherClassName: string;
  teacherSlotTime: string | null;
  teacherEffectiveDuration: number;
  payrollRecordStatus: "CHECKED" | "UNCHECKED";
  reason: string;
  reporterUserId: string | null;
  reporterUsername: string;
  reporterFullName: string;
  reporterEmail: string;
  status: PayrollIssueStatus;
  emailHistory: PayrollIssueEmailLog[];
  reviewedByUserId: string | null;
  reviewedByName: string;
  reviewedAt: string | null;
  resolutionNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollIssueEmailLog {
  sentAt: string;
  sentByUserId: string | null;
  sentByName: string;
  to: string[];
  cc: string[];
  subject: string;
  messageId: string;
  /**
   * tri-state:
   *   - true: SMTP sent successfully
   *   - false: SMTP attempted but failed
   *   - null: Outlook compose deeplink opened (user sends manually)
   */
  success: boolean | null;
  error: string;
}

export interface PayrollIssueListResponse {
  data: PayrollIssueReport[];
  pagination: PayrollPagination;
}

export interface PayrollIssueNotifyResponse {
  sent: number;
  mode?: "smtp" | "outlook";
  messageId: string;
  to: string;
  cc: string[];
  outlookComposeUrl?: string | null;
  error: string;
}

export interface PayrollIssueHistoryResponse {
  emailHistory: PayrollIssueEmailLog[];
  status: PayrollIssueStatus;
}