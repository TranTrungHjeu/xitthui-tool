"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api from "@/services/api";
import InstructionModal from "./components/InstructionModal";
import PreviewModal from "./components/PreviewModal";
import ActionButtons from "./components/ActionButtons";
import LessonContentPanel from "./components/LessonContentPanel";
import SubjectTabs from "./components/SubjectTabs";
import { copyWithFormatting } from "@/lib/zalo-format";
import {
  LMS_SUBJECTS,
  resolveSubjectFromClass,
  type LmsSubject,
} from "@/types/lms";
import {
  Eye,
  Loader2,
  Wand2,
  RefreshCw,
  Users,
  Clock,
  PencilLine,
} from "lucide-react";

// Fallback template khi backend không trả về hoặc template rỗng.
// Giữ định dạng Zalo tương thích với zalo-format: ***T***, **T**, *T*, 'Compass'
const DEFAULT_ZALO_TEMPLATE = `**@All, Kính gửi quý phụ huynh, em xin phép gửi phụ huynh về TỔNG KẾT NỘI DUNG BUỔI SỐ x/14**

Thời gian:
Sĩ số:

**1. Nội dung buổi học:**
-

**2. Nhận xét chung:**
-

**3. Nhận xét chi tiết:**
Quý phụ huynh có thể truy cập *'Học bạ trực tuyến - Compass'* để có thể xem nhận xét chi tiết của các bạn ạ.

**4. Quan trọng:**
- Video bài học:
- Tóm tắt bài học:
- Slide bài giảng:

**5. Dặn dò**
- *Làm BTVN trên hệ thống denise trước hh:mm ngày DD/mm/yyyy.*

*Em xin phép nhờ quý phụ huynh nhắc nhở các bạn làm BTVN giúp em!*

*Em cảm ơn quý phụ huynh đã quan tâm đến tình hình học tập của các bạn ạ.*`;

const RUNNING_STATUSES = [
  "RUNNING",
  "IN_PROGRESS",
  "ĐANG_DIỄN_RA",
  "OPEN",
  "PRE_OPEN",
  "PREPARING",
  "PENDING",
];

type ClassSlot = {
  index?: number;
  sessionIndex?: number;
  date?: string;
  startTime?: string;
  endTime?: string;
};

type ClassItem = {
  id: string;
  name: string;
  status?: string;
  centre?: { id?: string; name?: string; shortName?: string };
  course?: { id?: string; name?: string; shortName?: string } | null;
  subject?: string | null;
  slots?: ClassSlot[];
  totalSlot?: number;
};

type LatestSlotInfo = {
  index: number;
  date: string;
  startTime?: string;
  endTime?: string;
};

type LessonItem = {
  id: string;
  title?: string;
  name?: string;
  content?: string;
  slide?: string;
  summary?: string;
  generalComment?: string;
  comment?: string;
  note?: string;
  overall?: string;
};

type LessonPayload = {
  subjectId: string | null;
  levelId: string | null;
  subjectName: string | null;
  levelName: string | null;
  lessons: LessonItem[];
  selectedLesson: LessonItem | null;
};

