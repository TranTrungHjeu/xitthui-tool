"use client";

import { Loader2, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { LmsClassSummary, LmsStudent, LmsSubjectOption } from "@/types/lms";
import { SubjectTabs } from "./SubjectTabs";

interface ClassStudentSelectorProps {
  readonly classList: LmsClassSummary[];
  readonly studentList: LmsStudent[];
  readonly selectedClassId: string;
  readonly selectedStudentId: string;
  readonly selectedSessionNumber: number;
  readonly onClassChange: (classId: string) => void;
  readonly onStudentChange: (studentId: string) => void;
  readonly onSessionChange: (session: number) => void;
  readonly loading?: boolean;
  readonly onSyncClass?: () => void;
  readonly syncing?: boolean;
  readonly subject: string;
  readonly subjects: readonly LmsSubjectOption[];
  readonly onSubjectChange: (subject: string) => void;
  readonly loadingClasses: boolean;
  readonly onRefreshClasses: () => void;
}

const SESSION_OPTIONS = Array.from({ length: 14 }, (_, i) => ({
  value: String(i + 1),
  label: `Buổi ${i + 1}`,
}));

export function ClassStudentSelector({
  classList,
  studentList,
  selectedClassId,
  selectedStudentId,
  selectedSessionNumber,
  onClassChange,
  onStudentChange,
  onSessionChange,
  loading = false,
  onSyncClass,
  syncing = false,
  subject,
  subjects,
  onSubjectChange,
  loadingClasses,
  onRefreshClasses,
}: ClassStudentSelectorProps) {
  return (
    <Card className="p-4 shadow-sm w-fit mx-auto">
      {/* Single-row workflow bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Subject */}
        <div className="flex items-center gap-2 lg:flex-shrink-0">
          <SubjectTabs
            selectedSubject={subject}
            onChange={onSubjectChange}
            subjects={subjects as LmsSubjectOption[]}
          />
        </div>

        <Separator
          orientation="vertical"
          className="hidden lg:block h-10 mx-1"
        />

        {/* Class / Student / Session */}
        <div className="flex items-center gap-3">
          <Select value={selectedClassId} onValueChange={onClassChange} disabled={loading}>
            <SelectTrigger className="w-[180px] lg:w-[220px]">
              <SelectValue placeholder="Chọn lớp học..." />
            </SelectTrigger>
            <SelectContent>
              {classList.length === 0 && !loading && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Chưa có lớp nào
                </div>
              )}
              {classList.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedStudentId}
            onValueChange={onStudentChange}
            disabled={!selectedClassId || studentList.length === 0 || loading}
          >
            <SelectTrigger className="w-[180px] lg:w-[220px]">
              <SelectValue placeholder="Chọn học sinh..." />
            </SelectTrigger>
            <SelectContent>
              {studentList.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {selectedClassId ? "Lớp chưa có học sinh" : "Chọn lớp trước"}
                </div>
              )}
              {studentList.map((stu) => (
                <SelectItem key={stu.id} value={stu.id}>
                  {stu.fullName || stu.username || stu.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedSessionNumber)}
            onValueChange={(v) => onSessionChange(Number(v))}
            disabled={!selectedClassId}
          >
            <SelectTrigger className="w-[180px] lg:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator
          orientation="vertical"
          className="hidden lg:block h-10 mx-1"
        />

        {/* Actions */}
        <div className="flex items-center gap-2 lg:flex-shrink-0">
          {onSyncClass && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onSyncClass}
              disabled={syncing || !selectedClassId}
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>Đồng bộ LMS</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefreshClasses}
            disabled={loadingClasses}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default ClassStudentSelector;
