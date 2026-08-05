"use client";

import api from "./api";

export const BOOKING_TYPES = {
  TRIAL: "trial",
  SUBSTITUTE: "substitute",
  EXAMINER: "examiner",
} as const;

export type BookingType =
  (typeof BOOKING_TYPES)[keyof typeof BOOKING_TYPES];

export const BOOKING_ROLES = {
  LEC: "LEC",
  TA: "TA",
  GK: "GK",
} as const;

export type BookingRole =
  (typeof BOOKING_ROLES)[keyof typeof BOOKING_ROLES];

export interface BookableTeacher {
  id: string;
  fullName: string;
  code: string;
  email?: string;
  phoneNumber?: string;
}

export interface SubstituteSlot {
  slotId: string;
  classId: string | null;
  className: string | null;
  sessionIndex: number | null;
  sessionDate: string | null;
  timeSlot: string | null;
  startTime: string | null;
  endTime: string | null;
  centre: string | null;
  currentTeachers: {
    id: string;
    fullName: string;
    code: string;
    role: string | null;
  }[];
  availableRoles: BookingRole[];
}

export interface ExaminerSlot {
  slotId: string;
  classId: string | null;
  className: string | null;
  sessionIndex: number | null;
  sessionDate: string | null;
  timeSlot: string | null;
  startTime: string | null;
  endTime: string | null;
  centre: string | null;
  examType: string;
}

export interface AssignBookPayload {
  bookingType: BookingType;
  dateStr: string;
  slotId: string;
  role?: BookingRole | null;
  teacherId: string;
  teacherCode?: string;
  teacherName?: string;
  classId?: string | null;
  className?: string | null;
  sessionIndex?: number | null;
  sessionDate?: string | null;
  timeSlot?: string;
  normalizedTime?: string;
  subject?: string;
  type?: string;
  roomLink?: string;
  students?: string[];
  rowIndex?: number | null;
  performedBy?: string;
  performedByName?: string;
}

export const spreadsheetService = {
  getSpreadsheetData: async (range?: string) => {
    const url = range
      ? `/spreadsheet/data?range=${encodeURIComponent(range)}`
      : "/spreadsheet/data";
    const response = await api.get(url);
    return response.data;
  },

  getTrialAvailabilities: async (dateStr: string, centreIds: string) => {
    const response = await api.get(
      `/spreadsheet/trial-availabilities?dateStr=${dateStr}&centreIds=${centreIds}`,
    );
    return response.data;
  },

  assignTrialTeacher: async (payload: Record<string, unknown>) => {
    const response = await api.post("/spreadsheet/trial-bookings/assign", payload);
    return response.data;
  },

  unassignTrialTeacher: async (payload: { dateStr: string; slotId: string }) => {
    const response = await api.post("/spreadsheet/trial-bookings/unassign", payload);
    return response.data;
  },

  getSubstituteSlots: async (dateStr: string, centreIds: string) => {
    const response = await api.get(
      `/spreadsheet/substitute-slots?dateStr=${dateStr}&centreIds=${centreIds}`,
    );
    return response.data;
  },

  getExaminerSlots: async (dateStr: string, centreIds: string) => {
    const response = await api.get(
      `/spreadsheet/examiner-slots?dateStr=${dateStr}&centreIds=${centreIds}`,
    );
    return response.data;
  },

  getBookableTeachers: async (
    dateStr: string,
    slotStart: string,
    slotEnd: string,
    centreIds: string,
  ) => {
    const response = await api.get(
      `/spreadsheet/bookable-teachers?dateStr=${dateStr}&slotStart=${encodeURIComponent(
        slotStart,
      )}&slotEnd=${encodeURIComponent(slotEnd)}&centreIds=${centreIds}`,
    );
    return response.data;
  },

  assignBookTeacher: async (payload: AssignBookPayload) => {
    const response = await api.post("/spreadsheet/bookings/assign", payload);
    return response.data;
  },

  unassignBookTeacher: async (payload: {
    bookingType: BookingType;
    dateStr: string;
    slotId: string;
    role?: BookingRole | null;
    performedBy?: string;
    performedByName?: string;
  }) => {
    const response = await api.post("/spreadsheet/bookings/unassign", payload);
    return response.data;
  },
};
