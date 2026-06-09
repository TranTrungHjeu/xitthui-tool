import { format, isValid, parseISO } from "date-fns";
import { vi } from "date-fns/locale";

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

export function formatTime(value?: string | Date | null) {
  const date = toDate(value);
  if (!date) return "N/A";

  return format(date, "HH:mm", { locale: vi });
}

export function formatVietnameseDate(
  value?: string | Date | null,
  pattern = "EEEE, 'ngày' d 'tháng' M 'năm' yyyy",
) {
  const date = toDate(value);
  if (!date) return "N/A";

  return format(date, pattern, { locale: vi });
}
