"use client";

import type { DriveFile, DriveFolder, DriveAuthStatus, UploadParams, TokenInfo, UploadedFileMeta } from "@/types/drive";

// Google Drive API configuration
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY || "";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || "";
const ROOT_FOLDER_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER || "";

// Full Drive access scope (needed for shared folders)
const SCOPES = "https://www.googleapis.com/auth/drive";

// Type declarations for Google APIs
declare const gapi: {
  load: (api: string, callback: () => void) => void;
  client: {
    init: (config: { apiKey: string; discoveryDocs: string[] }) => Promise<void>;
    setToken: (token: { access_token: string } | null) => void;
    drive: {
      files: {
        list: (params: Record<string, unknown>) => Promise<{ result: { files?: DriveFile[] } }>;
        create: (params: { resource: Record<string, unknown>; fields: string }) => Promise<{ result: { id: string } }>;
        delete: (params: { fileId: string }) => Promise<void>;
        get: (params: { fileId: string; alt: string }) => Promise<{ body: string }>;
      };
    };
    getToken: () => { access_token: string } | null;
  };
};

declare const google: {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (tokenResponse: { error?: string; access_token?: string; expires_in?: number }) => void;
      }) => {
        requestAccessToken: (options: { prompt?: string }) => void;
        callback?: (tokenResponse: { error?: string; access_token?: string; expires_in?: number }) => void;
      };
      revoke: (token: string, callback: () => void) => void;
    };
  };
};

let authStatusCallbacks: Set<(status: DriveAuthStatus) => void> = new Set();
let tokenExpiredCallback: (() => void) | null = null;
let tokenClient: ReturnType<typeof google.accounts.oauth2.initTokenClient> | null = null;
let accessToken: string | null = null;
let currentIsTEorAdmin: boolean = false;
let isInitialized: boolean = false;
let initPromise: Promise<void> | null = null;
// Set to true the first time the user successfully signs in (or when a
// previously-saved token is restored at init). Used to distinguish
// "never signed in this browser" (don't auto-popup OAuth) from "token
// expired mid-session" (do auto-popup so the user doesn't lose context).
let hasEverSignedIn: boolean = false;

/**
 * Load external script dynamically
 */
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
};

/**
 * Update auth status
 */
const updateAuthStatus = (isSignedIn: boolean, error?: string) => {
  const status: DriveAuthStatus = {
    isSignedIn,
    isInitialized,
    isTEorAdmin: currentIsTEorAdmin,
    error,
  };
  authStatusCallbacks.forEach((cb) => {
    try {
      cb(status);
    } catch (err) {
      console.error("authStatusCallback threw:", err);
    }
  });
};

/**
 * Check if token is about to expire (within 5 minutes)
 */
const isTokenExpiringSoon = (): boolean => {
  const savedToken = localStorage.getItem("google_drive_token");
  if (!savedToken) return false;

  try {
    const tokenData = JSON.parse(savedToken);
    return tokenData.expiry - Date.now() < 5 * 60 * 1000;
  } catch {
    return false;
  }
};

/**
 * Check if the stored access token is still valid (not expired).
 * Returns false when the in-memory token is missing OR the persisted
 * token in localStorage has already passed its expiry timestamp.
 *
 * This is the source of truth for "should I attempt an API call?".
 * `isUserSignedIn()` only checks the in-memory variable, which can
 * stay non-null long after Google has invalidated the token.
 */
export const isTokenValid = (): boolean => {
  if (!accessToken) return false;
  const savedToken = localStorage.getItem("google_drive_token");
  if (!savedToken) return false;
  try {
    const tokenData = JSON.parse(savedToken);
    return tokenData.expiry > Date.now();
  } catch {
    return false;
  }
};

/**
 * Notify the consumer (trial-report page) that the token has just expired
 * and an automatic re-auth attempt should be made.
 */
const notifyTokenExpired = (): void => {
  // Clear the stale in-memory state so the next API call fails fast
  // instead of retrying with the same dead token.
  accessToken = null;
  localStorage.removeItem("google_drive_token");
  gapi.client?.setToken?.(null);
  updateAuthStatus(false, "Phiên Google đã hết hạn. Đang đăng nhập lại...");
  // Only fire the proactive re-auth flow if the user has ever signed in
  // during this browser session. On a first visit (no saved token), the
  // host page should just show a "click here to sign in" CTA instead of
  // auto-popping OAuth — otherwise the popup gets blocked by the browser
  // and the user lands on an empty page with no recovery path.
  if (hasEverSignedIn && tokenExpiredCallback) {
    try {
      tokenExpiredCallback();
    } catch (err) {
      console.error("tokenExpiredCallback threw:", err);
    }
  }
};

