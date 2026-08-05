"use client";

import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

type LessonItem = {
  id: string;
  title?: string;
  name?: string;
  content?: string;
  slide?: string;
  summary?: string;
};

interface LessonContentPanelProps {
  lessons: LessonItem[];
  selectedLessonId: string | null;
  selectedLesson?: LessonItem | null;
  onSelectLesson: (id: string) => void;
  isMobile?: boolean;
}

export default function LessonContentPanel({
  lessons,
  selectedLessonId,
  selectedLesson,
  onSelectLesson,
  isMobile = false,
}: LessonContentPanelProps) {
  // Ưu tiên lookup theo selectedLessonId từ danh sách (reactive với user click),
  // fallback selectedLesson prop (từ backend auto-select ban đầu) chỉ khi chưa có selection
  const active =
    lessons.find((l) => String(l.id) === selectedLessonId) ||
    selectedLesson ||
    lessons[0] ||
    null;

  if (lessons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full mindx-badge-sunglow mb-2">
          <Sparkles className="h-5 w-5" />
        </span>
        <p className="text-xs font-semibold text-brand-60">Chưa có dữ li dung bài học</p>
        <p className="text-[10px] mt-1 text-brand-60/60">
          Không tìm thấy nội dung cho môn học này
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Lesson list (compact) — Crimson brand 10% */}
      <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1 -mr-1">
        {lessons.map((lesson) => {
          const isSelected = String(lesson.id) === selectedLessonId;
          const title = lesson.title || lesson.name || `Buổi ${lesson.id}`;
          return (
            <button
              key={lesson.id}
              type="button"
              onClick={() => onSelectLesson(String(lesson.id))}
              className={`w-full text-left px-2.5 py-2 rounded-md text-xs font-medium border transition-colors ${
                isSelected
                  ? "mindx-badge-crimson shadow-[0_1px_4px_-1px_rgba(227,31,38,0.25)]"
                  : "border-transparent text-brand-60 hover:bg-brand-60-soft hover:text-brand-60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{title}</span>
                {isSelected && (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active lesson content preview */}
      {active && (
        <div className="space-y-2 pt-3 border-t-2 border-brand-30/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-brand-60">
              {active.title || active.name || `Buổi ${active.id}`}
            </span>
          </div>

          {active.content && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-brand-60/70 font-semibold">
                Nội dung
              </span>
              <div className="text-xs text-brand-60 whitespace-pre-wrap rounded-md bg-brand-60-soft/70 p-2 border border-brand-60/15 max-h-[140px] overflow-y-auto">
                {active.content}
              </div>
            </div>
          )}

          {active.slide && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-brand-60/70 font-semibold">
                Slide
              </span>
              <div className="text-xs text-brand-60 dark:text-indigo-300 break-all rounded-md mindx-badge-stratos p-2 font-mono">
                {active.slide}
              </div>
            </div>
          )}

          {active.summary && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-brand-30 font-bold">
                Tóm tắt
              </span>
              <div className="text-xs text-brand-60 whitespace-pre-wrap rounded-md mindx-badge-sunglow p-2 max-h-[100px] overflow-y-auto">
                {active.summary}
              </div>
            </div>
          )}

          {!active.content && !active.slide && !active.summary && (
            <div className="text-xs text-brand-60/60 italic text-center py-3">
              Buổi này chưa có nội dung
            </div>
          )}
        </div>
      )}
    </div>
  );
}