import { format, isValid, parseISO } from "date-fns";
import { vi } from "date-fns/locale";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 in milliseconds

function toDate(value?: string | Date | null) {
  if (!value) return null;

  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  const parsed = parseISO(value);
  if (isValid(parsed)) return parsed;

  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}

export function formatDate(
  value?: string | Date | null,
  pattern = "dd/MM/yyyy",
) {
  const date = toDate(value);
  if (!date) return "N/A";

  return format(date, pattern, { locale: vi });
}

export function formatDateTime(
  value?: string | Date | null,
  pattern = "dd/MM/yyyy HH:mm",
) {
  const date = toDate(value);
  if (!date) return "N/A";

  return format(date, pattern, { locale: vi });
}

/**
 * Format a time value to "HH:mm" string, always in Vietnam timezone (UTC+7).
 *
 * - ISO strings (with "T"): converted to UTC+7 explicitly via getTime() + 7h.
 *   This is safe regardless of browser timezone and handles all offset variants
 *   (UTC "Z", "+07:00", "+08:00", etc.) correctly.
 * - Plain time strings ("HH:MM:SS" / "HH:MM"): returned as-is (treated as VN wall-clock).
 * - Date objects: converted to UTC+7 explicitly.
 */
export function formatTime(value?: string | Date | null) {
  if (!value) return "N/A";

  if (typeof value === "string") {
    const str = value.trim();

    // ISO string (has "T"): parse then convert to UTC+7 explicitly
    if (str.includes("T")) {
      const d = new Date(str);
      if (isNaN(d.getTime())) return "N/A";
      const vnDate = new Date(d.getTime() + VN_OFFSET_MS);
      return `${String(vnDate.getUTCHours()).padStart(2, "0")}:${String(vnDate.getUTCMinutes()).padStart(2, "0")}`;
    }

    // Plain time: "14:00:00" or "14:00" → treat as Vietnam wall-clock time
    if (/^\d{2}:\d{2}/.test(str)) return str.substring(0, 5);
    const parts = str.split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m))
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return "N/A";
  }

  // Date object: convert to UTC+7 explicitly
  const d = value as Date;
  if (isNaN(d.getTime())) return "N/A";
  const vnDate = new Date(d.getTime() + VN_OFFSET_MS);
  return `${String(vnDate.getUTCHours()).padStart(2, "0")}:${String(vnDate.getUTCMinutes()).padStart(2, "0")}`;
}

export function formatVietnameseDate(
  value?: string | Date | null,
  pattern = "EEEE, 'ngày' d 'tháng' M 'năm' yyyy",
) {
  const date = toDate(value);
  if (!date) return "N/A";

  return format(date, pattern, { locale: vi });
}

/**
 * Extract { hours, minutes } from a time string, normalized to Vietnam timezone (UTC+7).
 *
 * - ISO strings (with "T"): parsed as UTC/timezone-aware, then explicitly converted to UTC+7.
 *   Uses getTime() + 7h instead of relying on the browser's system timezone.
 * - Plain time strings ("HH:MM:SS"): extracted directly as Vietnam wall-clock time.
 */
export function extractHHMM(
  timeVal: string | null | undefined,
): { hours: number; minutes: number } | null {
  if (!timeVal) return null;
  const str = String(timeVal).trim();

  // ISO string (has "T"): parse then convert to UTC+7 explicitly
  if (str.includes("T")) {
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    const vnDate = new Date(d.getTime() + VN_OFFSET_MS);
    return { hours: vnDate.getUTCHours(), minutes: vnDate.getUTCMinutes() };
  }

  // Plain time ("14:00:00" or "14:00"): treat as Vietnam wall-clock time directly
  const parts = str.split(":");
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) return { hours: h, minutes: m };
  }
  return null;
}

/**
 * Extract date string "YYYY-MM-DD" directly from a datetime string.
 * For ISO strings, extracts the date component before "T" without timezone conversion.
 * Note: for UTC strings near midnight this could shift by 1 day vs Vietnam date,
 * but this is acceptable since MindX class dates are never stored as UTC midnight.
 */
export function extractDatePart(value: string | null | undefined): string {
  if (!value) return "";
  const str = String(value).trim();
  // ISO: "2024-01-15T14:00:00+08:00" → "2024-01-15"
  if (str.includes("T")) return str.substring(0, 10);
  // Date-only: "2024-01-15"
  return str.substring(0, 10);
}
