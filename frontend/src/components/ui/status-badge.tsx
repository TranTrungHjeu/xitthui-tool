import * as React from "react"
import { Badge } from "@/components/ui/badge"

type BadgeType = "class" | "attendance" | "lms" | "session"

interface StatusBadgeProps {
  type: BadgeType
  status: string
  className?: string
  count?: number
}

const VARIANT_MAP: Record<
  string,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  // class
  RUNNING: "success",
  FINISHED: "secondary",
  PRE_OPEN: "info",
  PREPARING: "info",
  NEW: "soft",
  OPEN: "success",
  PENDING: "warning",
  SUSPENDED: "warning",
  ABANDONED: "destructive",
  REJECTED: "destructive",

  // attendance
  PRESENT: "success",
  ATTENDED: "success",
  ABSENT: "destructive",
  ABSENT_WITH_NOTICE: "warning",
  LATE: "warning",
  LATE_ARRIVED: "warning",
  SUBMITTED: "info",
  RE_SUBMITTED: "info",
  GRADED: "success",
  MARKED: "success",
  NOT_SUBMITTED: "warning",
  IN_PROGRESS: "warning",

  // lms
  SENT: "success",
  FAILED: "destructive",
}

const LABEL_MAP: Record<string, string> = {
  // class
  RUNNING: "Đang diễn ra",
  FINISHED: "Đã kết thúc",
  PRE_OPEN: "Sắp khai giảng",
  PREPARING: "Đang chuẩn bị",
  NEW: "Mới",
  OPEN: "Đang mở",
  PENDING: "Chờ duyệt",
  SUSPENDED: "Tạm dừng",
  ABANDONED: "Đã hủy",
  REJECTED: "Bị từ chối",
  CLOSED: "Đã đóng",
  ENDED: "Đã kết thúc",

  // attendance
  PRESENT: "Có mặt",
  ATTENDED: "Có mặt",
  ABSENT: "Vắng mặt",
  ABSENT_WITH_NOTICE: "Vắng có phép",
  LATE: "Đi muộn",
  LATE_ARRIVED: "Đi muộn",
  SUBMITTED: "Đã nộp",
  RE_SUBMITTED: "Đã nộp lại",
  GRADED: "Đã chấm",
  MARKED: "Đã chấm",
  NOT_SUBMITTED: "Chưa nộp",
  IN_PROGRESS: "Đang làm",

  // lms
  SENT: "Đã gửi",
  FAILED: "Lỗi gửi",
}

export function StatusBadge({
  type,
  status,
  className,
  count,
}: StatusBadgeProps) {
  const normalized = (status || "").toUpperCase().replace(/\s+/g, "_")

  let label = LABEL_MAP[normalized] || status
  let variant = VARIANT_MAP[normalized] || "outline"

  if (normalized === "RE_SUBMITTED" && count) {
    label = `Đã nộp lần ${count}`
  }

  return (
    <Badge variant={variant as any} className={className}>
      {label}
    </Badge>
  )
}

export { StatusBadge as default }
