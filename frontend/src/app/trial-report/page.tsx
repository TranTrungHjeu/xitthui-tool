"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, FileText, Folder, LayoutList, LayoutGrid, Upload, RefreshCw, ChevronRight, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectItem, SelectContent } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/store/useAuthStore";
import { hasPermission } from "@/lib/utils";
import { FileList } from "./components/FileList";
import { UploadDialog } from "./components/UploadDialog";
import { AllFilesList } from "./components/AllFilesList";
// DeleteRequestBell was removed when the request/review flow was
// replaced by the password-gated direct delete.
import { trialReportService } from "@/services/trialReportService";
import {
  listFoldersInFolder,
  listFilesInFolder,
  checkHealth,
} from "@/services/r2Service";
import type { StorageFolder, StorageItem } from "@/services/r2Service";

interface Crumb {
  id: string | null;
  name: string;
}

const ROOT_CRUMB: Crumb = { id: null, name: "Tất cả phiếu" };

export default function TrialReportPage() {
  const user = useAuthStore((s) => s.user);

  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState<string>("Tất cả phiếu");
  const [folders, setFolders] = useState<StorageFolder[]>([]);
  const [files, setFiles] = useState<StorageItem[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([ROOT_CRUMB]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [r2Healthy, setR2Healthy] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterTeacherCode, setFilterTeacherCode] = useState("");
  const [filterStudentName, setFilterStudentName] = useState("");
  const [filterReportType, setFilterReportType] = useState("");
  const [filterTrigger, setFilterTrigger] = useState(0);

  const showError = useCallback((msg: string | null) => {
    if (msg) toast.error(msg);
  }, []);

  const isAdmin = hasPermission(user, "canViewAll");
  const canDelete = hasPermission(user, "canDelete");
  const canUpload = hasPermission(user, "canUpload");
  const canApprove = hasPermission(user, "canApprove");

  const loadFolders = useCallback(async (folderId: string | null, skipInitialLoadReset = false) => {
    if (!skipInitialLoadReset) {
      setIsLoadingFolders(true);
      setIsLoadingFiles(true);
    }
    try {
      const target = folderId || null;
      const [foldersRes, filesRes] = await Promise.all([
        listFoldersInFolder(target).then(
          (items) => ({ success: true, data: items }),
          (e) => ({ success: false, error: e?.message || "Tải thư mục thất bại", data: [] as StorageFolder[] }),
        ),
        listFilesInFolder(target).then(
          (items) => ({ success: true, data: items }),
          (e) => ({ success: false, error: e?.message || "Tải file thất bại", data: [] as StorageItem[] }),
        ),
      ]);
      if (foldersRes.success) {
        setFolders(foldersRes.data);
      } else {
        setFolders([]);
      }
      if (filesRes.success) {
        setFiles(filesRes.data);
      } else {
        setFiles([]);
      }
      if (!foldersRes.success || !filesRes.success) {
        showError((foldersRes as any).error || (filesRes as any).error);
      }
    } catch (err: any) {
      showError(err?.message || "Không thể tải dữ liệu");
    } finally {
      setIsLoadingFolders(false);
      setIsLoadingFiles(false);
      setIsInitialLoad(false);
    }
  }, [showError]);

  // Load storage health on mount
  useEffect(() => {
    checkHealth().then(setR2Healthy).catch(() => setR2Healthy(false));
  }, []);

  useEffect(() => {
    loadFolders(currentFolderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId]);

  const handleFolderSelect = useCallback((folderId: string | null, folderName: string) => {
    setCurrentFolderId(folderId);
    setCurrentFolderName(folderName);
  }, []);

  const handleEnterFolder = (folder: StorageFolder) => {
    const next = [...crumbs];
    const last = next[next.length - 1];
    // Use folder.path (relative) for navigation — folder.id is the full
    // S3 key used only for React keys / internal tracking.
    const folderPath = (folder as any).path ?? folder.id;
    if (last?.id !== folderPath) {
      next.push({ id: folderPath, name: folder.name });
      setCrumbs(next);
    }
    handleFolderSelect(folderPath, folder.name);
  };

  const handleCrumbClick = (idx: number) => {
    const next = crumbs.slice(0, idx + 1);
    setCrumbs(next);
    const target = next[next.length - 1];
    handleFolderSelect(target.id, target.name);
  };

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    loadFolders(currentFolderId);
  }, [currentFolderId, loadFolders]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Đang tải...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="space-y-4 mx-auto px-4 sm:px-6 py-5">
      {/* Error banner */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 shadow-sm"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
            <RefreshCw className="h-4 w-4 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Lỗi</p>
            <p className="text-xs text-red-800/90 mt-0.5">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="shrink-0 rounded-md p-1 text-red-700/70 hover:bg-red-100 hover:text-red-900 transition-colors"
            aria-label="Đóng thông báo"
          >
            <span className="text-xs font-semibold">Đóng</span>
          </button>
        </div>
      )}

      {/* R2 health indicator */}
      {r2Healthy === false && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <RefreshCw className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Lưu trữ cloud chưa sẵn sàng</p>
            <p className="text-xs text-amber-800/90 mt-0.5">
              R2 không khả dụng. Kiểm tra cấu hình R2 trong .env.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm shadow-black/[0.02] overflow-hidden">
        <div className="flex h-[calc(100vh-180px)] min-h-[700px]">
          {/* Sidebar - only show in tree view */}
          {viewMode === "tree" && (
          <aside className="w-64 shrink-0 bg-gradient-to-b from-slate-50/50 to-white border-r border-slate-200/70 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Thư mục
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-slate-400 hover:text-foreground"
                onClick={() => loadFolders(currentFolderId)}
                title="Tải lại"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingFolders ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingFolders || (isInitialLoad && folders.length === 0 && files.length === 0) ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Đang tải...
                </div>
              ) : folders.length === 0 && files.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Thư mục trống</p>
              ) : (
                <>
                  {folders.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase px-2 mb-1.5">Thư mục</p>
                      <ul className="space-y-0.5">
                        {folders.map((folder) => (
                          <li key={folder.id}>
                            <button
                              type="button"
                              onClick={() => handleEnterFolder(folder)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-amber-50 transition-colors text-left"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-100">
                                <Folder className="h-4 w-4 text-amber-600" />
                              </span>
                              <span className="truncate font-medium text-foreground">{folder.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {files.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase px-2 mb-1.5">Files</p>
                      <ul className="space-y-0.5">
                        {files.map((file) => (
                          <li key={file.id}>
                            <a
                              href={file.webViewLink ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-primary/5 hover:text-primary transition-colors text-left"
                            >
                              <FileText className="h-4 w-4 ml-1.5 text-blue-500 shrink-0" />
                              <span className="truncate text-muted-foreground">{file.name}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
          )}

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-slate-100 bg-white overflow-x-auto sticky top-0 z-20 isolate">
              <div className="flex items-center gap-3">
                {/* Left group */}
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                  <div
                    className="flex items-center gap-0.5 rounded-lg bg-slate-100/70 p-0.5 shrink-0"
                    role="group"
                    aria-label="Chế độ hiển thị"
                  >
                    <Button
                      type="button"
                      size="icon-sm"
                      variant={viewMode === "list" ? "default" : "ghost"}
                      className="shadow-sm"
                      onClick={() => setViewMode("list")}
                      aria-label="Chế độ danh sách"
                      title="Chế độ danh sách"
                      disabled={!isAdmin}
                    >
                      <LayoutList className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant={viewMode === "tree" ? "default" : "ghost"}
                      className="shadow-sm"
                      onClick={() => setViewMode("tree")}
                      aria-label="Chế độ cây"
                      title="Chế độ cây"
                      disabled={!isAdmin}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {/* Filter controls */}
                  <div className="flex items-center gap-1.5 flex-wrap border-l border-slate-200 pl-2">
                    <DateRangePicker
                      fromValue={filterFrom}
                      toValue={filterTo}
                      onFromChange={setFilterFrom}
                      onToChange={setFilterTo}
                      placeholder="Khoảng ngày"
                      className="w-[200px]"
                    />
                    <Input
                      value={filterTeacherCode}
                      onChange={(e) => setFilterTeacherCode(e.target.value)}
                      placeholder="Mã GV"
                      className="w-[130px] h-8 text-xs"
                    />
                    <Input
                      value={filterStudentName}
                      onChange={(e) => setFilterStudentName(e.target.value)}
                      placeholder="Tên học viên"
                      className="w-[150px] h-8 text-xs"
                    />
                    <Select
                      value={filterReportType}
                      onValueChange={setFilterReportType}
                      placeholder="Loại"
                      className="w-[130px]"
                    >
                      <SelectContent>
                        <SelectItem value="">Loại</SelectItem>
                        <SelectItem value="Kiro4+">Kiro4+</SelectItem>
                        <SelectItem value="Robotics">Robotics</SelectItem>
                        <SelectItem value="Coding">Coding</SelectItem>
                        <SelectItem value="Art">Art</SelectItem>
                        <SelectItem value="pdf-upload">pdf-upload</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 text-xs shadow-sm shadow-primary/20"
                      onClick={() => setFilterTrigger((n) => n + 1)}
                    >
                      <Search className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Right group */}
                <div className="flex items-center gap-2 shrink-0 border-l border-slate-200 pl-3">
                  {r2Healthy !== false && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-xs font-medium">
                      <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Cloud lưu trữ sẵn sàng</span>
                    </div>
                  )}
                  {canUpload && (
                    <Button
                      size="sm"
                      className="h-9 shadow-sm shadow-primary/20"
                      onClick={() => setUploadOpen(true)}
                      title="Thêm phiếu mới"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Thêm phiếu
                    </Button>
                  )}
                </div>
              </div>

              {/* Breadcrumb */}
              <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50/50 to-white border-b border-slate-100">
                <nav className="flex items-center text-xs">
                  <Folder className="h-3.5 w-3.5 text-amber-500 mr-1.5 shrink-0" />
                  {crumbs.map((crumb, idx) => (
                    <div key={`${crumb.id ?? "root"}-${idx}`} className="flex items-center min-w-0">
                      {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-300 shrink-0 mx-1" />}
                      <button
                        type="button"
                        onClick={() => handleCrumbClick(idx)}
                        className={`truncate max-w-[200px] transition-colors ${
                          idx === crumbs.length - 1
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title={crumb.name}
                      >
                        {crumb.name}
                      </button>
                    </div>
                  ))}
                </nav>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {viewMode === "tree" ? (
                <FileList
                  key={`${currentFolderId ?? "root"}-${refreshKey}`}
                  folderId={currentFolderId}
                  folderName={currentFolderName}
                  viewMode="table"
                  onError={showError}
                  onRefresh={handleRefresh}
                />
              ) : (
                <AllFilesList
                  key={`all-files-${refreshKey}-${filterTrigger}`}
                  onError={showError}
                  canDelete={canDelete}
                  viewMode="table"
                  from={filterFrom}
                  to={filterTo}
                  teacherCode={filterTeacherCode}
                  studentName={filterStudentName}
                  reportType={filterReportType}
                  filterTrigger={filterTrigger}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        folderId={currentFolderId}
        onError={showError}
        onRefresh={handleRefresh}
      />
    </main>
  );
}