const parseSlotDate = (raw?: string): Date | null => {
  if (!raw) return null;
  if (raw.includes("/")) {
    const parts = raw.split("/");
    if (parts.length < 3) return null;
    const dd = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10) - 1;
    const yyyy = parseInt(parts[2], 10);
    const d = new Date(yyyy, mm, dd);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

// Trả về slot có date gần nhất tính đến hiện tại (kết thúc trước hoặc trong hôm nay).
// Nếu chưa có slot nào trong quá khứ, lấy slot sớm nhất trong tương lai (fallback).
const pickLatestSlot = (slots?: ClassSlot[]): LatestSlotInfo | null => {
  if (!Array.isArray(slots) || slots.length === 0) return null;
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  let pastBest: { date: Date; slot: ClassSlot } | null = null;
  let futureBest: { date: Date; slot: ClassSlot } | null = null;

  for (const s of slots) {
    const d = parseSlotDate(s.date);
    if (!d) continue;
    if (d <= now) {
      if (!pastBest || d > pastBest.date) pastBest = { date: d, slot: s };
    } else {
      if (!futureBest || d < futureBest.date) futureBest = { date: d, slot: s };
    }
  }

  const chosen = pastBest?.slot ?? futureBest?.slot;
  if (!chosen) return null;
  const idx =
    chosen.index !== undefined ? chosen.index : (chosen.sessionIndex ?? 0);
  return {
    index: idx,
    date: chosen.date || "",
    startTime: chosen.startTime,
    endTime: chosen.endTime,
  };
};

const formatDateVi = (raw?: string): string => {
  const d = parseSlotDate(raw);
  if (!d) return raw || "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// Parse chuỗi thời gian - hỗ trợ nhiều định dạng:
// - ISO datetime đầy đủ: "2026-08-02T09:00:00.000Z" -> "09:00"
// - HH:mm đã sẵn: "09:00" -> "09:00"
// - HH:mm:ss -> "09:00"
// - "09h00" / "9h" -> "09:00"
const formatTimeHHmm = (raw?: string): string => {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";

  // Đã đúng định dạng HH:mm
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":");
    return `${h.padStart(2, "0")}:${m}`;
  }

  // HH:mm:ss
  if (/^\d{1,2}:\d{2}:\d{2}/.test(s)) {
    const [h, m] = s.split(":");
    return `${h.padStart(2, "0")}:${m}`;
  }

  // ISO datetime -> lấy phần HH:mm theo giờ Việt Nam (UTC+7)
  // Backend build Date với timezone +07:00 rồi toISOString() -> UTC.
  // Phải convert sang Asia/Ho_Chi_Minh để hiển thị đúng giờ VN.
  if (s.includes("T")) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(d);
      const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
      const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
      return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
    }
  }

  // "9h", "9h30", "09h00"
  const hMatch = s.match(/^(\d{1,2})h(\d{0,2})$/i);
  if (hMatch) {
    const h = hMatch[1].padStart(2, "0");
    const m = (hMatch[2] || "00").padStart(2, "0");
    return `${h}:${m}`;
  }

  return s;
};

// Nhận diện môn học dựa trên mã lớp trong tên (chính xác hơn keyword-match).
//  Tên lớp MindX đặt theo pattern "TDM-{MÃMÔN}{MÃLỚP}", ví dụ:
//    - TDM-C4K-, TDM-CSB-, TDM-JSB-, TDM-JSI-  → Coding
//    - TDM-ROB-, TDM-SEMI, TDM-PRE, TDM-ARM    → Robotic
//    - TDM-XART-, TDM-VCI, TDM-VAI, TDM-VAA    → Art
//  Trả null nếu không match — caller fallback sang resolveSubjectFromClass.
const SUBJECT_CODE_PATTERNS: ReadonlyArray<readonly [LmsSubject, RegExp]> = [
  ["art", /(^|-)(xart|vci|vai|vaa|art)(-|v\d|\d|$)/i],
  ["coding", /(^|-)(c4k|csb|jsb|jsi|js|csb|code|coding|py|sc|wb)(-|v\d|\d|$)/i],
  ["robotic", /(^|-)(rob|semi|pre|arm|leg|mec|ard|rbt|rob)(-|v\d|\d|$)/i],
];
function resolveSubjectFromClassName(
  raw: string | null | undefined,
): LmsSubject | null {
  if (!raw) return null;
  for (const [subj, re] of SUBJECT_CODE_PATTERNS) {
    if (re.test(raw)) return subj;
  }
  return null;
}

