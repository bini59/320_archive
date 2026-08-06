import { resolveArchiveConfig, type ArchiveConfigInput } from "./config";
import { SqliteArchiveRepository } from "./database";
import { SafeAssetFetcher } from "./asset-fetcher";
import { BrowserCaptureClient } from "./browser-capture";
import { CaptureError } from "./fetcher";
import { discoverAssetCandidates, rewriteAssetReferences } from "./assets";
import { extractHtmlMetadata } from "./html";
import { ImmediateSemaphore } from "./limiter";
import { createReadableHtml, extractReadableText } from "./readable";
import { LocalSnapshotStore } from "./storage";
import {
  CAPTURE_FAILURE_MESSAGES,
  type Archive,
  type ArchiveCreationResult,
  type ArchiveRepository,
  type AssetFetcher,
  type CaptureClient,
  type CaptureFailureCode,
  type PublicArchiveQuery,
  type PublicArchiveResult,
  type SnapshotContent,
  type SnapshotContentKind,
  type SnapshotStore,
  type StoredAsset,
} from "./types";
import { normalizeArchiveUrl } from "./url";
import { parseTags } from "./tags";

export class ArchiveService {
  constructor(
    private readonly repository: ArchiveRepository,
    private readonly store: SnapshotStore,
    private readonly capture: CaptureClient,
    private readonly limiter: ImmediateSemaphore,
    private readonly budget: { windowMs: number; maxSubmissions: number; maxStoredBytes: number; reserveBytes: number; timeoutMs: number },
    private readonly assetFetcher?: AssetFetcher,
    private readonly assetLimits = { maxCount: 20, maxBytes: 50 * 1024 * 1024, timeoutMs: 10_000 },
  ) {}

  async create(originalUrl: string, tagsInput = ""): Promise<ArchiveCreationResult> {
    const normalizedUrl = normalizeArchiveUrl(originalUrl);
    const tags = parseTags(tagsInput);
    const result = this.repository.createOrGet({ originalUrl, normalizedUrl, tags });
    if (!result.created) return result;

    const release = this.limiter.tryAcquire();
    if (!release) return { archive: this.fail(result.archive.id, "overloaded"), created: true };
    const reservation = this.repository.reserveBudget(this.budget);
    if (!reservation) {
      release();
      return { archive: this.fail(result.archive.id, "rate_limited"), created: true };
    }

    try {
      const page = await this.capture.capture(normalizedUrl, undefined, { archiveId: result.archive.id });
      const meta = extractHtmlMetadata(page.bytes);
      const source = new TextDecoder().decode(page.bytes);
      const assets = page.renderedAssets ?? await this.captureLegacyAssets(source, page.finalUrl);
      const assetBytes = assets.reduce((total, asset) => total + asset.bytes.byteLength, 0);
      const rewritten = Buffer.from(rewriteAssetReferences(source, page.finalUrl, result.archive.id, assets));
      const readable = createReadableHtml(rewritten);
      const rendered = page.rendered ?? null;
      const snapshot = {
        ...meta,
        capturedAt: new Date().toISOString(),
        finalUrl: page.finalUrl,
        byteLength: page.bytes.byteLength,
      };

      await this.store.save(result.archive.id, page.bytes, readable, snapshot, assets, rendered);
      const saved = reservation.finalizeSaved({
        archiveId: result.archive.id,
        snapshot,
        indexText: extractReadableText(readable),
        tags,
        byteLength: page.bytes.byteLength + assetBytes + (rendered?.byteLength ?? 0),
      });
      if (!saved) {
        await this.store.cleanup(result.archive.id);
        return { archive: this.fail(result.archive.id, "quota_exceeded"), created: true };
      }
      return { archive: saved, created: true };
    } catch (error) {
      reservation.release();
      await this.store.cleanup(result.archive.id).catch(() => undefined);
      const code: CaptureFailureCode = error instanceof CaptureError ? error.code : "capture_failed";
      return { archive: this.fail(result.archive.id, code), created: true };
    } finally {
      release();
    }
  }

