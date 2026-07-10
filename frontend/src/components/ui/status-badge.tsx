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
        // RUNNING -> green semantic color
        customStyle =
          "bg-emerald-500/10 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800/40";
        break;
      case "FINISHED":
        label = "Đã kết thúc";
        variant = "secondary"; // default gray
        break;
      case "PRE_OPEN":
        label = "Sắp khai giảng";
        customStyle =
          "bg-blue-500/10 text-blue-700 border-blue-200/50 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/40";
        break;
      case "PREPARING":
        label = "Đang chuẩn bị";
        customStyle =
          "bg-indigo-500/10 text-indigo-700 border-indigo-200/50 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/40";
        break;
      case "NEW":
        label = "Mới";
        customStyle =
          "bg-slate-500/10 text-slate-700 border-slate-200/50 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700/50";
        break;
      case "OPEN":
        label = "Đang mở";
        customStyle =
          "bg-teal-500/10 text-teal-700 border-teal-200/50 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800/40";
        break;
      case "PENDING":
        label = "Chờ duyệt";
        customStyle =
          "bg-amber-500/10 text-amber-700 border-amber-200/50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40";
        break;
      case "SUSPENDED":
        label = "Tạm dừng";
        customStyle =
          "bg-orange-500/10 text-orange-700 border-orange-200/50 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/40";
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
    switch (status) {
      case "PRESENT":
      case "ATTENDED":
        label = "Có mặt";
        // PRESENT -> green success style
        customStyle =
          "bg-emerald-500/10 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800/40";
        break;
      case "ABSENT":
        label = "Vắng mặt";
        variant = "destructive";
        break;
      case "ABSENT_WITH_NOTICE":
        label = "Vắng có phép";
        customStyle =
          "bg-orange-500/10 text-orange-700 border-orange-200/50 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/40";
        break;
      case "LATE":
      case "LATE_ARRIVED":
        label = "Đi muộn";
        customStyle =
          "bg-amber-500/10 text-amber-700 border-amber-200/50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40";
        break;
      case "SUBMITTED":
        label = "Đã nộp";
        customStyle =
          "bg-blue-500/10 text-blue-700 border-blue-200/50 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/40";
        break;
      case "RE_SUBMITTED":
        label = count ? `Đã nộp lần ${count}` : "Đã nộp lại";
        customStyle =
          "bg-purple-500/10 text-purple-700 border-purple-200/50 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/40";
        break;
      case "GRADED":
      case "MARKED":
        label = "Đã chấm";
        customStyle =
          "bg-emerald-500/10 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800/40";
        break;
      case "NOT_SUBMITTED":
        label = "Chưa nộp";
        customStyle =
          "bg-orange-500/10 text-orange-700 border-orange-200/50 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/40";
        break;
      case "PENDING":
      case "IN_PROGRESS":
        label = "Đang làm";
        customStyle =
          "bg-amber-500/10 text-amber-700 border-amber-200/50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40";
        break;
      default:
        label = status;
        variant = "outline";
    }
  } else if (type === "lms") {
    switch (status) {
      case "SENT":
        label = "Đã gửi";
        customStyle =
          "bg-emerald-500/10 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800/40";
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
