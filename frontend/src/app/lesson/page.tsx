"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Lock } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { lessonService } from "@/services/lessonService";
import {
  ContentMode,
  Lesson,
  LessonContent,
  LessonFilter,
  LessonMode,
  LessonSubject,
} from "@/types/lesson";
import { LessonFilterPanel } from "./components/LessonFilterPanel";
import { LessonListPanel } from "./components/LessonListPanel";
import { LessonContentPanel } from "./components/LessonContentPanel";
import { LessonContentTable } from "./components/LessonContentTable";
import { LessonContentModal } from "./components/LessonContentModal";
import { LessonFormModal } from "./components/LessonFormModal";
import { QRCodeModal } from "./components/QRCodeModal";
import { LessonLevel } from "./components/LessonFilterPanel";

const EMPTY_FILTER: LessonFilter = { subject: "", courseCode: "", q: "" };
const LESSON_PASS = "mindxspace";
const STORAGE_KEY = "lesson_unlocked_v1";

function readUnlockedFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      return new Set(ids);
    }
  } catch {
    // ignore
  }
  return new Set();
}

export default function LessonPage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [unlockedLessons, setUnlockedLessons] = useState<Set<string>>(
    () => readUnlockedFromStorage(),
  );

  useEffect(() => {
    setIsHydrated(true);
    if (unlockedLessons.size === 0 && typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setPasswordInput("");
          setPasswordError(false);
          setPasswordModalOpen(true);
        }
      } catch {
        setPasswordInput("");
        setPasswordError(false);
        setPasswordModalOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...unlockedLessons]));
    } catch {
      // ignore quota errors
    }
  }, [unlockedLessons, isHydrated]);

  const [activeTab, setActiveTab] = useState<"list" | "content">("list");

  const [filter, setFilter] = useState<LessonFilter>(EMPTY_FILTER);
  const [level, setLevel] = useState<LessonLevel | "">("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [blocks, setBlocks] = useState<LessonContent[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [lessonFormMode, setLessonFormMode] = useState<LessonMode>("add");
  const [lessonFormInitial, setLessonFormInitial] = useState<Lesson | null>(
    null,
  );

  const [contentFormOpen, setContentFormOpen] = useState(false);
  const [contentFormMode, setContentFormMode] = useState<ContentMode>("add");
  const [contentFormInitial, setContentFormInitial] =
    useState<LessonContent | null>(null);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrLesson, setQrLesson] = useState<Lesson | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{
    kind: "lesson" | "block";
    payload: any;
  } | null>(null);

  // Password gate
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const loadLessons = useCallback(async (nextFilter: LessonFilter) => {
    setLoadingLessons(true);
    try {
      const res = await lessonService.getLessons(nextFilter);
      if (res.success) {
        setLessons(res.data || []);
      } else {
        toast.error("Không thể tải danh sách bài học", {
          description: res.error,
        });
      }
    } catch (err: any) {
      toast.error("Lỗi tải bài học", {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setLoadingLessons(false);
    }
  }, []);

  useEffect(() => {
    loadLessons(filter);
  }, [loadLessons, filter]);

  const loadBlocks = useCallback(async (lessonId: string) => {
    setLoadingBlocks(true);
    try {
      const res = await lessonService.getContentBlocks(lessonId);
      if (res.success) {
        setBlocks(res.data || []);
      } else {
        toast.error("Không thể tải nội dung", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Lỗi tải nội dung", {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setLoadingBlocks(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLesson) {
      loadBlocks(selectedLesson._id);
    } else {
      setBlocks([]);
    }
  }, [selectedLesson, loadBlocks]);

  const nextBlockIndex = useMemo(() => {
    if (blocks.length === 0) return 1;
    return Math.max(...blocks.map((b) => b.blockIndex || 0)) + 1;
  }, [blocks]);

  const filterSubject = (subject: LessonSubject | "") =>
    setFilter((f) => ({ ...f, subject }));

  const handleSearch = () => loadLessons(filter);
  const handleClearFilter = () => {
    setFilter(EMPTY_FILTER);
  };

  const handleLessonSubmit = async (values: Partial<Lesson>) => {
    try {
      if (lessonFormMode === "add") {
        const res = await lessonService.createLesson(values);
        if (res.success) {
          toast.success("Đã tạo bài học");
          setLessonFormOpen(false);
          setLessonFormInitial(null);
          await loadLessons(filter);
        } else {
          toast.error("Tạo thất bại", { description: res.error });
        }
      } else if (lessonFormInitial) {
        const res = await lessonService.updateLesson(
          lessonFormInitial._id,
          values,
        );
        if (res.success) {
          toast.success("Đã cập nhật bài học");
          setLessonFormOpen(false);
          setLessonFormInitial(null);
          await loadLessons(filter);
          if (selectedLesson?._id === lessonFormInitial._id) {
            setSelectedLesson(res.data || null);
          }
        } else {
          toast.error("Cập nhật thất bại", { description: res.error });
        }
      }
    } catch (err: any) {
      toast.error("Lỗi lưu bài học", {
        description: err.response?.data?.error || err.message,
      });
    }
  };

  const handleContentSubmit = async (values: Partial<LessonContent>) => {
    try {
      if (contentFormMode === "add") {
        const res = await lessonService.addContentBlock(
          values.lessonId!,
          values,
        );
        if (res.success) {
          toast.success("Đã thêm khối nội dung");
          setContentFormOpen(false);
          setContentFormInitial(null);
          if (selectedLesson?._id === values.lessonId) {
            await loadBlocks(values.lessonId!);
          }
        } else {
          toast.error("Thêm thất bại", { description: res.error });
        }
      } else if (contentFormInitial) {
        const res = await lessonService.updateContentBlock(
          contentFormInitial._id,
          values,
        );
        if (res.success) {
          toast.success("Đã cập nhật khối nội dung");
          setContentFormOpen(false);
          setContentFormInitial(null);
          if (selectedLesson) {
            await loadBlocks(selectedLesson._id);
          }
        } else {
          toast.error("Cập nhật thất bại", { description: res.error });
        }
      }
    } catch (err: any) {
      toast.error("Lỗi lưu khối nội dung", {
        description: err.response?.data?.error || err.message,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { kind, payload } = confirmDelete;
    setConfirmDelete(null);
    try {
      if (kind === "lesson") {
        const res = await lessonService.deleteLesson(payload._id);
        if (res.success) {
          toast.success("Đã xóa bài học");
          if (selectedLesson?._id === payload._id) {
            setSelectedLesson(null);
            setBlocks([]);
          }
          await loadLessons(filter);
        } else {
          toast.error("Xóa thất bại", { description: res.error });
        }
      } else if (kind === "block") {
        const res = await lessonService.deleteContentBlock(payload._id);
        if (res.success) {
          toast.success("Đã xóa khối nội dung");
          if (selectedLesson) {
            await loadBlocks(selectedLesson._id);
          }
        } else {
          toast.error("Xóa thất bại", { description: res.error });
        }
      }
    } catch (err: any) {
      toast.error("Lỗi xóa", {
        description: err.response?.data?.error || err.message,
      });
    }
  };

  const handlePasswordSubmit = () => {
    if (passwordInput.trim().toLowerCase() === LESSON_PASS.toLowerCase()) {
      if (selectedLesson) {
        setUnlockedLessons((prev) => new Set([...prev, selectedLesson._id]));
      }
      setPasswordModalOpen(false);
      setPasswordInput("");
      setActiveTab("content");
    } else {
      setPasswordError(true);
    }
  };

  const handleGateSubmit = () => {
    if (passwordInput.trim().toLowerCase() === LESSON_PASS.toLowerCase()) {
      setUnlockedLessons(new Set(["__global__"]));
      setPasswordInput("");
      setPasswordError(false);
      setPasswordModalOpen(false);
    } else {
      setPasswordError(true);
    }
  };

  const isLocked = unlockedLessons.size === 0;

  const mainContent = (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "list" | "content")}
    >
      <TabsList>
        <TabsTrigger value="list">Danh sách bài học</TabsTrigger>
        <TabsTrigger value="content">Nội dung bài học</TabsTrigger>
      </TabsList>

      <TabsContent value="list">
        <Card className="p-4 mb-4">
          <LessonFilterPanel
            subject={filter.subject || ""}
            level={level}
            query={filter.q || ""}
            onSubjectChange={filterSubject}
            onLevelChange={(v) => {
              setLevel(v);
              setFilter((f) => ({ ...f, courseCode: v }));
            }}
            onQueryChange={(v) => setFilter((f) => ({ ...f, q: v }))}
            onSearch={handleSearch}
            onClear={() => {
              setLevel("");
              handleClearFilter();
            }}
            onRefresh={() => loadLessons(filter)}
            loading={loadingLessons}
          />
        </Card>
        <LessonListPanel
          lessons={lessons}
          loading={loadingLessons}
          selectedId={selectedLesson?._id}
          onSelect={(l) => {
            if (!unlockedLessons.has(l._id)) {
              setSelectedLesson(l);
              setPasswordInput("");
              setPasswordError(false);
              setPasswordModalOpen(true);
              return;
            }
            setSelectedLesson(l);
            setActiveTab("content");
          }}
          onEdit={(l) => {
            setLessonFormMode("edit");
            setLessonFormInitial(l);
            setLessonFormOpen(true);
          }}
          onDelete={(l) => setConfirmDelete({ kind: "lesson", payload: l })}
          onShowQR={(l) => {
            setQrLesson(l);
            setQrOpen(true);
          }}
          onCreate={() => {
            setLessonFormMode("add");
            setLessonFormInitial(null);
            setLessonFormOpen(true);
          }}
        />
      </TabsContent>

      <TabsContent value="content">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <Card className="p-4 mb-4">
              <LessonFilterPanel
                subject={filter.subject || ""}
                level={level}
                query={filter.q || ""}
                onSubjectChange={filterSubject}
                onLevelChange={(v) => {
                  setLevel(v);
                  setFilter((f) => ({ ...f, courseCode: v }));
                }}
                onQueryChange={(v) => setFilter((f) => ({ ...f, q: v }))}
                onSearch={handleSearch}
                onClear={() => {
                  setLevel("");
                  handleClearFilter();
                }}
                onRefresh={() => loadLessons(filter)}
                loading={loadingLessons}
              />
            </Card>
            <LessonContentTable
              data={blocks}
              loading={loadingBlocks}
              onEdit={(b) => {
                setContentFormMode("edit");
                setContentFormInitial(b);
                setContentFormOpen(true);
              }}
              onDelete={(b) => setConfirmDelete({ kind: "block", payload: b })}
            />
          </div>
          <div className="lg:col-span-5">
            <LessonContentPanel
              lesson={selectedLesson}
              blocks={blocks}
              loading={loadingBlocks}
              onAddBlock={() => {
                if (!selectedLesson) {
                  toast.warning("Chọn bài học trước");
                  setActiveTab("list");
                  return;
                }
                setContentFormMode("add");
                setContentFormInitial(null);
                setContentFormOpen(true);
              }}
              onEditBlock={(b) => {
                setContentFormMode("edit");
                setContentFormInitial(b);
                setContentFormOpen(true);
              }}
              onDeleteBlock={(b) =>
                setConfirmDelete({ kind: "block", payload: b })
              }
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );

  const dialogs = (
    <>
      <LessonFormModal
        open={lessonFormOpen}
        mode={lessonFormMode}
        initialValues={lessonFormInitial}
        onClose={() => {
          setLessonFormOpen(false);
          setLessonFormInitial(null);
        }}
        onSubmit={handleLessonSubmit}
      />

      <LessonContentModal
        open={contentFormOpen}
        mode={contentFormMode}
        initialValues={contentFormInitial}
        defaultLessonId={selectedLesson?._id}
        nextBlockIndex={nextBlockIndex}
        onClose={() => {
          setContentFormOpen(false);
          setContentFormInitial(null);
        }}
        onSubmit={handleContentSubmit}
      />

      <QRCodeModal
        open={qrOpen}
        lessonId={qrLesson?._id || null}
        lessonTitle={qrLesson?.title}
        onClose={() => setQrOpen(false)}
      />

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>
              {confirmDelete?.kind === "lesson"
                ? "Bạn có chắc muốn xóa bài học này? Tất cả khối nội dung thuộc bài học sẽ bị xóa."
                : "Bạn có chắc muốn xóa khối nội dung này?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordModalOpen}
        onOpenChange={(o) => {
          if (!o) {
            setPasswordModalOpen(false);
            setPasswordInput("");
            setPasswordError(false);
            if (isLocked) {
              setSelectedLesson(null);
            }
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nhập mật khẩu</DialogTitle>
            <DialogDescription>
              Vui lòng nhập mật khẩu để xem nội dung bài học "
              {selectedLesson?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Mật khẩu Wifi của MindX"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (isLocked) {
                    handleGateSubmit();
                  } else {
                    handlePasswordSubmit();
                  }
                }
              }}
              autoFocus
            />
            {passwordError && (
              <p className="text-xs text-red-500">
                Mật khẩu không đúng. Vui lòng thử lại.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPasswordModalOpen(false);
                setPasswordInput("");
                setPasswordError(false);
                setSelectedLesson(null);
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={() => {
                if (isLocked) {
                  handleGateSubmit();
                } else {
                  handlePasswordSubmit();
                }
              }}
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          <span className="text-sm">Đang tải...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-4 relative">
      <div
        className={
          isLocked ? "pointer-events-none select-none filter blur-sm" : ""
        }
      >
        {mainContent}
      </div>

      {isLocked && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center cursor-pointer"
          onClick={() => {
            setPasswordInput("");
            setPasswordError(false);
            setPasswordModalOpen(true);
          }}
        >
          <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-lg px-6 py-4 flex items-center gap-3 hover:bg-white transition">
            <Lock className="h-5 w-5 text-slate-700" />
            <span className="text-sm font-medium text-slate-700">
              Nhấn để nhập mật khẩu xem nội dung
            </span>
          </div>
        </div>
      )}

      {dialogs}
    </main>
  );
}