/**
 * Get remaining time until token expires (in minutes)
 */
const getTokenRemainingTime = (): number => {
  const savedToken = localStorage.getItem("google_drive_token");
  if (!savedToken) return 0;

  try {
    const tokenData = JSON.parse(savedToken);
    return Math.max(0, Math.floor((tokenData.expiry - Date.now()) / (60 * 1000)));
  } catch {
    return 0;
  }
};

/**
 * Silently refresh the token. Tries GIS silent flow with `prompt: ""`.
 * Note: Google deprecated silent refresh for most OAuth clients in 2023,
 * so this is best-effort. When it fails the consumer should fall back to
 * an interactive re-auth via `signInToGoogle()`.
 */
const refreshTokenSilently = async (): Promise<boolean> => {
  if (!tokenClient) return false;

  return new Promise((resolve) => {
    const originalCallback = tokenClient!.callback;

    tokenClient!.callback = (tokenResponse: { error?: string; access_token?: string; expires_in?: number }) => {
      // Restore the previous callback regardless of outcome.
      tokenClient!.callback = originalCallback;

      if (tokenResponse.error || !tokenResponse.access_token) {
        // Silent refresh denied — fall through to interactive re-auth.
        resolve(false);
        return;
      }

      accessToken = tokenResponse.access_token;
      const expiry = Date.now() + (tokenResponse.expires_in || 3600) * 1000;

      localStorage.setItem(
        "google_drive_token",
        JSON.stringify({ access_token: accessToken, expiry })
      );

      gapi.client.setToken({ access_token: accessToken });
      updateAuthStatus(true);
      resolve(true);
    };

    try {
      tokenClient!.requestAccessToken({ prompt: "" });
    } catch {
      resolve(false);
    }
  });
};

/**
 * Start token refresh monitor
 */
let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;

const startTokenRefreshMonitor = () => {
  if (tokenRefreshInterval) clearInterval(tokenRefreshInterval);

  tokenRefreshInterval = setInterval(async () => {
    if (!isUserSignedIn()) return;

    if (isTokenExpiringSoon()) {
      // First try silent refresh; if GIS refuses, fall through to
      // interactive re-auth so the user isn't silently locked out
      // an hour into a session.
      const ok = await refreshTokenSilently();
      if (!ok) {
        notifyTokenExpired();
      }
    }
  }, 60 * 1000);
};

const stopTokenRefreshMonitor = () => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
};

/**
 * Initialize Google Identity Services token client
 */
const initializeGIS = () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse: { error?: string; access_token?: string; expires_in?: number }) => {
      if (tokenResponse.error) {
        updateAuthStatus(false, "Đăng nhập Google thất bại");
        stopTokenRefreshMonitor();
        return;
      }

      accessToken = tokenResponse.access_token!;
      const expiry = Date.now() + (tokenResponse.expires_in || 3600) * 1000;

      localStorage.setItem(
        "google_drive_token",
        JSON.stringify({ access_token: accessToken, expiry })
      );

      gapi.client.setToken({ access_token: accessToken });
      updateAuthStatus(true);
      startTokenRefreshMonitor();
    },
  });
};

/**
 * Initialize Google Drive API
 */
