"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle,
  LogOut,
  LogIn,
  FileText,
  Folder,
  List,
  Upload,
  RefreshCw,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertModal } from "@/components/ui/alert-modal";
import { useAuthStore } from "@/store/useAuthStore";
import { isTE } from "@/lib/utils";
import { FileList } from "./components/FileList";
import { UploadDialog } from "./components/UploadDialog";
import { AllFilesList } from "./components/AllFilesList";
import { trialReportService } from "@/services/trialReportService";
import {
  initializeGoogleDrive,
  setAuthStatusListener,
  setTokenExpiredListener,
  signInToGoogle,
  signOutFromGoogle,
  getGoogleUserInfo,
  getTokenInfo,
  isUserSignedIn,
  listFoldersInFolder,
  listFilesInFolder,
  deleteFile as driveDeleteFile,
} from "@/services/googleDriveService";
import { getRootFolderId as getDriveRootFolderId } from "@/services/googleDriveService";
import type { DriveFolder, DriveFile } from "@/types/trialReport";

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

  const [view, setView] = useState<"browser" | "all">("browser");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState<string>("Tất cả phiếu");
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([ROOT_CRUMB]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Errors and successes are surfaced via <AlertModal> instead of
  // inline banners so they get a consistent, dismissible, full-screen
  // experience across the app. `errorTitle`/`successTitle` are kept
  // separate so callers that need a non-default heading (e.g. the
  // Drive sign-in flow) can override without losing the simpler
  // string-only path used by FileList/AllFilesList callbacks.
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState<string | null>(null);
  const [isDriveSignedIn, setIsDriveSignedIn] = useState(false);
  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(null);
  const [driveRemainingMinutes, setDriveRemainingMinutes] = useState<number>(0);
  const [isSigningOut, setIsSigningOut] = useState(false);
  // Used both by the header CTA ("Đăng nhập Google" → "Thêm phiếu"
  // once sign-in completes) and to keep the actual upload flow from
  // silently opening before sign-in lands.
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Convenience wrappers around the error/success state so that any
  // plain `setErrorMsg(s)` call also resets `errorTitle` to the
  // variant default. Callers that want a custom title pair the two
  // setters explicitly (see the Drive sign-in expiry handler).
  // Accepts `string | null` so it can be passed directly to
  // child-component `onError` props (FileList, AllFilesList,
  // UploadDialog) without forcing each child to filter nulls.
  const showError = (msg: string | null) => {
    setErrorTitle(null);
    setErrorMsg(msg);
  };
  const showSuccess = (msg: string | null) => {
    setSuccessTitle(null);
    setSuccessMsg(msg);
  };
  const clearError = () => {
    setErrorMsg(null);
    setErrorTitle(null);
  };
  const clearSuccess = () => {
    setSuccessMsg(null);
    setSuccessTitle(null);
  };

  const isAdmin = isTE(user);

  const loadFolders = useCallback(async (folderId: string | null, skipInitialLoadReset = false) => {
    if (!skipInitialLoadReset) {
      setIsLoadingFolders(true);
      setIsLoadingFiles(true);
    }
    try {
      // Make sure gapi / GIS libraries are loaded before we hit Drive.
      // The `useEffect` that kicks off `initializeGoogleDrive()` may not
      // have resolved yet by the time this callback fires (it runs on
      // mount and on `view`/`currentFolderId` changes), so calling
      // `listFoldersInFolder` now would throw `gapi is not defined`.
      try {
        await initializeGoogleDrive();
      } catch (initErr: any) {
        // Init failed (missing env, no network, etc.) — surface the
        // message and stop, instead of crashing on `gapi is not defined`.
        setFolders([]);
        setFiles([]);
        showError(initErr?.message || "Không thể khởi tạo Google Drive");
        setIsLoadingFolders(false);
        setIsLoadingFiles(false);
        setIsInitialLoad(false);
        return;
      }

      // No token yet (first visit, or user just signed out). Don't hit
      // the Drive API — `assertTokenValid` would throw and trigger the
      // auto re-auth popup, which the browser blocks when not in a user
      // gesture. The header CTA ("Đăng nhập Google" with a small badge)
      // is the only entry point; clicking it opens the OAuth popup
      // legitimately inside a user-gesture handler.
      if (!isUserSignedIn()) {
        setFolders([]);
        setFiles([]);
        setIsLoadingFolders(false);
        setIsLoadingFiles(false);
        setIsInitialLoad(false);
        return;
      }

      // Browser-direct Drive listings (was: trialReportService.getFolders / getFiles).
      // The backend proxy no longer exists because service-account Drive
      // listing/uploading hits `storageQuotaExceeded` for personal folders.
      const target = folderId || getDriveRootFolderId() || null;
      const [foldersRes, filesRes] = await Promise.all([
        listFoldersInFolder(target || undefined).then(
          (items) => ({ success: true, data: items as DriveFolder[] }),
          (e) => ({ success: false, error: e?.message || "Drive folders failed", data: [] }),
        ),
        listFilesInFolder(target || undefined).then(
          (items) => ({ success: true, data: items as DriveFile[] }),
          (e) => ({ success: false, error: e?.message || "Drive files failed", data: [] }),
        ),
      ]);
      if (foldersRes.success) {
        setFolders(foldersRes.data as DriveFolder[]);
      } else {
        setFolders([]);
      }
      if (filesRes.success) {
        setFiles(filesRes.data as DriveFile[]);
      } else {
        setFiles([]);
      }
      if (!foldersRes.success || !filesRes.success) {
        showError(
          (foldersRes as any).error || (filesRes as any).error || "Không thể tải dữ liệu Drive",
        );
      }
    } catch (err: any) {
      // When the token has just expired, the service fires the global
      // re-auth flow and throws a friendly message. We only need to
      // surface generic errors here.
      const message = err?.message || "Không thể tải dữ liệu Drive";
      showError(message);
      console.error("loadFolders failed:", err);
    } finally {
      setIsLoadingFolders(false);
      setIsLoadingFiles(false);
      setIsInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    if (view === "browser") {
      loadFolders(currentFolderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentFolderId]);

  // Initialize the Drive service + subscribe to auth-status changes.
  // We also force-sync the page state from `localStorage` synchronously
  // before the service resolves, because background-tab suspension can
  // leave `isUserSignedIn()` returning false even though a valid token
  // is still persisted. Reading localStorage directly avoids the F5.
  useEffect(() => {
    const syncFromLocalStorage = () => {
      try {
        const saved = localStorage.getItem("google_drive_token");
        if (!saved) return false;
        const data = JSON.parse(saved);
        if (data.expiry > Date.now() && data.access_token) {
          setIsDriveSignedIn(true);
          setDriveRemainingMinutes(
            Math.max(0, Math.floor((data.expiry - Date.now()) / 60000))
          );
          getGoogleUserInfo().then((info) => {
            if (info) setDriveUserEmail(info.email);
          });
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    // Sync from persisted token first — this makes the UI correct on
    // mount without waiting for `initializeGoogleDrive` to resolve.
    syncFromLocalStorage();

    const unsubscribe = setAuthStatusListener((status) => {
      setIsDriveSignedIn(status.isSignedIn);
      if (status.isSignedIn) {
        setDriveUserEmail(null);
        setDriveRemainingMinutes(getTokenInfo().remainingMinutes);
        getGoogleUserInfo().then((info) => {
          if (info) setDriveUserEmail(info.email);
        });
      } else {
        setDriveUserEmail(null);
        setDriveRemainingMinutes(0);
      }
    });

    initializeGoogleDrive().catch((error) => {
      console.error("Failed to initialize Google Drive:", error);
    });

    // After init resolves, re-check the localStorage source — covers the
    // case where the authStatusListener fired before we mounted.
    initializeGoogleDrive()
      .then(() => {
        if (isUserSignedIn()) {
          setIsDriveSignedIn(true);
          setDriveRemainingMinutes(getTokenInfo().remainingMinutes);
          getGoogleUserInfo().then((info) => {
            if (info) setDriveUserEmail(info.email);
          });
        } else {
          // service lost the token — try to restore from localStorage
          syncFromLocalStorage();
        }
      })
      .catch(() => {
        /* already logged above */
      });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Proactive re-auth: when the access token expires (either caught by
   * the refresh monitor or by a 401 from a Drive API call), the
   * `googleDriveService` will invoke this callback. We immediately
   * reopen the Google consent flow so the user is sent back to the
   * sign-in screen rather than left looking at a stale page that no
   * longer works. We also show a banner explaining what happened.
   */
  useEffect(() => {
    setTokenExpiredListener(async () => {
      setErrorTitle("Phiên Google đã hết hạn");
      setErrorMsg("Đang mở lại màn hình đăng nhập...");
      try {
        await signInToGoogle();
      } catch (err) {
        console.error("Auto re-auth failed:", err);
        setErrorMsg(
          "Phiên Google đã hết hạn. Vui lòng bấm \"Đăng nhập Google\" để tiếp tục."
        );
      }
    });
  }, []);

  // Re-sync the page-level Drive sign-in state when the tab becomes
  // visible again. Background tabs can have their JS engines suspended,
  // which leaves the module-level `accessToken` and `isUserSignedIn()`
  // out of sync with the persisted token in localStorage. Without this
  // re-check, the user sees the "Chỉ xem" UI even though they are
  // already signed in, and has to F5 to recover.
  useEffect(() => {
    const refreshDriveState = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const savedToken = localStorage.getItem("google_drive_token");
        if (savedToken) {
          const tokenData = JSON.parse(savedToken);
          if (tokenData.expiry > Date.now() && tokenData.access_token) {
            // Restore the module-level accessToken before reading
            // token info, so `getTokenInfo()` reflects reality.
            try {
              const { setStoredAccessToken } = await import(
                "@/services/googleDriveService"
              );
              setStoredAccessToken(tokenData.access_token);
            } catch (err) {
              console.error("Failed to restore Drive token on visibility:", err);
            }
            setIsDriveSignedIn(true);
            setDriveRemainingMinutes(getTokenInfo().remainingMinutes);
            getGoogleUserInfo().then((info) => {
              if (info) setDriveUserEmail(info.email);
            });
            // We came back to the tab and now have a token — cancel
            // any pending "sign-in in progress" so the header CTA
            // doesn't stay stuck on the loading state.
            setIsSigningIn(false);
            return;
          }
        }
        setIsDriveSignedIn(false);
        setDriveUserEmail(null);
        setDriveRemainingMinutes(0);
        // If the user closed the OAuth popup without completing the
        // flow, GIS should fire its callback with `popup_closed`, but
        // in some edge cases (popup dismissed before the handler is
        // wired) it never fires. Detect that condition here so the
        // "Đăng nhập" button doesn't stay disabled forever.
        setIsSigningIn((prev) => {
          if (prev) {
            showError(
              "Đăng nhập Google đã bị huỷ hoặc không phản hồi. Vui lòng thử lại.",
            );
          }
          return false;
        });
      } catch (err) {
        console.error("Failed to refresh Drive sign-in state:", err);
      }
    };

    document.addEventListener("visibilitychange", refreshDriveState);
    window.addEventListener("focus", refreshDriveState);
    return () => {
      document.removeEventListener("visibilitychange", refreshDriveState);
      window.removeEventListener("focus", refreshDriveState);
    };
  }, []);

  const handleOpenUpload = async () => {
    // Re-check the persisted token before opening OAuth. If the page
    // thinks we're signed out (e.g. module-level accessToken was
    // cleared during a long background-tab period) but a valid token
    // still exists in localStorage, restore it first so the UI updates
    // to "Đã kết nối" instead of triggering an unnecessary OAuth pop-up.
    if (!isDriveSignedIn) {
      try {
        const saved = localStorage.getItem("google_drive_token");
        if (saved) {
          const data = JSON.parse(saved);
          if (data.expiry > Date.now() && data.access_token) {
            const { setStoredAccessToken } = await import(
              "@/services/googleDriveService"
            );
            setStoredAccessToken(data.access_token);
            setIsDriveSignedIn(true);
            setDriveRemainingMinutes(
              Math.max(0, Math.floor((data.expiry - Date.now()) / 60000))
            );
            getGoogleUserInfo().then((info) => {
              if (info) setDriveUserEmail(info.email);
            });
            setUploadOpen(true);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to restore Drive token before upload:", err);
      }
      try {
        await signInToGoogle();
      } catch (err) {
        console.error("Google sign-in failed:", err);
      }
      return;
    }
    setUploadOpen(true);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOutFromGoogle();
      setIsDriveSignedIn(false);
      setDriveUserEmail(null);
      setDriveRemainingMinutes(0);
    } catch (err) {
      console.error("Google sign-out failed:", err);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleFolderSelect = useCallback((folderId: string | null, folderName: string) => {
    setCurrentFolderId(folderId);
    setCurrentFolderName(folderName);
  }, []);

  const handleEnterFolder = (folder: DriveFolder) => {
    const next = [...crumbs];
    const last = next[next.length - 1];
    if (last?.id !== folder.id) {
      next.push({ id: folder.id, name: folder.name });
      setCrumbs(next);
    }
    handleFolderSelect(folder.id, folder.name);
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

  const mainContent = (
    <>
      {/* ===== Alerts (rendered as a modal below) ===== */}

      {/* ===== Main Content ===== */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm shadow-black/[0.02] overflow-hidden">
        <div className="flex h-[calc(100vh-340px)] min-h-[500px]">
          {/* Sidebar */}
          {view === "browser" && (
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
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-white">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100/70">
                <Button
                  size="sm"
                  variant={view === "browser" ? "default" : "ghost"}
                  className="h-8 shadow-sm"
                  onClick={() => setView("browser")}
                >
                  <Folder className="h-3.5 w-3.5 mr-1.5" />
                  Trình duyệt
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant={view === "all" ? "default" : "ghost"}
                    className="h-8 shadow-sm"
                    onClick={() => setView("all")}
                  >
                    <List className="h-3.5 w-3.5 mr-1.5" />
                    Tất cả
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isDriveSignedIn && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-xs font-medium">
                      <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                      <span className="max-w-[160px] truncate">{driveUserEmail || "Đã kết nối"}</span>
                      {driveRemainingMinutes > 0 && (
                        <span className="text-emerald-500/70 shrink-0">· còn {driveRemainingMinutes}p</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      title="Đăng xuất Google"
                    >
                      {isSigningOut ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LogOut className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                )}
                {!isDriveSignedIn ? (
                  // Not signed in → CTA is to start the OAuth flow.
                  // Click happens inside a user-gesture handler so the
                  // popup is allowed (the previous version auto-triggered
                  // the popup on first load and the browser blocked it).
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 border-slate-300 text-slate-700 hover:bg-slate-50"
                      onClick={async () => {
                        setIsSigningIn(true);
                        clearError();
                        try {
                          await signInToGoogle();
                        } catch (err: any) {
                          console.error("Google sign-in failed:", err);
                          showError(err?.message || "Đăng nhập Google thất bại");
                        } finally {
                          setIsSigningIn(false);
                        }
                      }}
                      disabled={isSigningIn}
                      title="Đăng nhập Google để có thể tải lên file"
                    >
                      {isSigningIn ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <LogIn className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Đăng nhập Google
                    </Button>
                    <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white shadow-sm ring-2 ring-white">
                      !
                    </span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="h-9 shadow-sm shadow-primary/20"
                    onClick={handleOpenUpload}
                    title="Thêm phiếu mới"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Thêm phiếu
                  </Button>
                )}
              </div>
            </div>

            {/* Breadcrumb */}
            {view === "browser" && (
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
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {view === "browser" ? (
                <FileList
                  key={`${currentFolderId ?? "root"}-${refreshKey}`}
                  folderId={currentFolderId}
                  folderName={currentFolderName}
                  onError={showError}
                />
              ) : (
                <AllFilesList onError={showError} />
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
        onSuccess={(msg) => {
          showSuccess(msg);
          // No auto-dismiss — the success modal now stays open until
          // the user closes it, mirroring the new alert-modal UX. The
          // previous 4s banner timer was too short to read backend
          // confirmation messages in full.
        }}
        onRefresh={handleRefresh}
      />

      <AlertModal
        variant="error"
        open={!!errorMsg}
        onOpenChange={(open) => {
          if (!open) clearError();
        }}
        title={errorTitle ?? undefined}
        message={errorMsg ?? ""}
      />

      <AlertModal
        variant="success"
        open={!!successMsg}
        onOpenChange={(open) => {
          if (!open) clearSuccess();
        }}
        title={successTitle ?? undefined}
        message={successMsg ?? ""}
      />
    </>
  );

  return (
    <main className="space-y-4 mx-auto px-4 sm:px-6 py-5">
      {mainContent}
    </main>
  );
}
