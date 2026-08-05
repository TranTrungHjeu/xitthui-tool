"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { Lesson, LessonContent, LessonBlockType } from "@/types/lesson";

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

interface LessonContentPanelProps {
  lesson: Lesson | null;
  blocks: LessonContent[];
  loading: boolean;
  onAddBlock: () => void;
  onEditBlock: (block: LessonContent) => void;
  onDeleteBlock: (block: LessonContent) => void;
}

export function LessonContentPanel({
  lesson,
  blocks,
  loading,
  onAddBlock,
  onEditBlock,
  onDeleteBlock
}: LessonContentPanelProps) {
  if (!lesson) {
    return (
      <EmptyState
        icon={<FileText className="h-7 w-7" />}
        title="Chọn một bài học"
        description="Chọn bài học ở bảng bên trái để xem các khối nội dung."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{lesson.title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {lesson.description || "Chưa có mô tả"}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="soft">{lesson.subject}</Badge>
              {lesson.courseCode && (
                <Badge variant="outline">{lesson.courseCode}</Badge>
              )}
              {lesson.lessonNumber !== undefined && (
                <Badge variant="outline">Buổi {lesson.lessonNumber}</Badge>
              )}
              {lesson.duration && (
                <Badge variant="outline">{lesson.duration} phút</Badge>
              )}
            </div>
          </div>
          <Button size="sm" onClick={onAddBlock}>
            <Plus className="h-4 w-4" />
            Thêm khối
          </Button>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="grid place-items-center py-12 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Đang tải nội dung...
        </div>
      ) : blocks.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-7 w-7" />}
          title="Chưa có khối nội dung"
          description="Bấm “Thêm khối” để tạo khối nội dung đầu tiên."
        />
      ) : (
        <div className="space-y-2.5">
          {blocks.map((block) => (
            <Card key={block._id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant={BLOCK_VARIANT[block.blockType]}>
                        {BLOCK_LABEL[block.blockType]}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        #{block.blockIndex}
                      </span>
                      {block.estimatedMinutes ? (
                        <span className="text-xs text-muted-foreground">
                          · {block.estimatedMinutes} phút
                        </span>
                      ) : null}
                    </div>
                    {block.title && (
                      <h4 className="text-sm font-semibold mb-1">{block.title}</h4>
                    )}
                    {block.content && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                        {block.content}
                      </p>
                    )}
                    {block.resources && block.resources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {block.resources.map((r, idx) => (
                          <a
                            key={`${block._id}_r_${idx}`}
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {r.label || r.url}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEditBlock(block)}
                      title="Chỉnh sửa khối"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDeleteBlock(block)}
                      title="Xóa khối"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