export const initializeGoogleDrive = (): Promise<void> => {
  if (initPromise) return initPromise;

  initPromise = new Promise(async (resolve, reject) => {
    if (!API_KEY) {
      reject(new Error("NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY chưa được cấu hình"));
      return;
    }

    if (!ROOT_FOLDER_ID) {
      reject(new Error("NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER chưa được cấu hình"));
      return;
    }

    const useOAuth = Boolean(CLIENT_ID);

    try {
      // Load scripts
      if (typeof gapi === "undefined") {
        await loadScript("https://apis.google.com/js/api.js");
      }

      if (useOAuth && typeof google === "undefined") {
        await loadScript("https://accounts.google.com/gsi/client");
      }

      // Initialize gapi client
      await new Promise<void>((res, rej) => {
        gapi.load("client", async () => {
          try {
            await gapi.client.init({
              apiKey: API_KEY,
              discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
            });

            if (useOAuth) {
              initializeGIS();

              // Try to restore session
              const savedToken = localStorage.getItem("google_drive_token");
              if (savedToken) {
                try {
                  const tokenData = JSON.parse(savedToken);
                  if (tokenData.expiry > Date.now()) {
                    accessToken = tokenData.access_token;
                    hasEverSignedIn = true;
                    gapi.client.setToken({ access_token: accessToken });
                    updateAuthStatus(true);
                    startTokenRefreshMonitor();
                  } else {
                    localStorage.removeItem("google_drive_token");
                  }
                } catch {
                  localStorage.removeItem("google_drive_token");
                }
              }
            } else {
              updateAuthStatus(false);
            }

            isInitialized = true;
            updateAuthStatus(accessToken !== null);
            resolve();
          } catch (error) {
            rej(error);
          }
        });
      });
    } catch (error) {
      isInitialized = true;
      updateAuthStatus(false, "Không thể khởi tạo Google Drive API");
      reject(error);
    }
  });

  return initPromise;
};

/**
 * Set callback for auth status changes. Supports multiple subscribers — each
 * component can register its own listener and they all receive status
 * updates, which avoids the previous "last writer wins" bug where the
 * `GoogleDriveAuth` component and the trial-report page would compete for
 * the single callback slot.
 */
export const setAuthStatusListener = (callback: (status: DriveAuthStatus) => void) => {
  authStatusCallbacks.add(callback);
  return () => {
    authStatusCallbacks.delete(callback);
  };
};

/**
 * Register a callback that fires when the access token is detected as
 * expired (either by the refresh monitor or by a 401 from the Drive API).
 * The trial-report page uses this to immediately re-open the Google
 * sign-in flow instead of waiting for the user to hit Upload.
 */
export const setTokenExpiredListener = (callback: () => void) => {
  tokenExpiredCallback = callback;
};

/**
 * Set isTEorAdmin status
 */
export const setIsTEorAdmin = (isTEorAdmin: boolean) => {
  currentIsTEorAdmin = isTEorAdmin;
};

/**
 * Re-hydrate the module-level `accessToken` from the persisted
 * `localStorage` token. Needed because browsers may reset or stall
 * module state when a tab is suspended in the background, which makes
 * `isUserSignedIn()` return false even though a valid token still exists.
 */
export const setStoredAccessToken = (token: string): void => {
  accessToken = token;
  hasEverSignedIn = true;
  try {
    if (typeof gapi !== "undefined" && gapi.client?.setToken) {
      gapi.client.setToken({ access_token: token });
    }
  } catch {
    // gapi may not be ready yet; the next init() call will pick the
    // token up from localStorage anyway.
  }
};

/**
 * Sign in to Google
 */
export const signInToGoogle = async (): Promise<void> => {
  if (!tokenClient) {
    throw new Error("OAuth không khả dụng. Vui lòng cấu hình NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID");
  }

  return new Promise((resolve, reject) => {
    // Safety net: GIS has documented cases where the callback is
    // never fired (popup closed before tokenClient.requestAccessToken
    // wires up its handler, OAuth iframe terminated by browser while
    // loading). Without this guard, the wrapping UI button would
    // stick on "loading" forever and the user would have to refresh
    // the page to recover.
    const TIMEOUT_MS = 60_000;
    const timeoutHandle = setTimeout(() => {
      tokenClient!.callback = originalCallback;
      reject(
        new Error(
          "Google không phản hồi (timeout). Vui lòng thử lại hoặc kiểm tra popup blocker.",
        ),
      );
    }, TIMEOUT_MS);

    const originalCallback = tokenClient!.callback;

    tokenClient!.callback = (tokenResponse: { error?: string; access_token?: string; expires_in?: number }) => {
      clearTimeout(timeoutHandle);
      if (tokenResponse.error) {
        tokenClient!.callback = originalCallback;
        reject(new Error("Đăng nhập Google thất bại"));
        return;
      }

      accessToken = tokenResponse.access_token!;
      const expiry = Date.now() + (tokenResponse.expires_in || 3600) * 1000;

      localStorage.setItem(
        "google_drive_token",
        JSON.stringify({ access_token: accessToken, expiry })
      );

      gapi.client.setToken({ access_token: accessToken });
      hasEverSignedIn = true;
      updateAuthStatus(true);
      startTokenRefreshMonitor();
      tokenClient!.callback = originalCallback;
      resolve();
    };

    tokenClient!.requestAccessToken({ prompt: "consent" });
  });
};

