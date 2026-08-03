export const ARCHIVE_STATUSES = ["pending", "saved", "failed"] as const;
export type ArchiveStatus = (typeof ARCHIVE_STATUSES)[number];

export const CAPTURE_FAILURE_MESSAGES = {
  invalid_url: "안전하게 접근할 수 없는 URL입니다.",
  network: "페이지에 연결할 수 없습니다.",
  timeout: "페이지 응답 시간이 초과되었습니다.",
  not_html: "HTML 페이지가 아닙니다.",
  unsupported_mime: "지원하지 않는 콘텐츠 형식입니다.",
  too_large: "페이지가 허용된 크기를 초과했습니다.",
  redirect: "리디렉션이 너무 많거나 안전하지 않습니다.",
  overloaded: "현재 캡처 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
  rate_limited: "요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
  quota_exceeded: "저장 공간 한도에 도달했습니다.",
  capture_failed: "페이지를 저장하지 못했습니다.",
} as const;
export type CaptureFailureCode = keyof typeof CAPTURE_FAILURE_MESSAGES;

export interface Snapshot {
  title: string | null;
  description: string | null;
  capturedAt: string;
  finalUrl: string;
  byteLength: number;
}

export interface Archive {
  id: string;
  originalUrl: string;
  normalizedUrl: string;
  status: ArchiveStatus;
  createdAt: string;
  snapshot: Snapshot | null;
  failureCode: CaptureFailureCode | null;
  failureMessage: string | null;
}

export interface ArchiveCreationResult { archive: Archive; created: boolean }
export interface BudgetReservation { release(): void; commit(byteLength: number): boolean }

export interface ArchiveRepository {
  createOrGet(input: { originalUrl: string; normalizedUrl: string }): ArchiveCreationResult;
  findById(id: string): Archive | null;
  markSaved(id: string, snapshot: Snapshot): Archive | null;
  markFailed(id: string, code: CaptureFailureCode, message: string): Archive | null;
  reserveBudget(input: { windowMs: number; maxSubmissions: number; maxStoredBytes: number; reserveBytes: number; timeoutMs: number }): BudgetReservation | null;
  close(): void;
}

export interface CapturedPage { bytes: Uint8Array; finalUrl: string; contentType: string }
export interface CaptureClient { capture(url: string, signal?: AbortSignal): Promise<CapturedPage> }
export const ASSET_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "application/pdf", "text/plain"] as const;
export type AssetMimeType = (typeof ASSET_MIME_TYPES)[number];
/** A server-generated opaque key. It is never derived from a remote filename. */
export type AssetKey = string & { readonly __assetKey: unique symbol };
export interface Asset { originalUrl: string; finalUrl: string; mimeType: AssetMimeType; byteLength: number; key: AssetKey }
export interface AssetManifest { version: 1; assets: Asset[] }
export interface CapturedAsset { originalUrl: string; finalUrl: string; mimeType: AssetMimeType; bytes: Uint8Array }
export interface AssetFetcher { fetch(url: string, signal?: AbortSignal): Promise<CapturedAsset> }
export interface StoredAsset { asset: Asset; bytes: Uint8Array }
export type SnapshotContentKind = "original" | "readable";
export interface SnapshotContent { kind: SnapshotContentKind; bytes: Uint8Array }
export class SnapshotContentNotFoundError extends Error {
  constructor(readonly archiveId: string, readonly kind: SnapshotContentKind) {
    super(`Snapshot content not found: ${kind}`);
    this.name = "SnapshotContentNotFoundError";
  }
}
export interface SnapshotStore {
  save(archiveId: string, original: Uint8Array, readable: Uint8Array, snapshot: Snapshot, assets?: CapturedAsset[]): Promise<AssetManifest>;
  read(archiveId: string, kind: SnapshotContentKind): Promise<SnapshotContent>;
  readAsset(archiveId: string, key: AssetKey | string): Promise<StoredAsset>;
  cleanup(archiveId: string): Promise<void>;
}
