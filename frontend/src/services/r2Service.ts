/**
 * Frontend Cloudflare R2 storage service.
 *
 * Replaces `oneDriveService.ts` (now retired). The trial-reportUI
 * imports the storage types + helpers from here.
 *
 * Difference vs the previous OneDrive service:
 *   - No device-code auth flow. The backend authenticates to R2 with
 *     a static Access Key (no per-user token, no expiry).
 *   - Files download via a *presigned* URL — the backend hands us a
 *     signed R2 URL and the browser opens it directly. This means
 *     the backend never sees the file bytes on download.
 *   - Storage "folders" are really key prefixes in a flat bucket;
 *     `listChildren` mimics the folder view with `CommonPrefixes`
 *     from the S3 API.
 */

import api from "./api";

// Storage types — matching the FE/browser shape we used for OneDrive
// so the trial-report UI can swap providers without restructuring.
// `id` is the S3 object key (or, for folders, the prefix). For files
// `webViewLink` is populated with a presigned download URL by the
// upload endpoint.
export interface StorageItem {
  id: string;
  name: string;
  size: number | null;
  webViewLink: string | null;
  createdDate: string | null;
  mimeType: string | null;
  childCount?: number | null;
}

export interface StorageFolder extends StorageItem {
  childCount: number | null;
}

export interface UploadParams {
  year: string;
  month: string;
  day: string;
  teacher: string;
  studentName: string;
  file: File;
}

export interface UploadedFileMeta {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  webViewLink: string | null;
  parentFolderId: string | null;
}

interface StorageListResponse {
  success: boolean;
  data?: {
    folders: StorageFolder[];
    files: StorageItem[];
  };
  error?: string;
}

interface UploadResponse {
  success: boolean;
  data?: {
    id: string;
    key: string;
    name: string;
    size: number | null;
    contentType?: string | null;
    webViewLink: string | null;
    parentPath?: string;
    parentId?: string | null;
  };
  error?: string;
}

interface DownloadResponse {
  success: boolean;
  data?: {
    url: string;
    expiresIn: number;
  };
  error?: string;
}

interface DeleteResponse {
  success: boolean;
  data?: { deleted: boolean; alreadyMissing?: boolean };
  error?: string;
}

function splitPath(path: string | null | undefined): string[] {
  return (path || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildUploadFormData(params: UploadParams): FormData {
  const form = new FormData();
  form.append("file", params.file, params.file.name || `${params.studentName}.pdf`);
  form.append("year", params.year);
  form.append("month", params.month);
  form.append("day", params.day);
  form.append("teacher", params.teacher);
  form.append("studentName", params.studentName);
  return form;
}

export const listChildren = async (
  path: string | null,
): Promise<{ folders: StorageFolder[]; files: StorageItem[] }> => {
  const segments = splitPath(path);
  const params: Record<string, string> = {};
  if (segments.length > 0) params.path = segments.join("/");

  const res = await api.get<StorageListResponse>("/r2/storage/list", { params });
  if (!res.data.success || !res.data.data) {
    const message = res.data.error || "Không thể tải danh sách lưu trữ";
    const err = new Error(message);
    (err as any).response = res;
    throw err;
  }
  return res.data.data;
};

export const listFoldersInFolder = async (
  path: string | null = null,
): Promise<StorageFolder[]> => {
  const { folders } = await listChildren(path);
  return folders;
};

export const listFilesInFolder = async (
  path: string | null = null,
): Promise<StorageItem[]> => {
  const { files } = await listChildren(path);
  return files;
};

/**
 * Upload a PDF via multipart. The backend pushes the buffer to R2 and
 * returns the resulting object key + a fresh presigned download URL.
 */
export const uploadPDFFile = async (
  params: UploadParams,
): Promise<UploadedFileMeta> => {
  const form = buildUploadFormData(params);
  const res = await api.post<UploadResponse>("/r2/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  if (!res.data.success || !res.data.data) {
    const message = res.data.error || "Upload lên R2 thất bại";
    const err = new Error(message);
    (err as any).response = res;
    throw err;
  }

  const item = res.data.data;
  return {
    id: item.id || "",
    name: item.name || params.file.name || `${params.studentName}.pdf`,
    mimeType: item.contentType || "application/pdf",
    size: typeof item.size === "number" ? item.size : params.file.size ?? null,
    webViewLink: item.webViewLink || null,
    parentFolderId: item.key || item.parentPath || null,
  };
};

/**
 * Mint a fresh presigned download URL for an existing object. The
 * FE typically uses this when re-opening a file after the original
 * `webViewLink` has expired (default 1h).
 *
 * @param {string} key - R2 object key returned by `uploadPDFFile`
 * @param {number} [ttlSeconds] - override the default expiry
 * @param {string} [filename] - when set, the generated URL carries
 *   a Content-Disposition: attachment header so the browser saves
 *   the file instead of opening it inline (PDF preview).
 */
export const getDownloadUrl = async (
  key: string,
  ttlSeconds?: number,
  filename?: string,
): Promise<string> => {
  const params: Record<string, string> = { key };
  if (ttlSeconds) params.ttl = String(ttlSeconds);
  if (filename) params.filename = filename;
  const res = await api.get<DownloadResponse>("/r2/storage/download", { params });
  if (!res.data.success || !res.data.data) {
    const err = new Error(res.data.error || "Không thể tạo link tải");
    (err as any).response = res;
    throw err;
  }
  return res.data.data.url;
};

/**
 * Hard-delete an R2 object. Missing objects are treated as success
 * (matches the OneDrive delete semantics).
 */
export const deleteObject = async (key: string): Promise<void> => {
  const res = await api.delete<DeleteResponse>("/r2/storage/object", {
    data: { key },
  });
  if (!res.data.success) {
    const err = new Error(res.data.error || "Xóa file thất bại");
    (err as any).response = res;
    throw err;
  }
};

/**
 * Returns the root path the FE should use when no folder is selected.
 * R2 has no real "root folder id" — we pass `null` to list bucket
 * root.
 */
export const getRootFolderId = (): string => "";

/**
 * Cheap health probe used by the FE to decide whether to render the
 * storage indicator. Returns `true` when R2 is reachable + the bucket
 * is accessible, `false` otherwise.
 */
export const checkHealth = async (): Promise<boolean> => {
  try {
    const res = await api.get("/r2/storage/health");
    return !!res.data?.success;
  } catch {
    return false;
  }
};