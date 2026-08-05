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
import { FileText, Pencil, Trash2 } from "lucide-react";
import { LessonContent, LessonBlockType } from "@/types/lesson";

const BLOCK_LABEL: Record<LessonBlockType, string> = {
  intro: "Giới thiệu",
  concept: "Khái niệm",
  activity: "Hoạt động",
  quiz: "Kiểm tra",
  "wrap-up": "Tổng kết"
};

const BLOCK_VARIANT: Record<LessonBlockType, "info" | "stratos" | "sunglow" | "success" | "crimson"> = {
  intro: "info",
  concept: "stratos",
  activity: "sunglow",
  quiz: "crimson",
  "wrap-up": "success"
};

interface LessonContentTableProps {
  data: LessonContent[];
  loading: boolean;
  onEdit: (item: LessonContent) => void;
  onDelete: (item: LessonContent) => void;
}

export function LessonContentTable({
  data,
  loading,
  onEdit,
  onDelete
}: LessonContentTableProps) {
  if (loading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground text-sm">
        Đang tải nội dung bài học...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-7 w-7" />}
        title="Chưa có khối nội dung nào"
        description="Chọn bài học và bấm “Thêm khối” để bắt đầu."
      />
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[24%]">Bài học</TableHead>
            <TableHead className="w-[12%]">Loại</TableHead>
            <TableHead className="w-[8%]">#</TableHead>
            <TableHead className="w-[20%]">Tiêu đề khối</TableHead>
            <TableHead className="w-[26%]">Nội dung</TableHead>
            <TableHead className="w-[10%] text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item._id}>
              <TableCell>
                <span className="text-xs font-mono text-muted-foreground">
                  {item.lessonTitle || item.lessonId}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={BLOCK_VARIANT[item.blockType]}>
                  {BLOCK_LABEL[item.blockType]}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-xs">{item.blockIndex}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm">{item.title || "—"}</span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground line-clamp-2">
                  {item.content || "—"}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(item)}
                    title="Chỉnh sửa"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(item)}
                    title="Xóa"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
