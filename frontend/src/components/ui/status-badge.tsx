import * as React from "react";
import { Badge } from "@/components/ui/badge";

type BadgeType = "class" | "attendance" | "lms";

interface StatusBadgeProps {
  type: BadgeType;
  status: string;
  className?: string;
  count?: number;
}

export function StatusBadge({
  type,
  status,
  className,
  count,
}: StatusBadgeProps) {
  let label = status;
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let customStyle = "";

  if (type === "class") {
    const normalizedStatus = status
      ? status.toUpperCase().replace(/\s+/g, "_")
      : "";
    switch (normalizedStatus) {
      case "RUNNING":
        label = "Đang diễn ra";
        variant = "default";
        break;
      case "FINISHED":
        label = "Đã kết thúc";
        variant = "secondary";
        break;
      case "PRE_OPEN":
        label = "Sắp khai giảng";
        variant = "secondary";
        customStyle =
          "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
        break;
      case "PREPARING":
        label = "Đang chuẩn bị";
        variant = "secondary";
        customStyle =
          "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800";
        break;
      case "NEW":
        label = "Mới";
        variant = "secondary";
        customStyle =
          "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
        break;
      case "OPEN":
        label = "Đang mở";
        variant = "secondary";
        customStyle =
          "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800";
        break;
      case "PENDING":
        label = "Chờ duyệt";
        variant = "secondary";
        customStyle =
          "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
        break;
      case "SUSPENDED":
        label = "Tạm dừng";
        variant = "secondary";
        customStyle =
          "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
        break;
      case "ABANDONED":
        label = "Đã hủy";
        variant = "destructive";
        break;
      case "REJECTED":
        label = "Bị từ chối";
        variant = "destructive";
        break;
      default:
        label = status;
        variant = "outline";
    }
  } else if (type === "attendance") {
    // Restoring exactly original code structure for attendance
    switch (status) {
      case "PRESENT":
      case "ATTENDED":
        label = "Có mặt";
        variant = "default";
        break;
      case "ABSENT":
        label = "Vắng mặt";
        variant = "destructive";
        break;
      case "ABSENT_WITH_NOTICE":
        label = "Vắng có phép";
        variant = "destructive";
        customStyle =
          "bg-orange-500/10 text-orange-600 border-orange-200 dark:bg-orange-500/20";
        break;
      case "LATE":
      case "LATE_ARRIVED":
        label = "Đi muộn";
        variant = "destructive";
        customStyle =
          "bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:bg-yellow-500/20";
        break;
      case "SUBMITTED":
        label = "Đã nộp";
        customStyle = "bg-blue-500 text-white border-blue-500";
        break;
      case "RE_SUBMITTED":
        label = count ? `Đã nộp lần ${count}` : "Đã nộp lại";
        customStyle = "bg-purple-600 text-white border-purple-600";
        break;
      case "GRADED":
      case "MARKED":
        label = "Đã chấm";
        customStyle = "bg-green-500 text-white border-green-500";
        break;
      case "NOT_SUBMITTED":
        label = "Chưa nộp";
        customStyle =
          "bg-orange-500/10 text-orange-600 border-orange-300 dark:bg-orange-500/20";
        break;
      case "PENDING":
      case "IN_PROGRESS":
        label = "Đang làm";
        customStyle =
          "bg-yellow-500/10 text-yellow-600 border-yellow-300 dark:bg-yellow-500/20";
        break;
      default:
        label = status;
        variant = "outline";
    }
  } else if (type === "lms") {
    // Restoring exactly original code structure for lms
    switch (status) {
      case "SENT":
        label = "Đã gửi";
        customStyle = "bg-green-500 text-white";
        break;
      case "FAILED":
        label = "Lỗi gửi";
        variant = "destructive";
        break;
      default:
        label = "Chưa gửi";
        variant = "outline";
    }
  }

  return (
    <Badge variant={variant} className={`${customStyle} ${className || ""}`}>
      {label}
    </Badge>
  );
}
