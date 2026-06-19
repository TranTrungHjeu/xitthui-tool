/**
 * Enum các Role chuẩn của hệ thống XitthuiTool.
 * Tách biệt hoàn toàn với Role gốc của MindX LMS.
 */
export enum AppRole {
  TEACHER = "TEACHER",
  TE = "TE", // Teacher Experience / Quản lý
}

/**
 * Enum các Permission chi tiết.
 * Dùng để kiểm tra hành động cụ thể thay vì check Role cứng.
 */
export enum AppPermission {
  ACCESS_DASHBOARD = "ACCESS_DASHBOARD",
  VIEW_OWN_SCHEDULE = "VIEW_OWN_SCHEDULE",
  MANAGE_ALL_SCHEDULES = "MANAGE_ALL_SCHEDULES",
  MANAGE_TEACHERS = "MANAGE_TEACHERS",
  MANAGE_SYSTEM = "MANAGE_SYSTEM",
}

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  givenName?: string;
  isActive: boolean;
  appRoles: AppRole[];
  appPermissions: AppPermission[];
  teacherCentres?: { id: string; name: string; shortName: string }[] | string[];
  teacherId?: string;
  firebaseUid?: string;
  /** @deprecated Dùng appRoles/appPermissions thay thế */
  permissions?: string[];
}

export interface Teacher {
  id: string;
  username: string;
  user: string;
  firebaseId: string;
  fullName: string;
  code: string;
  phoneNumber: string;
  email: string;
  personalEmail: string;
  gender: string;
  dob?: string;
  imageUrl?: string;
  address?: string;
  socialMediaLink?: string;
  courseLines?: { id: string; name: string }[];
  courses?: { id: string; name: string; shortName: string }[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
  teacherPoint: number;
  joinedDate?: string;
  centres?: Centre[];
}

export interface Course {
  id: string;
  name: string;
  shortName: string;
}

export interface Centre {
  id: string;
  name: string;
  shortName: string;
}

export interface ClassTeacher {
  _id: string;
  teacher: Teacher;
  role: {
    id: string;
    name: string;
    shortName: string;
  };
  isActive: boolean;
}

export interface Student {
  id: string;
  fullName: string;
}

export interface Attendance {
  _id: string;
  student: Student;
  status: string;
  comment?: string;
  sendCommentStatus?: string;
}

export interface Slot {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  summary: string;
  studentAttendance: Attendance[];
}

export interface ClassData {
  id: string;
  name: string;
  level: string;
  status: string;
  startDate: string;
  endDate: string;
  numberOfSessions: number;
  sessionHour: number;
  totalHour: number;
  course: Course;
  centre: Centre;
  teachers: ClassTeacher[];
  slots: Slot[];
}
