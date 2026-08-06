import { mkdirSync } from "node:fs";
import path from "node:path";

export interface ArchiveConfig {
  databasePath: string; archiveRoot: string; timeoutMs: number; maxBytes: number;
  maxRedirects: number; maxConcurrent: number; rateWindowMs: number;
  maxSubmissionsPerWindow: number; maxStoredBytes: number;
  assetMaxBytes: number; assetTotalMaxBytes: number; assetMaxCount: number; assetTimeoutMs: number;
  renderedMaxRequests: number; renderedMaxBytes: number; renderedSettleTimeoutMs: number;
}
export type ArchiveConfigInput = Partial<ArchiveConfig>;

function positive(name: string, input: number | string | undefined, fallback: number, allowZero = false): number {
  const value = input === undefined ? fallback : Number(input);
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) throw new Error(`${name} must be a ${allowZero ? "non-negative" : "positive"} integer`);
  return value;
}

export function resolveArchiveConfig(input: ArchiveConfigInput = {}): ArchiveConfig {
  const databasePath = path.resolve(input.databasePath ?? process.env.ARCHIVE_DATABASE_PATH ?? "data/archive.db");
  const archiveRoot = path.resolve(input.archiveRoot ?? process.env.ARCHIVE_STORAGE_ROOT ?? "data/archives");
  mkdirSync(path.dirname(databasePath), { recursive: true }); mkdirSync(archiveRoot, { recursive: true });
  return {
    databasePath, archiveRoot,
    timeoutMs: positive("ARCHIVE_CAPTURE_TIMEOUT_MS", input.timeoutMs ?? process.env.ARCHIVE_CAPTURE_TIMEOUT_MS, 10_000),
    maxBytes: positive("ARCHIVE_CAPTURE_MAX_BYTES", input.maxBytes ?? process.env.ARCHIVE_CAPTURE_MAX_BYTES, 5 * 1024 * 1024),
    maxRedirects: positive("ARCHIVE_CAPTURE_MAX_REDIRECTS", input.maxRedirects ?? process.env.ARCHIVE_CAPTURE_MAX_REDIRECTS, 5, true),
    maxConcurrent: positive("ARCHIVE_CAPTURE_CONCURRENCY", input.maxConcurrent ?? process.env.ARCHIVE_CAPTURE_CONCURRENCY, 4),
    rateWindowMs: positive("ARCHIVE_RATE_WINDOW_MS", input.rateWindowMs ?? process.env.ARCHIVE_RATE_WINDOW_MS, 60_000),
    maxSubmissionsPerWindow: positive("ARCHIVE_RATE_MAX_SUBMISSIONS", input.maxSubmissionsPerWindow ?? process.env.ARCHIVE_RATE_MAX_SUBMISSIONS, 30),
    maxStoredBytes: positive("ARCHIVE_STORAGE_MAX_BYTES", input.maxStoredBytes ?? process.env.ARCHIVE_STORAGE_MAX_BYTES, 1024 * 1024 * 1024),
    assetMaxBytes: positive("ARCHIVE_ASSET_MAX_BYTES", input.assetMaxBytes ?? process.env.ARCHIVE_ASSET_MAX_BYTES, 10 * 1024 * 1024),
    assetTotalMaxBytes: positive("ARCHIVE_ASSET_TOTAL_MAX_BYTES", input.assetTotalMaxBytes ?? process.env.ARCHIVE_ASSET_TOTAL_MAX_BYTES, 50 * 1024 * 1024),
    assetMaxCount: positive("ARCHIVE_ASSET_MAX_COUNT", input.assetMaxCount ?? process.env.ARCHIVE_ASSET_MAX_COUNT, 20),
    assetTimeoutMs: positive("ARCHIVE_ASSET_TIMEOUT_MS", input.assetTimeoutMs ?? process.env.ARCHIVE_ASSET_TIMEOUT_MS, 10_000),
    renderedMaxRequests: positive("ARCHIVE_RENDERED_MAX_REQUESTS", input.renderedMaxRequests ?? process.env.ARCHIVE_RENDERED_MAX_REQUESTS, 100),
    renderedMaxBytes: positive("ARCHIVE_RENDERED_MAX_BYTES", input.renderedMaxBytes ?? process.env.ARCHIVE_RENDERED_MAX_BYTES, 10 * 1024 * 1024),
    renderedSettleTimeoutMs: positive("ARCHIVE_RENDERED_SETTLE_TIMEOUT_MS", input.renderedSettleTimeoutMs ?? process.env.ARCHIVE_RENDERED_SETTLE_TIMEOUT_MS, 2_000),
  };
}
