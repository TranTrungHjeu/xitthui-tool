import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Role constants - shared between frontend and backend
 * Keep these in sync with backend/src/constants/roles.js
 */
export const ROLES = {
  TEACHER: "TEACHER",
  TE: "TE",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

/**
 * Check if user has TE role
 * Source of truth for TE role checks in the frontend.
 */
export function isTE(user: any): boolean {
  if (!user) return false;
  const roles = user.appRoles || user.roles || [];
  return Array.isArray(roles) && roles.includes(ROLES.TE);
}

/**
 * Check if user has Teacher role
 */
export function isTeacher(user: any): boolean {
  if (!user) return false;
  const roles = user.appRoles || user.roles || [];
  return Array.isArray(roles) && roles.includes(ROLES.TEACHER);
}

/**
 * Check if user has any elevated role
 */
export function isElevatedRole(user: any): boolean {
  return isTE(user) || isTeacher(user);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isKhiemAccount(user: any): boolean {
  if (!user) return false;

  const isTERole = isTE(user);

  return (
    isTERole ||
    user.username === "lekhiem2002" ||
    user.username === "I3470" ||
    user.email === "lekhiem2002@mindx.net.vn" ||
    user.email === "lethekhiem2002@mindx.net.vn" ||
    user.email === "khiemlt@mindx.com.vn" ||
    user.email === "khiemlt@mindx.net.vn"
  );
}

export function isActualKhiemAccount(user: any): boolean {
  if (!user) return false;
  return (
    user.username === "lekhiem2002" ||
    user.username === "I3470" ||
    user.email === "lekhiem2002@mindx.net.vn" ||
    user.email === "lethekhiem2002@mindx.net.vn" ||
    user.email === "khiemlt@mindx.com.vn" ||
    user.email === "khiemlt@mindx.net.vn"
  );
}

export function getRelativeDateString(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);
  
  const now = new Date();
  const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d2 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = d1.getTime() - d2.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return "Hôm nay";
  } else if (diffDays === 1) {
    return "Hôm qua";
  } else if (diffDays > 1) {
    return `${diffDays} ngày trước`;
  } else if (diffDays === -1) {
    return "Ngày mai";
  } else {
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  }
}

export function parseSlotDate(dateStr: string): Date {
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
  }
  return new Date(dateStr);
}

export function formatTimePart(timeStr?: string): string {
  if (!timeStr) return "";
  let hours = 0;
  let minutes = 0;
  if (timeStr.includes("T")) {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      hours = d.getHours();
      minutes = d.getMinutes();
    } else {
      return "";
    }
  } else if (timeStr.includes(":")) {
    const parts = timeStr.split(":");
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
  } else {
    return "";
  }
  if (minutes === 0) {
    return `${hours}H`;
  }
  return `${hours}H${String(minutes).padStart(2, "0")}`;
}

export function getDayOfWeekVi(date: Date): string {
  const day = date.getDay();
  if (day === 0) return "CN";
  return `T${day + 1}`;
}

export function formatDateDMY(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = String(date.getFullYear()).slice(-2);
  return `${d}/${m}/${y}`;
}

/**
 * Get current date in Vietnam timezone (UTC+7) as YYYY-MM-DD string.
 * This fixes the issue where `new Date().toISOString()` returns UTC date,
 * causing files to be saved under the previous day when it's still
 * before midnight in Vietnam.
 */
export function getTodayVietnam(): string {
  // Create date in Vietnam timezone by adding 7 hours to UTC
  const vnDate = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const y = vnDate.getUTCFullYear();
  const m = String(vnDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(vnDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get current date as Date object in Vietnam timezone (UTC+7).
 * Use this instead of `new Date()` when you need Vietnam local date.
 */
export function getTodayVietnamDate(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

export function formatSlotDateTime(
  dateInput: string | Date | null | undefined,
  startTime?: string,
  endTime?: string
): string {
  if (dateInput === null || dateInput === undefined || dateInput === "") {
    return "—";
  }

  const date: Date =
    typeof dateInput === "string" ? parseSlotDate(dateInput) : dateInput;

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "—";
  }

  const timePart = [formatTimePart(startTime), formatTimePart(endTime)]
    .filter(Boolean)
    .join(" - ");
  const dayOfWeek = getDayOfWeekVi(date);
  const datePart = formatDateDMY(date);

  if (timePart) {
    return `${timePart}, ${dayOfWeek} - ${datePart}`;
  }
  return `${dayOfWeek} - ${datePart}`;
}
