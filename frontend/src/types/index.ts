export interface User {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  permissions?: string[];
}

export interface Teacher {
  id: string;
  username: string;
  fullName: string;
  email: string;
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
