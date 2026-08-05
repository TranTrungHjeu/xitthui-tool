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
import { Lesson, LessonMode, LessonSubject, LESSON_SUBJECTS } from "@/types/lesson";

interface LessonFormModalProps {
  open: boolean;
  mode: LessonMode;
  initialValues?: Lesson | null;
  onClose: () => void;
  onSubmit: (values: Partial<Lesson>) => Promise<void> | void;
}

const DEFAULT_VALUES: Partial<Lesson> = {
  title: "",
  description: "",
  subject: "Coding",
  courseCode: "",
  courseName: "",
  lessonNumber: 1,
  duration: 60,
  objectives: [],
  prerequisites: [],
  materials: [],
  tags: []
};

function arrayToText(arr?: string[]) {
  return arr && arr.length > 0 ? arr.join("\n") : "";
}

function textToArray(text: string) {
  return text
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function LessonFormModal({
  open,
  mode,
  initialValues,
  onClose,
  onSubmit
}: LessonFormModalProps) {
  const [form, setForm] = useState<Partial<Lesson>>(DEFAULT_VALUES);
  const [objectivesText, setObjectivesText] = useState("");
  const [prerequisitesText, setPrerequisitesText] = useState("");
  const [materialsText, setMaterialsText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialValues) {
      setForm({
        ...DEFAULT_VALUES,
        ...initialValues
      });
      setObjectivesText(arrayToText(initialValues.objectives));
      setPrerequisitesText(arrayToText(initialValues.prerequisites));
      setMaterialsText(arrayToText(initialValues.materials));
      setTagsText(arrayToText(initialValues.tags));
    } else {
      setForm(DEFAULT_VALUES);
      setObjectivesText("");
      setPrerequisitesText("");
      setMaterialsText("");
      setTagsText("");
    }
  }, [open, mode, initialValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        title: form.title?.trim(),
        description: form.description?.trim(),
        courseCode: form.courseCode?.trim(),
        courseName: form.courseName?.trim(),
        lessonNumber: Number.isFinite(form.lessonNumber) ? form.lessonNumber : 0,
        duration: Number.isFinite(form.duration) ? form.duration : 60,
        objectives: textToArray(objectivesText),
        prerequisites: textToArray(prerequisitesText),
        materials: textToArray(materialsText),
        tags: textToArray(tagsText)
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Tạo bài học mới" : "Chỉnh sửa bài học"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lf-title">Tiêu đề *</Label>
              <Input
                id="lf-title"
                value={form.title || ""}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lf-subject">Môn học *</Label>
              <Select
                value={form.subject}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, subject: v as LessonSubject }))
                }
              >
                <SelectTrigger id="lf-subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lf-courseCode">Mã khóa học</Label>
              <Input
                id="lf-courseCode"
                value={form.courseCode || ""}
                onChange={(e) => setForm((f) => ({ ...f, courseCode: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lf-courseName">Tên khóa học</Label>
              <Input
                id="lf-courseName"
                value={form.courseName || ""}
                onChange={(e) => setForm((f) => ({ ...f, courseName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lf-lessonNumber">Số buổi</Label>
              <Input
                id="lf-lessonNumber"
                type="number"
                value={form.lessonNumber ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lessonNumber: Number(e.target.value) }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lf-duration">Thời lượng (phút)</Label>
              <Input
                id="lf-duration"
                type="number"
                value={form.duration ?? 60}
                onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lf-tags">Tags (phân cách bằng dấu phẩy hoặc xuống dòng)</Label>
              <Textarea
                id="lf-tags"
                rows={2}
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lf-description">Mô tả</Label>
            <Textarea
              id="lf-description"
              rows={3}
              value={form.description || ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lf-objectives">Mục tiêu bài học</Label>
            <Textarea
              id="lf-objectives"
              rows={2}
              value={objectivesText}
              onChange={(e) => setObjectivesText(e.target.value)}
              placeholder="Mỗi dòng một mục tiêu"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lf-prerequisites">Điều kiện tiên quyết</Label>
            <Textarea
              id="lf-prerequisites"
              rows={2}
              value={prerequisitesText}
              onChange={(e) => setPrerequisitesText(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lf-materials">Học liệu</Label>
            <Textarea
              id="lf-materials"
              rows={2}
              value={materialsText}
              onChange={(e) => setMaterialsText(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              <X className="h-4 w-4" />
              Hủy
            </Button>
            <Button type="submit" disabled={saving || !form.title?.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {mode === "add" ? "Tạo bài học" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
