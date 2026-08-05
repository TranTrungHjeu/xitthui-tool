export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  owners?: Array<{ emailAddress: string; displayName: string }>;
}

export interface DriveFolder {
  id: string;
  name: string;
  mimeType: "application/vnd.google-apps.folder";
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
}

export interface DriveAuthStatus {
  isSignedIn: boolean;
  isInitialized: boolean;
  isTEorAdmin: boolean;
  error?: string;
  /**
   * True when an API call just failed because the access token was rejected
   * (401). Consumers should use this to trigger an automatic re-auth flow
   * rather than show a generic error.
   */
  tokenExpired?: boolean;
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
  webContentLink: string | null;
  parents: string[];
  createdTime: string | null;
}

export interface TokenInfo {
  remainingMinutes: number;
  isExpiringSoon: boolean;
  expiryTime: Date | null;
}