/**
 * Sign out from Google
 */
export const signOutFromGoogle = async (): Promise<void> => {
  stopTokenRefreshMonitor();

  if (accessToken && typeof google !== "undefined") {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }

  gapi.client.setToken(null);
  accessToken = null;
  hasEverSignedIn = false;
  localStorage.removeItem("google_drive_token");
  updateAuthStatus(false);
};

/**
 * Check if user is signed in
 */
export const isUserSignedIn = (): boolean => {
  return accessToken !== null;
};

/**
 * Check if OAuth is available
 */
export const isOAuthAvailable = (): boolean => {
  return Boolean(CLIENT_ID && tokenClient);
};

/**
 * Get token information
 */
export const getTokenInfo = (): TokenInfo => {
  const savedToken = localStorage.getItem("google_drive_token");
  if (!savedToken) {
    return { remainingMinutes: 0, isExpiringSoon: false, expiryTime: null };
  }

  try {
    const tokenData = JSON.parse(savedToken);
    const remainingMs = tokenData.expiry - Date.now();
    return {
      remainingMinutes: Math.max(0, Math.floor(remainingMs / (60 * 1000))),
      isExpiringSoon: remainingMs < 5 * 60 * 1000,
      expiryTime: new Date(tokenData.expiry),
    };
  } catch {
    return { remainingMinutes: 0, isExpiringSoon: false, expiryTime: null };
  }
};

/**
 * Guard for Drive API calls. Use this at the top of any function that
 * hits the Drive REST API: it throws if the token is missing or expired,
 * and triggers the proactive re-auth flow so the user is sent back to
 * the Google consent screen immediately rather than seeing a cryptic
 * "Failed to load" message.
 */
const assertTokenValid = (op: string): void => {
  if (isTokenValid()) return;
  // Mark the token as expired and ask the host page to re-auth.
  notifyTokenExpired();
  throw new Error(`Phiên Google đã hết hạn. Đang đăng nhập lại... (${op})`);
};

/**
 * Inspect a Drive API error and, if it looks like a 401/403 from an
 * expired/invalidated token, kick off the re-auth flow. Returns the
 * parsed status so the caller can decide what to do.
 */
const handleDriveApiError = (error: unknown, op: string): { shouldReauth: boolean; message: string } => {
  // gapi errors come through as objects with `result.error.code` and
  // `result.error.message`. Raw fetch errors come through as
  // `TypeError`. We try a few shapes defensively.
  const anyErr = error as any;
  const code =
    anyErr?.result?.error?.code ??
    anyErr?.status ??
    anyErr?.response?.status ??
    null;

  if (code === 401 || code === 403) {
    notifyTokenExpired();
    return {
      shouldReauth: true,
      message: `Phiên Google đã hết hạn khi ${op}. Đang đăng nhập lại...`,
    };
  }

  return {
    shouldReauth: false,
    message: anyErr?.result?.error?.message || anyErr?.message || `Drive API call failed: ${op}`,
  };
};

/**
 * Get folder by name, create if not exists
 */
