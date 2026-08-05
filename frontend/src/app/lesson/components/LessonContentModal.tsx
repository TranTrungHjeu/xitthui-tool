"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import {
  ContentMode,
  LESSON_BLOCK_TYPES,
  LessonBlockType,
  LessonContent,
  LessonResource
} from "@/types/lesson";

interface LessonContentModalProps {
  open: boolean;
  mode: ContentMode;
  initialValues?: LessonContent | null;
  onClose: () => void;
  onSubmit: (values: Partial<LessonContent>) => Promise<void> | void;
  defaultLessonId?: string;
  nextBlockIndex: number;
}

const BLOCK_LABEL: Record<LessonBlockType, string> = {
  intro: "Giới thiệu",
  concept: "Khái niệm",
  activity: "Hoạt động",
  quiz: "Kiểm tra",
  "wrap-up": "Tổng kết"
};

export function LessonContentModal({
  open,
  mode,
  initialValues,
  onClose,
  onSubmit,
  defaultLessonId,
  nextBlockIndex
}: LessonContentModalProps) {
  const [lessonId, setLessonId] = useState(defaultLessonId || "");
  const [blockType, setBlockType] = useState<LessonBlockType>("intro");
  const [blockIndex, setBlockIndex] = useState<number>(nextBlockIndex);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(0);
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialValues) {
      setLessonId(initialValues.lessonId);
      setBlockType(initialValues.blockType);
      setBlockIndex(initialValues.blockIndex);
      setTitle(initialValues.title || "");
      setContent(initialValues.content || "");
      setEstimatedMinutes(initialValues.estimatedMinutes || 0);
      setResources(initialValues.resources || []);
    } else {
      setLessonId(defaultLessonId || "");
      setBlockType("intro");
      setBlockIndex(nextBlockIndex);
      setTitle("");
      setContent("");
      setEstimatedMinutes(0);
      setResources([]);
    }
  }, [open, mode, initialValues, defaultLessonId, nextBlockIndex]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonId.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        lessonId: lessonId.trim(),
        blockType,
        blockIndex: Number.isFinite(blockIndex) ? blockIndex : 0,
        title: title.trim(),
        content: content.trim(),
        estimatedMinutes: Number.isFinite(estimatedMinutes) ? estimatedMinutes : 0,
        resources: resources.filter((r) => r.url.trim())
      });
    } finally {
      setSaving(false);
    }
  };

  const addResource = () => {
    setResources((prev) => [...prev, { url: "", label: "" }]);
  };

  const updateResource = (idx: number, key: keyof LessonResource, value: string) => {
    setResources((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );
  };

  const removeResource = (idx: number) => {
    setResources((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Thêm khối nội dung" : "Chỉnh sửa khối nội dung"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lc-lessonId">Lesson ID</Label>
              <Input
                id="lc-lessonId"
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
                placeholder="lsn_xxx_1"
                disabled={mode === "edit"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lc-blockType">Loại khối</Label>
              <Select
                value={blockType}
                onValueChange={(v) => setBlockType(v as LessonBlockType)}
              >
                <SelectTrigger id="lc-blockType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_BLOCK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {BLOCK_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lc-blockIndex">Thứ tự khối</Label>
              <Input
                id="lc-blockIndex"
                type="number"
                value={blockIndex}
                onChange={(e) => setBlockIndex(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lc-estimatedMinutes">Thời lượng (phút)</Label>
              <Input
                id="lc-estimatedMinutes"
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lc-title">Tiêu đề khối</Label>
            <Input
              id="lc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Giới thiệu về biến số"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lc-content">Nội dung (Markdown)</Label>
            <Textarea
              id="lc-content"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung chi tiết..."
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Tài nguyên (links)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addResource}
              >
                <Plus className="h-3 w-3" />
                Thêm link
              </Button>
            </div>
            <div className="space-y-2">
              {resources.length === 0 && (
                <p className="text-xs text-muted-foreground">Chưa có tài nguyên.</p>
              )}
              {resources.map((r, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <Input
                    placeholder="https://..."
                    value={r.url}
                    onChange={(e) => updateResource(idx, "url", e.target.value)}
                  />
                  <Input
                    placeholder="Nhãn (tùy chọn)"
                    value={r.label || ""}
                    onChange={(e) => updateResource(idx, "label", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeResource(idx)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving || !lessonId.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "add" ? "Thêm khối" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
