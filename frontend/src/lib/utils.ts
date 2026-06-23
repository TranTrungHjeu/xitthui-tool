import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isKhiemAccount(user: any): boolean {
  if (!user) return false;
  
  const isTE = Array.isArray(user.appRoles) && user.appRoles.includes("TE");
  
  return (
    isTE ||
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

export function formatSlotDateTime(
  dateInput: string | Date,
  startTime?: string,
  endTime?: string
): string {
  let date: Date;
  if (typeof dateInput === "string") {
    date = parseSlotDate(dateInput);
  } else {
    date = dateInput;
  }

  if (isNaN(date.getTime())) return String(dateInput);

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
