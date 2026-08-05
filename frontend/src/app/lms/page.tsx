"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/toast";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { lmsService } from "@/services/lmsService";
import {
  LMS_SUBJECTS,
  type LmsClassSummary,
  type LmsCriteriaSection,
  type LmsCriteriaTemplate,
  type LmsStudent,
  type LmsSubject,
  filterClassesBySubject,
  resolveSubjectFromClass,
  sortClassesByName,
} from "@/types/lms";

import { ClassStudentSelector } from "./components/ClassStudentSelector";
import { CriteriaPanel } from "./components/CriteriaPanel";
import { CriteriaSelector } from "./components/CriteriaSelector";
import { CriteriaManager } from "./components/CriteriaManager";
import { CriteriaEditor } from "./components/CriteriaEditor";
import { PreviewPanel } from "./components/PreviewPanel";

export default function LmsPage() {
  const [subject, setSubject] = useState<LmsSubject>("coding");
  const [classId, setClassId] = useState<string>("");
  const [classList, setClassList] = useState<LmsClassSummary[]>([]);
  const [studentList, setStudentList] = useState<LmsStudent[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedSessionNumber, setSelectedSessionNumber] = useState<number>(1);

  const [criteriaList, setCriteriaList] = useState<LmsCriteriaTemplate[]>([]);
  const [selectedCriteriaId, setSelectedCriteriaId] = useState<string>("");
  const [checked, setChecked] = useState<Record<string, string[]>>({});
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const [preview, setPreview] = useState<string>("");

  const [syncing, setSyncing] = useState(false);
  const [loadingCriteria, setLoadingCriteria] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const [managerOpen, setManagerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCriteria, setEditingCriteria] =
    useState<LmsCriteriaTemplate | null>(null);

  // Load criteria when subject changes
  const loadCriteria = useCallback(async () => {
    setLoadingCriteria(true);
    try {
      const list = await lmsService.getCriteria(subject);
      setCriteriaList(list);
      setSelectedCriteriaId((current) => {
        if (current && list.find((c) => c._id === current)) return current;
        return list[0]?._id || "";
      });
    } catch (err: any) {
      const message =
        err?.response?.data?.error || err?.message || "Không thể tải tiêu chí";
      toast.error(message);
      setCriteriaList([]);
      setSelectedCriteriaId("");
    } finally {
      setLoadingCriteria(false);
    }
  }, [subject]);

  useEffect(() => {
    loadCriteria();
  }, [loadCriteria]);

  // Load classes from Mongo (cached LMS data) on mount
  const loadClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const list = await lmsService.getClasses({ status: "RUNNING" });
      setClassList(list);
    } catch (err: any) {
      const message =
        err?.response?.data?.error || err?.message || "Không thể tải danh sách lớp";
      toast.error(message);
      setClassList([]);
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // Compute selected helpers
  const selectedTemplate = useMemo(
    () => criteriaList.find((c) => c._id === selectedCriteriaId) || null,
    [criteriaList, selectedCriteriaId],
  );

  const selectedClass = useMemo(
    () => classList.find((c) => c.id === selectedClassId) || null,
    [classList, selectedClassId],
  );

  // Filter dropdown options by the active subject tab. Classes whose subject
  // cannot be resolved (unknown / null / "") are always kept so users are
  // never silently hidden from the list. Sort alphabetically by name
  // (natural ordering — "Lớp 2" before "Lớp 10").
  const filteredClassList = useMemo(
    () => sortClassesByName(filterClassesBySubject(classList, subject)),
    [classList, subject],
  );

  // If the currently selected class no longer matches the active subject tab
  // (e.g. user just switched tabs), clear the selection rather than letting
  // the Lớp / Student / Session dropdowns show a phantom value.
  useEffect(() => {
    if (!selectedClassId) return;
    if (filteredClassList.some((c) => c.id === selectedClassId)) return;
    setSelectedClassId("");
    setClassId("");
    setSelectedStudentId("");
    setStudentList([]);
  }, [filteredClassList, selectedClassId]);

  const selectedStudent = useMemo(
    () => studentList.find((s) => s.id === selectedStudentId) || null,
    [studentList, selectedStudentId],
  );

  const handleSyncClass = useCallback(async () => {
    const targetClassId = classId.trim() || selectedClassId;
    if (!targetClassId) {
      toast.warning("Vui lòng nhập class ID.");
      return;
    }
    setSyncing(true);
    try {
      const res = await lmsService.syncClass({ classId: targetClassId });
      const { class: cls, students } = res.data;
      const classSummary: LmsClassSummary = {
        id: cls.id,
        name: cls.name,
        status: cls.status,
        course: cls.course,
        centre: cls.centre,
      };
      setClassList((prev) => {
        const existing = prev.find((c) => c.id === cls.id);
        if (existing) {
          return prev.map((c) => (c.id === cls.id ? { ...c, ...classSummary } : c));
        }
        return [...prev, classSummary];
      });
      setStudentList(students);
      setSelectedClassId(cls.id);
      setSelectedStudentId((current) => current || students[0]?.id || "");
      setClassId(cls.id);
      toast.success(`Đã đồng bộ lớp "${cls.name}" (${students.length} học sinh).`);
    } catch (err: any) {
      const message =
        err?.response?.data?.error || err?.message || "Đồng bộ thất bại";
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  }, [classId, selectedClassId]);

  const handleClassChange = useCallback(
    async (nextId: string) => {
      const isNewClass = nextId && nextId !== selectedClassId;
      setSelectedClassId(nextId);
      setSelectedStudentId("");
      setClassId(nextId);
      if (!nextId || !isNewClass) return;

      // Auto-switch the "Môn học" tab to match the selected class.
      // Only switches when subject can be recognized; otherwise keeps the
      // current tab unchanged.
      const matchedClass = classList.find((c) => c.id === nextId);
      const nextSubject = resolveSubjectFromClass(matchedClass?.subject);
      if (nextSubject) {
        setSubject(nextSubject);
      }

      setSyncing(true);
      try {
        const res = await lmsService.syncClass({ classId: nextId });
        const { students } = res.data;
        setStudentList(students);
        setSelectedStudentId(students[0]?.id || "");
      } catch (err: any) {
        const message =
          err?.response?.data?.error || err?.message || "Tải học sinh thất bại";
        toast.error(message);
      } finally {
        setSyncing(false);
      }
    },
    [selectedClassId, classList],
  );

  const handleCollapse = useCallback((group: string) => {
    setOpenGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );
  }, []);

  // Build preview text from checked criteria — mirrors subproject LmsPage logic:
  //   sectionTitle
  //   - criterion.value (or label if value missing)
  //   - ...
  // Skips empty groups; preserves `criteriaSections` lookup order.
  const buildPreviewFromChecked = (
    sections: LmsCriteriaSection[],
    nextChecked: Record<string, string[]>,
  ): string => {
    const blocks: string[] = [];
    sections.forEach((section) => {
      const labels = nextChecked[section.title] || [];
      if (!labels.length) return;
      const lines = labels.map((label) => {
        const c = section.criteria.find((x) => x.label === label);
        let text = c?.value?.trim() || label;
        text = text.replace(/\bhọc viên\b/gi, shortName);
        return `- ${text}`;
      });
      blocks.push(`${section.title}\n${lines.join("\n")}`);
    });
    const body = blocks.join("\n\n").trim();
    if (!body) return "";
    return `Ở buổi ${selectedSessionNumber}:\n${body}`;
  };

  const shortName = useMemo(() => {
    if (!selectedStudent) return "học viên";
    const full = (selectedStudent.fullName || selectedStudent.username || "").trim();
    if (!full) return "học viên";
    const parts = full.split(/\s+/);
    return parts[parts.length - 1];
  }, [selectedStudent]);

  const handleCheck = useCallback(
    (group: string, values: string[]) => {
      setChecked((prev) => {
        const next = { ...prev, [group]: values };
        if (selectedTemplate) {
          setPreview(buildPreviewFromChecked(selectedTemplate.sections, next));
        }
        return next;
      });
    },
    [selectedTemplate],
  );

  // Rebuild preview whenever student or session changes (so the header line
  // "Ở buổi X:" stays in sync, and any inline "học viên" gets re-replaced with
  // the new student's short name).
  useEffect(() => {
    if (!selectedTemplate) return;
    setPreview(buildPreviewFromChecked(selectedTemplate.sections, checked));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortName, selectedSessionNumber]);

  // Reset checked state when criteria/template changes
  useEffect(() => {
    if (!selectedTemplate) {
      setChecked({});
      setOpenGroups([]);
      setPreview("");
      return;
    }
    setOpenGroups([]);
    setChecked({});
    setPreview("");
  }, [selectedTemplate]);

  const handleManageCriteria = useCallback(() => {
    setManagerOpen(true);
  }, []);

  const handleCreateCriteria = useCallback(() => {
    setEditingCriteria(null);
    setManagerOpen(false);
    setEditorOpen(true);
  }, []);

  const handleEditCriteria = useCallback((template: LmsCriteriaTemplate) => {
    setEditingCriteria(template);
    setManagerOpen(false);
    setEditorOpen(true);
  }, []);

  const handleEditorSaved = useCallback(async () => {
    await loadCriteria();
  }, [loadCriteria]);

  const subjects = useMemo(() => LMS_SUBJECTS, []);

  const mainContent = (
    <>
      <ClassStudentSelector
        classList={filteredClassList}
        studentList={studentList}
        selectedClassId={selectedClassId}
        selectedStudentId={selectedStudentId}
        selectedSessionNumber={selectedSessionNumber}
        onClassChange={handleClassChange}
        onStudentChange={setSelectedStudentId}
        onSessionChange={setSelectedSessionNumber}
        loading={syncing}
        onSyncClass={handleSyncClass}
        syncing={syncing}
        subject={subject}
        subjects={subjects}
        onSubjectChange={(s) => setSubject(s as LmsSubject)}
        loadingClasses={loadingClasses}
        onRefreshClasses={() => loadClasses()}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-5 p-4 space-y-4">
          {loadingCriteria ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <CriteriaPanel
              sections={selectedTemplate?.sections || []}
              checked={checked}
              openGroups={openGroups}
              onCheck={handleCheck}
              onCollapse={handleCollapse}
            />
          )}
        </Card>

        <Card className="lg:col-span-7 p-4 flex flex-col gap-4 min-h-0">
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Preview comment
            </h2>
          </header>

          <PreviewPanel preview={preview} onChange={setPreview} />
        </Card>
      </div>
    </>
  );

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-4">
      {mainContent}

      <CriteriaManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        criteriaList={criteriaList}
        currentSubject={subject}
        onRefresh={loadCriteria}
        onEdit={handleEditCriteria}
        onCreate={handleCreateCriteria}
      />
      <CriteriaEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSuccess={handleEditorSaved}
        currentSubject={subject}
        editingCriteria={editingCriteria}
      />
    </main>
  );
}