export default function ZaloPage() {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [intructionModalOpen, setIntructionModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error" | "info" | "warning";
    text: string;
  } | null>(null);

  const [runningClasses, setRunningClasses] = useState<ClassItem[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Lesson content (auto-load theo lớp đang chọn)
  const [lessonData, setLessonData] = useState<LessonPayload | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [latestSessionIndex, setLatestSessionIndex] = useState<number>(0);

  // Filter môn học (giống /lms): mặc định "all" để không ẩn lớp chưa resolve được
  const [subjectFilter, setSubjectFilter] = useState<LmsSubject | "all">("all");

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      setIsTablet(w >= 768 && w < 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Luôn lấy danh sách lớp từ MongoDB - không cần auth
    loadRunningClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (
    type: "success" | "error" | "info" | "warning",
    text: string,
  ) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const res: any = await api.get("/zalo/template");
      const fromServer = res?.data?.template ?? res?.template;
      setComment(fromServer || DEFAULT_ZALO_TEMPLATE);
    } catch {
      // Backend không trả về → dùng template mặc định để người dùng vẫn dùng được
      setComment(DEFAULT_ZALO_TEMPLATE);
    } finally {
      setLoading(false);
    }
  };

  const loadRunningClasses = async () => {
    setClassesLoading(true);
    try {
      // Gọi trực tiếp MongoDB (không cần auth, không gọi LMS).
      // Endpoint: GET /zalo/running-classes
      const res: any = await api.get("/zalo/running-classes");
      const list: ClassItem[] = res?.data?.data || res?.data || [];
      // Backend đã trả về currentSessionIndex + latestSlot - không cần tự suy ra từ slots.
      // Vẫn giữ slots để fallback nếu backend trả thiếu.
      setRunningClasses(
        list.map((c: any) => ({
          ...c,
          id: c.id || c._id,
          slots: c.slots || [],
        })),
      );
    } catch (err: any) {
      console.error("[Zalo] loadRunningClasses failed:", err);
      showToast(
        "warning",
        "Không tải được danh sách lớp. Bạn vẫn có thể dùng mẫu nhận xét.",
      );
      setRunningClasses([]);
    } finally {
      setClassesLoading(false);
    }
  };

  const loadLessonContent = async (classId: string, sessionIndex?: number) => {
    setLessonLoading(true);
    try {
      const url = new URL("/zalo/lesson-for-class", window.location.origin);
      url.searchParams.set("classId", classId);
      if (sessionIndex && sessionIndex > 0) {
        url.searchParams.set("session", String(sessionIndex));
      }
      const res: any = await api.get(url.pathname + url.search);
      const data: LessonPayload = res?.data?.data || null;
      setLessonData(data);
      if (data?.selectedLesson?.id) {
        setSelectedLessonId(String(data.selectedLesson.id));
      } else if (data?.lessons?.length) {
        // Auto-select theo sessionIndex nếu backend không trả selectedLesson
        if (sessionIndex && sessionIndex > 0) {
          const match = data.lessons.find(
            (l) => String(l.id) === String(sessionIndex),
          );
          setSelectedLessonId(
            match ? String(match.id) : String(data.lessons[0].id),
          );
        } else {
          setSelectedLessonId(String(data.lessons[0].id));
        }
      } else {
        setSelectedLessonId(null);
      }
    } catch (err: any) {
      console.error("[Zalo] loadLessonContent failed:", err);
      setLessonData(null);
      setSelectedLessonId(null);
    } finally {
      setLessonLoading(false);
    }
  };

  const handleResetTemplate = () => {
    setComment(DEFAULT_ZALO_TEMPLATE);
    setSelectedClassId(null);
    setLessonData(null);
    setSelectedLessonId(null);
  };

  const applyClassToTemplate = (cls: ClassItem, latest: LatestSlotInfo) => {
    const total = (cls as any).totalSlot ?? 14;
    const idx = latest.index > 0 ? latest.index : 1;

    // Thay "BUỔI SỐ x/14" hoặc "BUỔI SỐ 5/14" -> "BUỔI SỐ idx/total"
    // Hỗ trợ cả khi x là chữ (placeholder mặc định) lẫn số đã điền trước đó.
    let next = comment || DEFAULT_ZALO_TEMPLATE;
    next = next.replace(/(BUỔI SỐ\s+)[xX\d]+\s*\/\s*\d+/i, `$1${idx}/${total}`);

    // Thời gian: hh:mm - hh:mm (an toàn với ISO datetime hoặc "HH:mm")
    if (latest.startTime && latest.endTime) {
      const st = formatTimeHHmm(latest.startTime);
      const et = formatTimeHHmm(latest.endTime);
      if (st && et) {
        next = next.replace(/(Thời gian:\s*).*/, `$1${st} - ${et}`);
      }
    }

    // Sĩ số: nếu có studentCount
    const studentCount =
      (cls as any).studentCount ??
      (Array.isArray((cls as any).students)
        ? (cls as any).students.length
        : null);
    if (typeof studentCount === "number" && studentCount > 0) {
      next = next.replace(/(Sĩ số:\s*).*/, `$1${studentCount}`);
    }

    setComment(next);
    setSelectedClassId(cls.id);
    setLatestSessionIndex(idx);
    // Auto-load lesson content theo lớp + số buổi
    loadLessonContent(cls.id, idx);
  };

  const handleSelectLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    // Tự động fill nội dung + nhận xét chung vào textarea khi đổi lesson
    // (overwrite block **1. Nội dung buổi học:** và **2. Nhận xét chung:**)
    const lesson = lessonData?.lessons?.find((l) => String(l.id) === lessonId);
    if (lesson) applyLessonToComment(lesson);
  };

  const applyLessonToComment = (lesson: any) => {
    const content = (lesson.content || "").trim();
    // Nhận xét chung - nhiều trường có thể chứa nhận xét
    const generalComment = (
      lesson.generalComment ||
      (lesson as any).comment ||
      (lesson as any).note ||
      (lesson as any).overall ||
      ""
    ).trim();

    if (!content && !generalComment) {
      // Không có gì để fill -> không cần show toast warning (chỉ clear selection)
      return;
    }

    // Dùng functional updater để chắc chắn đọc đúng state mới nhất
    // (tránh stale closure khi user bấm nút nhiều lần liên tiếp)
    setComment((prevComment) => {
      let next = prevComment || DEFAULT_ZALO_TEMPLATE;

      // ===== 1. Nội dung buổi học =====
      // Luôn tìm và thay block hiện tại (kể cả khi đã điền trước đó).
      // Block = từ sau "**1. Nội dung buổi học:**" đến trước "**2."
      if (content) {
        const blockRegex =
          /(\*\*1\.\s*Nội dung buổi học:\*\*\s*\n)([\s\S]*?)(?=\n\*\*2\.)/;
        if (blockRegex.test(next)) {
          next = next.replace(
            blockRegex,
            (_m, header) => `${header}${content}\n\n`,
          );
        } else {
          // Fallback: chèn ngay sau header
          next = next.replace(
            /(\*\*1\.\s*Nội dung buổi học:\*\*\s*\n)([\s\S]*)/,
            (_m, header, rest) => `${header}${content}\n\n${rest}`,
          );
        }
      }

      // ===== 2. Nhận xét chung =====
      if (generalComment) {
        const blockRegex =
          /(\*\*2\.\s*Nhận xét chung:\*\*\s*\n)([\s\S]*?)(?=\n\*\*3\.)/;
        if (blockRegex.test(next)) {
          next = next.replace(
            blockRegex,
            (_m, header) => `${header}${generalComment}\n\n`,
          );
        } else {
          next = next.replace(
            /(\*\*2\.\s*Nhận xét chung:\*\*\s*\n)([\s\S]*)/,
            (_m, header, rest) => `${header}${generalComment}\n\n${rest}`,
          );
        }
      }

      // Xóa các dòng "- Video bài học:" / "- Tóm tắt bài học:" / "- Slide bài giảng:" nếu rỗng
      next = next.replace(/^- Video bài học:\s*$/gm, "");
      next = next.replace(/^- Tóm tắt bài học:\s*$/gm, "");
      next = next.replace(/^- Slide bài giảng:\s*$/gm, "");
      // Gom các dòng trống liên tiếp thành 1
      next = next.replace(/\n{3,}/g, "\n\n");

      return next;
    });
  };

  const handleCopy = async () => {
    const zaloContent = comment.trim();
    if (!zaloContent)
      return showToast("warning", "Không có nhận xét Zalo để copy!");
    const res = await copyWithFormatting(zaloContent);
    if (!res?.ok) return showToast("error", "Lỗi khi copy!");
    if (res.mode === "html")
      showToast("success", "Đã copy nhận xét Zalo (giữ định dạng)!");
    else if (res.mode === "text")
      showToast("success", "Đã copy nhận xét Zalo (chỉ plain text)!");
    else showToast("success", "Đã copy nhận xét Zalo!");
  };

  const handleClear = () => {
    setComment("");
    setSelectedClassId(null);
    showToast("info", "Đã xóa nội dung!");
  };

  const getTextAreaRows = () => {
    if (isMobile) return 12;
    if (isTablet) return 14;
    return 20;
  };

  // Helper: resolve subject cho từng lớp.
  //  Ưu tiên 1 (chính xác nhất): nhận diện mã môn qua prefix trong tên lớp
  //    vì tên lớp đã mang mã môn ổn định (TDM-XART-*, TDM-VCI*, ...).
  //  Ưu tiên 2: dùng helper của LMS (course.name / subject) — match keyword.
  //  Ưu tiên 3: tên lớp (fallback).
  const resolveClassSubject = (cls: ClassItem): LmsSubject | null => {
    const fromName = resolveSubjectFromClassName(cls.name);
    if (fromName) return fromName;
    return resolveSubjectFromClass(
      cls.subject || cls.course?.name || cls.name || "",
    );
  };

  const classesWithLatest = useMemo(() => {
    const enriched = runningClasses
      .map((c) => {
        const latestFromServer = (c as any).latestSlot;
        const idxFromServer =
          (c as any).currentSessionIndex ?? latestFromServer?.index ?? 0;
        if (latestFromServer && idxFromServer > 0) {
          return {
            cls: c,
            latest: {
              index: idxFromServer,
              date: latestFromServer.date,
              startTime: latestFromServer.startTime,
              endTime: latestFromServer.endTime,
            } as LatestSlotInfo,
            subject: resolveClassSubject(c),
          };
        }
        // Fallback: tự suy ra từ slots
        const latest = pickLatestSlot(c.slots);
        return { cls: c, latest, subject: resolveClassSubject(c) };
      })
      .filter((x) => x.latest !== null);

    // Filter theo subject — giống logic LMS (`filterClassesBySubject`):
    //   - subject === null (chưa resolve được) → giữ để tránh ẩn lớp lạ
    //   - subject === subjectFilter            → giữ
    //   - còn lại                              → ẩn
    let filtered: typeof enriched;
    if (subjectFilter === "all") {
      filtered = enriched;
    } else {
      filtered = enriched.filter(
        (x) => x.subject === null || x.subject === subjectFilter,
      );
    }

    // Sort theo tên lớp (locale-aware, không phân biệt hoa thường) để ổn định
    // giữa các lần load. Dùng `Intl.Collator` thay vì localeCompare để có thể
    // pre-compute và tăng tốc với danh sách lớn.
    const collator = new Intl.Collator("vi", {
      sensitivity: "base",
      numeric: true,
    });
    return [...filtered].sort((a, b) =>
      collator.compare(a.cls.name, b.cls.name),
    );
  }, [runningClasses, subjectFilter]);

  const innerContent = (
    <>
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left: sidebar + lesson panel stacked in a flex column */}
        <div className="lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4">
          {/* Sidebar: Danh sách lớp đang chạy — Stratos Navy brand 60% */}
          <Card className="p-4 space-y-3 overflow-y-auto border-brand-60/15 shadow-[0_2px_8px_-2px_rgba(0,0,86,0.08)]">
          <div className="flex items-center justify-between pb-2 border-b-2 border-brand-60/10">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md mindx-badge-stratos">
                <Users className="h-4 w-4" />
              </span>
              <h2 className="font-bold text-brand-60 text-sm truncate">
                Lớp đang chạy
              </h2>
              <Badge variant="stratos" className="ml-1">
                {classesWithLatest.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-brand-60/70 hover:text-brand-10 hover:bg-brand-10/10"
              onClick={loadRunningClasses}
              disabled={classesLoading}
              title="Tải lại danh sách lớp"
            >
              <RefreshCw
                className={`h-4 w-4 ${classesLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          {/* Subject filter tabs */}
          <SubjectTabs
            selectedSubject={subjectFilter}
            onChange={(s) => setSubjectFilter(s as LmsSubject | "all")}
            subjects={LMS_SUBJECTS}
            showAll
          />

          {classesLoading ? (
            <div className="flex justify-center items-center py-10 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-brand-10" />
              <span className="text-sm font-medium text-brand-60/70">
                Đang tải...
              </span>
            </div>
          ) : classesWithLatest.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full mindx-badge-stratos mb-3">
                <Users className="h-6 w-6" />
              </span>
              <p className="text-xs font-semibold text-brand-60">
                {subjectFilter === "all"
                  ? "Hiện không có lớp nào đang chạy."
                  : `Không có lớp ${
                      LMS_SUBJECTS.find((s) => s.key === subjectFilter)
                        ?.label || ""
                    } nào đang chạy.`}
              </p>
              <p className="text-[10px] mt-1 text-brand-60/60">
                Vào LMS kiểm tra trạng thái lớp hoặc bấm ↻ để tải lại
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {classesWithLatest.map(({ cls, latest, subject }) => {
                const isSelected = selectedClassId === cls.id;
                const label =
                  latest && latest.index > 0
                    ? `Buổi ${latest.index}`
                    : "Chưa có buổi";
                const dateLabel = formatDateVi(latest?.date);
                const timeLabel =
                  latest?.startTime && latest?.endTime
                    ? `${formatTimeHHmm(latest.startTime)}–${formatTimeHHmm(latest.endTime)}`
                    : "";
                const subjectLabel = subject
                  ? LMS_SUBJECTS.find((s) => s.key === subject)?.label
                  : null;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => latest && applyClassToTemplate(cls, latest)}
                    className={`group w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 rounded-md border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/60"
                    }`}
                  >
                    <span
                      className={`min-w-0 font-medium text-sm truncate text-left ${
                        isSelected ? "text-primary" : "text-foreground"
                      }`}
                      title={cls.name}
                    >
                      {cls.name}
                    </span>
                    <span
                      className={`shrink-0 inline-flex items-center justify-center self-stretch -my-2 -mr-3 px-3 min-w-[5.75rem] text-[11px] font-semibold tracking-wide tabular-nums uppercase rounded-r-md border-l-2 transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18)]"
                          : "bg-primary/10 text-primary border-primary/40 group-hover:bg-primary/20 group-hover:border-primary/60"
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
        </div>

        {/* Main: Editor — Crimson primary brand accent */}
        <Card className="flex-1 min-w-0 p-4 flex flex-col gap-4 min-h-0 border-brand-10/25 shadow-[0_2px_12px_-2px_rgba(227,31,38,0.1)]">
          <header className="flex items-center justify-between gap-2 pb-3 border-b-2 border-brand-10/15">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md mindx-badge-crimson shrink-0">
                <PencilLine className="h-4 w-4" />
              </span>
              <h2 className="font-bold text-brand-10 text-sm truncate">
                Nội dung nhận xét
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetTemplate}
                title="Khôi phục mẫu nhận xét mặc định"
                className="h-8 px-2.5 text-xs"
              >
                <Wand2 className="h-3.5 w-3.5 mr-1" />
                <span className="hidden lg:inline">Khôi phục mẫu</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIntructionModalOpen(true)}
                className="h-8 px-2.5 text-xs"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                <span className="hidden lg:inline">Hướng dẫn</span>
              </Button>
              <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mindx-badge-stratos">
                <span className="tabular-nums">{comment.length}</span>
                <span>ký tự</span>
              </div>
            </div>
          </header>

          {loading ? (
            <div className="flex justify-center items-center py-16 gap-2">
              <Loader2 className="h-7 w-7 animate-spin text-brand-10" />
              <span className="text-sm text-brand-60/70">
                Đang tải nội dung...
              </span>
            </div>
          ) : (
            <>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Nhập hoặc chỉnh sửa nhận xét Zalo..."
                className="min-h-[480px] resize-y font-mono text-sm leading-relaxed border-brand-60/20 focus-visible:border-brand-10 focus-visible:ring-brand-10/30 bg-brand-60/[0.015]"
              />

              <ActionButtons
                isMobile={isMobile}
                commentEmpty={!comment.trim()}
                onCopy={handleCopy}
                onClear={handleClear}
                onPreview={() => setPreviewModalOpen(true)}
              />
            </>
          )}
        </Card>

        {/* Right panel: Lesson content (auto-load theo lớp) — Sunglow Gold brand 30% */}
        <Card className="lg:w-80 xl:w-96 shrink-0 p-4 space-y-3 overflow-y-auto border-brand-30/40 shadow-[0_2px_8px_-2px_rgba(255,214,45,0.25)] bg-gradient-to-b from-brand-30-soft/40 to-background">
          <div className="flex items-center justify-between pb-2 border-b-2 border-brand-30/30">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md mindx-badge-sunglow shrink-0">
                <Clock className="h-4 w-4" />
              </span>
              <h2 className="font-bold text-brand-60 text-sm truncate">
                Nội dung buổi học
              </h2>
            </div>
            {selectedClassId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-brand-60/70 hover:text-brand-10 hover:bg-brand-10/10"
                onClick={() =>
                  lessonData &&
                  loadLessonContent(selectedClassId, latestSessionIndex)
                }
                disabled={lessonLoading}
                title="Tải lại nội dung"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${lessonLoading ? "animate-spin" : ""}`}
                />
              </Button>
            )}
          </div>

          {/* Nội dung */}
          {!selectedClassId ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full mindx-badge-sunglow mb-2">
                <Clock className="h-5 w-5" />
              </span>
              <p className="text-xs font-semibold text-brand-60">
                Chọn lớp để tải nội dung buổi học
              </p>
              <p className="text-[10px] mt-1 text-brand-60/60">
                Tự động khớp theo môn học
              </p>
            </div>
          ) : lessonLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-brand-60/70">
              <Loader2 className="h-5 w-5 animate-spin mb-2 text-brand-30" />
              <span className="text-xs font-medium">Đang tải nội dung...</span>
            </div>
          ) : (
            <LessonContentPanel
              lessons={lessonData?.lessons || []}
              selectedLessonId={selectedLessonId}
              selectedLesson={lessonData?.selectedLesson}
              onSelectLesson={handleSelectLesson}
              isMobile={isMobile}
            />
          )}
        </Card>
      </div>
    </>
  );

  const overlays = (
    <>
      <InstructionModal
        open={intructionModalOpen}
        onClose={() => setIntructionModalOpen(false)}
        isMobile={isMobile}
      />

      <PreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        comment={comment}
        onCopy={() => {
          handleCopy();
          setPreviewModalOpen(false);
        }}
        isMobile={isMobile}
      />

      {toastMessage && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-in fade-in slide-in-from-top-2"
          style={{
            backgroundColor:
              toastMessage.type === "success"
                ? "hsl(var(--success))"
                : toastMessage.type === "error"
                  ? "hsl(var(--destructive))"
                  : toastMessage.type === "warning"
                    ? "hsl(var(--warning))"
                    : "hsl(var(--info))",
          }}
        >
          {toastMessage.text}
        </div>
      )}
    </>
  );

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-4">
      {innerContent}
      {overlays}
    </main>
  );
}