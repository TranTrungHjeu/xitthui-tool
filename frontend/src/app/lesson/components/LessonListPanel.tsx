"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen, QrCode, Pencil, Trash2, Eye, Plus } from "lucide-react";
import { Lesson } from "@/types/lesson";

interface LessonListPanelProps {
  lessons: Lesson[];
  loading: boolean;
  selectedId?: string;
  onSelect: (lesson: Lesson) => void;
  onEdit: (lesson: Lesson) => void;
  onDelete: (lesson: Lesson) => void;
  onShowQR: (lesson: Lesson) => void;
  onCreate?: () => void;
}

const SUBJECT_VARIANT: Record<string, "crimson" | "sunglow" | "stratos" | "info"> = {
  Coding: "stratos",
  Robotics: "crimson",
  Art: "sunglow",
  Kiro: "info"
};

export function LessonListPanel({
  lessons,
  loading,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onShowQR,
  onCreate
}: LessonListPanelProps) {
  if (loading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground text-sm">
        Đang tải bài học...
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-7 w-7" />}
        title="Chưa có bài học nào"
        description="Chọn bộ lọc khác hoặc tạo bài học mới."
        action={
          onCreate ? (
            <Button size="sm" onClick={onCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Tạo bài học
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[36%]">Tiêu đề</TableHead>
            <TableHead className="w-[12%]">Môn</TableHead>
            <TableHead className="w-[12%]">Mã KH</TableHead>
            <TableHead className="w-[8%]">Buổi</TableHead>
            <TableHead className="w-[10%]">Thời lượng</TableHead>
            <TableHead className="w-[22%] text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lessons.map((lesson) => {
            const selected = selectedId === lesson._id;
            return (
              <TableRow
                key={lesson._id}
                className={selected ? "bg-muted/50" : undefined}
                onClick={() => onSelect(lesson)}
                style={{ cursor: "pointer" }}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{lesson.title}</span>
                    {lesson.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {lesson.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={SUBJECT_VARIANT[lesson.subject] || "soft"}>
                    {lesson.subject}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-mono text-muted-foreground">
                    {lesson.courseCode || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs">{lesson.lessonNumber ?? "—"}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs">
                    {lesson.duration ? `${lesson.duration} phút` : "—"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(lesson);
                      }}
                      title="Xem nội dung"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowQR(lesson);
                      }}
                      title="QR Code"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(lesson);
                      }}
                      title="Chỉnh sửa"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(lesson);
                      }}
                      title="Xóa"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