  private async captureLegacyAssets(source: string, finalUrl: string): Promise<Awaited<ReturnType<AssetFetcher["fetch"]>>[]> {
    if (!this.assetFetcher) return [];
    const assets: Awaited<ReturnType<AssetFetcher["fetch"]>>[] = [];
    const assetController = new AbortController();
    const assetDeadline = setTimeout(() => assetController.abort(), this.assetLimits.timeoutMs);
    let assetBytes = 0;
    try {
      for (const candidate of discoverAssetCandidates(source, finalUrl, this.assetLimits.maxCount)) {
        if (assetController.signal.aborted) break;
        try {
          const asset = await this.assetFetcher.fetch(candidate.url, assetController.signal);
          const compatible = candidate.kind === "image"
            ? asset.mimeType.startsWith("image/")
            : asset.mimeType === "application/pdf" || asset.mimeType === "text/plain";
          if (!compatible) continue;
          if (assetBytes + asset.bytes.byteLength > this.assetLimits.maxBytes) break;
          assets.push(asset);
          assetBytes += asset.bytes.byteLength;
        } catch {
          // A single optional asset must not make the primary archive fail.
        }
      }
    } finally {
      clearTimeout(assetDeadline);
    }
    return assets;
  }

  listPublic(query: PublicArchiveQuery = {}): PublicArchiveResult { return this.repository.listPublic(query); }

  private fail(id: string, code: CaptureFailureCode) {
    return this.repository.markFailed(id, code, CAPTURE_FAILURE_MESSAGES[code])!;
  }

  findById(id: string): Archive | null { return this.repository.findById(id); }

  async findContent(id: string, kind: SnapshotContentKind): Promise<{ archive: Archive; content: SnapshotContent } | null> {
    const archive = this.repository.findById(id);
    if (!archive || archive.status !== "saved" || !archive.snapshot) return null;
    return { archive, content: await this.store.read(id, kind) };
  }

  async findAsset(id: string, key: string): Promise<{ archive: Archive; stored: StoredAsset } | null> {
    const archive = this.repository.findById(id);
    if (!archive || archive.status !== "saved" || !archive.snapshot) return null;
    return { archive, stored: await this.store.readAsset(id, key) };
  }

  close() {
    void this.capture.close?.();
    this.repository.close();
  }
}

export interface ArchiveServiceDependencies { capture?: CaptureClient; assetFetcher?: AssetFetcher }

export function createArchiveService(input: ArchiveConfigInput = {}, dependencies: ArchiveServiceDependencies = {}): ArchiveService {
  const config = resolveArchiveConfig(input);
  const assetFetcher = dependencies.assetFetcher ?? new SafeAssetFetcher({ ...config, maxBytes: config.assetMaxBytes, timeoutMs: config.assetTimeoutMs });
  const capture = dependencies.capture ?? new BrowserCaptureClient({ ...config, assetFetcher });
  return new ArchiveService(
    new SqliteArchiveRepository(config.databasePath),
    new LocalSnapshotStore(config.archiveRoot),
    capture,
    new ImmediateSemaphore(config.maxConcurrent),
    {
      windowMs: config.rateWindowMs,
      maxSubmissions: config.maxSubmissionsPerWindow,
      maxStoredBytes: config.maxStoredBytes,
      reserveBytes: Math.min(config.maxStoredBytes, config.maxBytes + config.assetTotalMaxBytes + config.renderedMaxBytes),
      timeoutMs: config.timeoutMs,
    },
    assetFetcher,
    { maxCount: config.assetMaxCount, maxBytes: config.assetTotalMaxBytes, timeoutMs: config.assetTimeoutMs },
  );
}

let defaultService: ArchiveService | undefined;

export function getArchiveService() {
  if (defaultService) return defaultService;
  if (process.env.ARCHIVE_E2E === "1" && process.env.NODE_ENV !== "production") {
    const port = Number(process.env.ARCHIVE_E2E_FIXTURE_PORT);
    const config = resolveArchiveConfig();
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Invalid E2E fixture port");
    const resolver = async (hostname: string) => hostname.endsWith(".fixture.test")
      ? [{ address: "93.184.216.34", family: 4 as const }]
      : Promise.reject(new Error("E2E only permits fixture hosts"));
    const connectionAddress = (_validatedAddress: string, url: URL) => {
      if (!url.hostname.endsWith(".fixture.test") || Number(url.port) !== port) throw new Error("Invalid E2E fixture origin");
      return { address: "127.0.0.1", family: 4 as const };
    };
    const assetFetcher = new SafeAssetFetcher({ ...config, maxBytes: config.assetMaxBytes, timeoutMs: config.assetTimeoutMs, resolver, connectionAddress });
    const capture = new BrowserCaptureClient({
      ...config,
      resolver,
      connectionAddress,
      assetFetcher,
      browserHostResolverRules: "MAP *.fixture.test 127.0.0.1",
    });
    defaultService = createArchiveService(config, { capture, assetFetcher });
  }
  return defaultService ??= createArchiveService();
}
