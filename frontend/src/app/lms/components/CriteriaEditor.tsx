"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { lmsService } from "@/services/lmsService";
import type {
  LmsCriteriaSection,
  LmsCriteriaTemplate,
  LmsSubject,
} from "@/types/lms";

interface CriteriaEditorProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => Promise<void> | void;
  readonly currentSubject: LmsSubject;
  readonly editingCriteria: LmsCriteriaTemplate | null;
}

function genId(): string {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function CriteriaEditor({
  open,
  onClose,
  onSuccess,
  currentSubject,
  editingCriteria,
}: CriteriaEditorProps) {
  const [name, setName] = useState("");
  const [sections, setSections] = useState<LmsCriteriaSection[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingCriteria) {
      setName(editingCriteria.name);
      setSections(JSON.parse(JSON.stringify(editingCriteria.sections || [])));
    } else {
      setName("");
      setSections([]);
    }
    setNameError(null);
  }, [open, editingCriteria]);

  const handleAddSection = () => {
    setSections((prev) => [
      ...prev,
      { title: `Nhóm tiêu chí ${prev.length + 1}`, criteria: [] },
    ]);
  };

  const handleRemoveSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSectionTitleChange = (idx: number, value: string) => {
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, title: value } : s)),
    );
  };

  const handleAddCriteria = (sectionIdx: number) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIdx
          ? { ...s, criteria: [...(s.criteria || []), { id: genId(), label: "", value: "" }] }
          : s,
      ),
    );
  };

  const handleRemoveCriteria = (sectionIdx: number, criteriaIdx: number) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIdx
          ? {
              ...s,
              criteria: (s.criteria || []).filter((_, ci) => ci !== criteriaIdx),
            }
          : s,
      ),
    );
  };

  const handleCriteriaChange = (
    sectionIdx: number,
    criteriaIdx: number,
    field: "label" | "value",
    value: string,
  ) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIdx
          ? {
              ...s,
              criteria: (s.criteria || []).map((c, ci) =>
                ci === criteriaIdx ? { ...c, [field]: value } : c,
              ),
            }
          : s,
      ),
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError("Vui lòng nhập tên bộ tiêu chí");
      return;
    }
    if (sections.length === 0) {
      toast.warning("Vui lòng thêm ít nhất một nhóm tiêu chí");
      return;
    }

    setSaving(true);
    try {
      await lmsService.saveCriteria({
        id: editingCriteria?._id,
        name: name.trim(),
        subject: currentSubject,
        sections,
        type: "custom",
      });
      toast.success(
        editingCriteria ? "Đã cập nhật bộ tiêu chí" : "Đã tạo bộ tiêu chí mới",
      );
      await onSuccess();
      onClose();
    } catch (err: any) {
      toast.error("Lỗi lưu", { description: err?.response?.data?.error || err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingCriteria ? "Chỉnh sửa bộ tiêu chí" : "Tạo bộ tiêu chí mới"}
          </DialogTitle>
          <DialogDescription>
            Tiêu chí sẽ được dùng để tạo nhận xét học viên tự động qua AI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="criteria-name">Tên bộ tiêu chí</Label>
            <Input
              id="criteria-name"
              placeholder="VD: Bộ tiêu chí Coding nâng cao"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              Các nhóm tiêu chí ({sections.length})
            </h4>
            <Button type="button" variant="outline" size="sm" onClick={handleAddSection}>
              <Plus className="h-4 w-4 mr-1" />
              Thêm nhóm
            </Button>
          </div>

          <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
            {sections.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8 border border-dashed border-border rounded-lg">
                Chưa có nhóm tiêu chí nào
              </div>
            ) : (
              sections.map((section, sIdx) => (
                <Card key={sIdx} className="p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Tên nhóm tiêu chí"
                      value={section.title}
                      onChange={(e) => handleSectionTitleChange(sIdx, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSection(sIdx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 pl-2">
                    {(section.criteria || []).map((c, cIdx) => (
                      <Card key={c.id || cIdx} className="p-2 bg-muted/30 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Tiêu chí #{cIdx + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveCriteria(sIdx, cIdx)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Nhãn (hiển thị checkbox)"
                          value={c.label}
                          onChange={(e) =>
                            handleCriteriaChange(sIdx, cIdx, "label", e.target.value)
                          }
                          className="text-sm"
                        />
                        <Textarea
                          placeholder="Nội dung (hiển thị trong nhận xét)"
                          value={c.value || ""}
                          onChange={(e) =>
                            handleCriteriaChange(sIdx, cIdx, "value", e.target.value)
                          }
                          rows={2}
                          className="text-sm"
                        />
                      </Card>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddCriteria(sIdx)}
                      className="w-full"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Thêm tiêu chí
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {editingCriteria ? "Cập nhật" : "Tạo mới"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CriteriaEditor;
