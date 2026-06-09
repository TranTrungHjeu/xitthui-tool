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
    switch (status) {
      case "RUNNING":
        label = "Đang diễn ra";
        variant = "default";
        break;
      case "UPCOMING":
        label = "Sắp khai giảng";
        variant = "secondary";
        break;
      case "FINISHED":
        label = "Đã kết thúc";
        variant = "secondary";
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
      case "IN_PROGRESS": // Adding IN_PROGRESS from API for clearer distinction
        label = "Đang làm"; // "In Progress"
        customStyle =
          "bg-yellow-500/10 text-yellow-600 border-yellow-300 dark:bg-yellow-500/20";
        break;
      default:
        label = status;
        variant = "outline";
    }
  } else if (type === "lms") {
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