const getOrCreateFolder = async (folderName: string, parentId: string): Promise<string> => {
  assertTokenValid("tạo thư mục");
  const response = await gapi.client.drive.files.list({
    q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    pageSize: 1,
  });

  if (response.result.files && response.result.files.length > 0) {
    return response.result.files[0].id;
  }

  const createResponse = await gapi.client.drive.files.create({
    resource: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  return createResponse.result.id;
};

/**
 * List files in a folder
 */
export const listFilesInFolder = async (folderId: string = ROOT_FOLDER_ID): Promise<DriveFile[]> => {
  assertTokenValid("tải danh sách file");
  try {
    const response = await gapi.client.drive.files.list({
      // Exclude Google Drive folders — they would otherwise show up as
      // clickable file entries and the sidebar would misclassify them.
      // Folders are handled by `listFoldersInFolder` instead.
      q: `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name, mimeType, createdTime, modifiedTime, size, webViewLink, webContentLink, thumbnailLink, parents, owners)",
      orderBy: "folder,name",
      pageSize: 1000,
    });
    return response.result.files || [];
  } catch (error) {
    throw handleDriveApiError(error, "tải danh sách file");
  }
};

/**
 * List folders in a folder
 */
export const listFoldersInFolder = async (folderId: string = ROOT_FOLDER_ID): Promise<DriveFolder[]> => {
  assertTokenValid("tải danh sách thư mục");
  try {
    const response = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name, mimeType, createdTime, modifiedTime, parents)",
      orderBy: "name",
      pageSize: 1000,
    });
    return (response.result.files || []) as DriveFolder[];
  } catch (error) {
    throw handleDriveApiError(error, "tải danh sách thư mục");
  }
};

/**
 * Upload PDF file to specific folder structure
 *
 * Auto-creates folder hierarchy: Year > Month > Day > Teacher.
 * Returns metadata for the newly created file (id, webViewLink, etc.).
 * Backend code should follow up by POSTing this metadata to
 * `/trial-report/reports/register` so the file shows up in Mongo.
 */
export const uploadPDFFile = async (params: UploadParams): Promise<UploadedFileMeta> => {
  assertTokenValid("upload file");
  // Note: this endpoint uses fetch() rather than gapi.client, so we
  // handle 401 from the response object directly.
  const token = gapi.client.getToken()?.access_token;
  if (!token) {
    notifyTokenExpired();
    throw new Error("Phiên Google đã hết hạn. Đang đăng nhập lại...");
  }

  // Create folder structure: Year > Month > Day > Teacher
  const yearFolder = await getOrCreateFolder(params.year, ROOT_FOLDER_ID);
  const monthFolder = await getOrCreateFolder(`${params.month}/${params.year}`, yearFolder);
  const dayFolder = await getOrCreateFolder(params.day, monthFolder);
  const teacherFolder = await getOrCreateFolder(params.teacher, dayFolder);

  // Prepare file metadata
  const metadata = {
    name: `${params.studentName}.pdf`,
    mimeType: "application/pdf",
    parents: [teacherFolder],
  };

  // Create multipart upload
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", params.file);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    }
  );

  if (response.status === 401 || response.status === 403) {
    notifyTokenExpired();
    throw new Error("Phiên Google đã hết hạn khi upload. Đang đăng nhập lại...");
  }

  if (!response.ok) {
    throw new Error("Upload thất bại");
  }

  const result = await response.json();
  const fileId: string = result.id;

  // Fetch full metadata (size, webViewLink, etc.) — the multipart
  // upload endpoint only returns `{ id }`.
  try {
    const meta = await gapi.client.drive.files.get({
      fileId,
      fields:
        "id,name,mimeType,size,webViewLink,webContentLink,parents,createdTime",
    });
    const f = meta.result || {};
    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size ? Number(f.size) : null,
      webViewLink: f.webViewLink || null,
      webContentLink: f.webContentLink || null,
      parents: f.parents || [],
      createdTime: f.createdTime || null,
    };
  } catch (err) {
    // Fall back to whatever the multipart response gave us — better
    // than throwing away the upload entirely.
    return {
      id: fileId,
      name: `${params.studentName}.pdf`,
      mimeType: "application/pdf",
      size: params.file?.size ? Number(params.file.size) : null,
      webViewLink: null,
      webContentLink: null,
      parents: [],
      createdTime: null,
    };
  }
};

/**
 * Delete file
 */
export const deleteFile = async (fileId: string): Promise<void> => {
  assertTokenValid("xóa file");
  try {
    await gapi.client.drive.files.delete({ fileId });
  } catch (error) {
    throw handleDriveApiError(error, "xóa file");
  }
};

/**
 * Get user info from access token
 */
export const getGoogleUserInfo = async (): Promise<{ email: string; name: string } | null> => {
  if (!accessToken) return null;
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return { email: data.email || "", name: data.name || "" };
  } catch {
    return null;
  }
};

/**
 * Get root folder ID
 */
export const getRootFolderId = (): string => {
  return ROOT_FOLDER_ID;
};
