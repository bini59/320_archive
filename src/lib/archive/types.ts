export const ARCHIVE_STATUSES = ["pending", "saved", "failed"] as const;
export type ArchiveStatus = (typeof ARCHIVE_STATUSES)[number];
export const CAPTURE_FAILURE_MESSAGES = { invalid_url: "안전하게 접근할 수 없는 URL입니다.", network: "페이지에 연결할 수 없습니다.", timeout: "페이지 응답 시간이 초과되었습니다.", not_html: "HTML 페이지가 아닙니다.", unsupported_mime: "지원하지 않는 콘텐츠 형식입니다.", too_large: "페이지가 허용된 크기를 초과했습니다.", too_many_requests: "페이지의 요청 수가 허용된 한도를 초과했습니다.", redirect: "리디렉션이 너무 많거나 안전하지 않습니다.", overloaded: "현재 캡처 요청이 많습니다. 잠시 후 다시 시도해 주세요.", rate_limited: "요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.", quota_exceeded: "저장 공간 한도에 도달했습니다.", capture_failed: "페이지를 저장하지 못했습니다." } as const;
export type CaptureFailureCode = keyof typeof CAPTURE_FAILURE_MESSAGES;
export const RETRYABLE_CAPTURE_FAILURE_CODES = ["network", "timeout", "too_many_requests", "overloaded", "rate_limited", "quota_exceeded", "capture_failed"] as const satisfies readonly CaptureFailureCode[];
export type RetryableCaptureFailureCode = (typeof RETRYABLE_CAPTURE_FAILURE_CODES)[number];
export function isRetryableCaptureFailure(code: CaptureFailureCode | null): code is RetryableCaptureFailureCode {
  return code !== null && (RETRYABLE_CAPTURE_FAILURE_CODES as readonly string[]).includes(code);
}
export type ArchiveVisibility = "private" | "public";
export interface User { id: string; email: string | null; name: string | null; avatarUrl: string | null; status: "active" | "disabled"; membershipRole: string | null; membershipStatus: string | null; createdAt: string; updatedAt: string }
export interface Folder { id: string; ownerId: string; name: string; createdAt: string; updatedAt: string }
export interface Snapshot { title: string | null; description: string | null; capturedAt: string; finalUrl: string; byteLength: number }
export interface Archive { id: string; ownerId: string; folderId: string | null; visibility: ArchiveVisibility; originalUrl: string; normalizedUrl: string; status: ArchiveStatus; createdAt: string; snapshot: Snapshot | null; failureCode: CaptureFailureCode | null; failureMessage: string | null; tags: Tag[] }
export const ARCHIVE_SEARCH_QUERY_MAX_LENGTH = 200;
export const ARCHIVE_SEARCH_MAX_TOKENS = 12;
export const ARCHIVE_LIST_PAGE_SIZE = 20;
export const ARCHIVE_LIST_MAX_PAGE = 1000;
export const ARCHIVE_TAG_MAX_COUNT = 10;
export const ARCHIVE_TAG_MAX_LENGTH = 32;
export const ARCHIVE_INDEX_TEXT_MAX_LENGTH = 1_000_000;
export interface Tag { name: string; slug: string }
export interface PublicArchiveItem { id: string; originalUrl: string; title: string | null; description: string | null; capturedAt: string; tags: Tag[] }
export interface PublicArchiveQuery { q?: string; tag?: string; page?: number }
export interface PublicArchiveResult { items: PublicArchiveItem[]; total: number; page: number; pageSize: number; pageCount: number }
export interface ArchiveCreationResult { archive: Archive; created: boolean }
export interface ArchiveRetryResult { archive: Archive; started: boolean }
export interface BudgetReservation { release(): void; finalizeSaved(input: { archiveId: string; snapshot: Snapshot; indexText: string; tags: Tag[]; byteLength: number }): Archive | null }
export interface ArchiveRepository {
  createOrGet(input: { ownerId?: string; folderId?: string | null; visibility?: ArchiveVisibility; originalUrl: string; normalizedUrl: string; tags?: Tag[] }): ArchiveCreationResult;
  findById(id: string): Archive | null;
  findOwnedById(ownerId: string, id: string): Archive | null;
  findPublicById(id: string): Archive | null;
  listOwned(ownerId: string, folderId?: string | null): Archive[];
  markSaved(id: string, snapshot: Snapshot, indexText?: string, tags?: Tag[]): Archive | null;
  markFailed(id: string, code: CaptureFailureCode, message: string): Archive | null;
  claimRetry(ownerId: string, id: string): Archive | null;
  listPublic(query: PublicArchiveQuery): PublicArchiveResult;
  upsertUser(input: { id: string; email: string | null; name: string | null; avatarUrl: string | null; membershipRole: string | null; membershipStatus: string | null }): User;
  findUser(id: string): User | null;
  createFolder(ownerId: string, name: string): Folder;
  listFolders(ownerId: string): Folder[];
  deleteFolder(ownerId: string, id: string): boolean;
  renameFolder(ownerId: string, id: string, name: string): Folder | null;
  setVisibility(ownerId: string, id: string, visibility: ArchiveVisibility): boolean;
  reserveBudget(input: { windowMs: number; maxSubmissions: number; maxStoredBytes: number; reserveBytes: number; timeoutMs: number }): BudgetReservation | null;
  close(): void;
}
export interface CapturedPage { bytes: Uint8Array; finalUrl: string; contentType: string; rendered?: Uint8Array; renderedAssets?: CapturedAsset[] }
export interface CaptureContext { archiveId: string }
export interface CaptureClient { capture(url: string, signal?: AbortSignal, context?: CaptureContext): Promise<CapturedPage>; close?(): Promise<void> | void }
export const ASSET_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "application/pdf", "text/plain"] as const;
export const RENDERED_ASSET_MIME_TYPES = ["text/css", "font/woff", "font/woff2", "font/ttf", "font/otf", "application/font-woff", "application/vnd.ms-fontobject"] as const;
export const STORED_ASSET_MIME_TYPES = [...ASSET_MIME_TYPES, ...RENDERED_ASSET_MIME_TYPES] as const;
export type AssetMimeType = (typeof STORED_ASSET_MIME_TYPES)[number];
export type AssetKey = string & { readonly __assetKey: unique symbol };
export interface Asset { originalUrl: string; finalUrl: string; mimeType: AssetMimeType; byteLength: number; key: AssetKey }
export interface AssetManifest { version: 1; assets: Asset[]; storedByteLength?: number }
export interface CapturedAsset { originalUrl: string; finalUrl: string; mimeType: AssetMimeType; bytes: Uint8Array }
export interface AssetFetcher { fetch(url: string, signal?: AbortSignal): Promise<CapturedAsset> }
export interface StoredAsset { asset: Asset; bytes: Uint8Array }
export type SnapshotContentKind = "original" | "readable" | "rendered";
export interface SnapshotContent { kind: SnapshotContentKind; bytes: Uint8Array }
export class SnapshotContentNotFoundError extends Error { constructor(readonly archiveId: string, readonly kind: SnapshotContentKind) { super(`Snapshot content not found: ${kind}`); this.name = "SnapshotContentNotFoundError" } }
export interface SnapshotStore { save(archiveId: string, original: Uint8Array, readable: Uint8Array, snapshot: Snapshot, assets?: CapturedAsset[], rendered?: Uint8Array | null): Promise<AssetManifest>; read(archiveId: string, kind: SnapshotContentKind): Promise<SnapshotContent>; readAsset(archiveId: string, key: AssetKey | string): Promise<StoredAsset>; cleanup(archiveId: string): Promise<void> }
