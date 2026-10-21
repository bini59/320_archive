import { mkdtemp, readdir, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteArchiveRepository } from "./database";
import { ImmediateSemaphore } from "./limiter";
import { ArchiveService } from "./service";
import { LocalSnapshotStore } from "./storage";
import { parseTags, TagValidationError } from "./tags";
import type { AssetFetcher, CaptureClient, CapturedPage } from "./types";

class FlakyStore extends LocalSnapshotStore {
  failCleanups = 0;
  async cleanup(id: string) {
    if (this.failCleanups > 0) { this.failCleanups -= 1; throw new Error("EBUSY"); }
    return super.cleanup(id);
  }
}

const page = (body: string): CaptureClient => ({
  async capture(url): Promise<CapturedPage> {
    return { bytes: Buffer.from(`<html><head><title>${body}</title></head><body>${body} body <img src="pic.png"></body></html>`), contentType: "text/html", finalUrl: url };
  },
});
const assetFetcher: AssetFetcher = { fetch: async (url) => ({ originalUrl: url, finalUrl: url, mimeType: "image/png", bytes: Buffer.alloc(321, 7) }) };

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "320-archive-manage-"));
  const databasePath = path.join(root, "archive.db");
  const archiveRoot = path.join(root, "archives");
  const store = new FlakyStore(archiveRoot);
  const repository = new SqliteArchiveRepository(databasePath);
  const service = new ArchiveService(repository, store, page("Needle"), new ImmediateSemaphore(2), { windowMs: 60_000, maxSubmissions: 50, maxStoredBytes: 1_000_000, reserveBytes: 10_000, timeoutMs: 1_000 }, assetFetcher);
  const sql = new DatabaseSync(databasePath);
  cleanups.push(async () => { sql.close(); service.close(); await rm(root, { recursive: true, force: true }); });
  const usedBytes = () => repository.usedBytes();
  const tagSlugs = () => Array.from((sql.prepare("SELECT slug FROM tags ORDER BY slug") as any).all() as Iterable<{ slug: string }>, (row) => row.slug);
  const linkCount = (id: string) => Number((sql.prepare("SELECT COUNT(*) value FROM archive_tags WHERE archive_id=?").get(id) as { value: number }).value);
  const ftsCount = (id: string) => Number((sql.prepare("SELECT COUNT(*) value FROM archive_search WHERE archive_id=?").get(id) as { value: number }).value);
  return { archiveRoot, service, store, sql, usedBytes, tagSlugs, linkCount, ftsCount };
}

describe("archive deletion", () => {
  it("removes the row, tag links, search index, files and orphan tags and returns the exact stored bytes", async () => {
    const { archiveRoot, service, usedBytes, tagSlugs, linkCount, ftsCount } = await fixture();
    const kept = (await service.create("https://example.com/kept", "Shared")).archive;
    const afterKept = usedBytes();
    const gone = (await service.create("https://example.com/gone", "Shared, Only Gone")).archive;
    expect(gone.status).toBe("saved");
    expect(gone.storedBytes).toBeGreaterThan(321);
    expect(usedBytes()).toBe(afterKept + gone.storedBytes!);
    expect(await readdir(path.join(archiveRoot, gone.id, "assets"))).toHaveLength(1);

    await expect(service.deleteArchive(gone.id)).resolves.toBe("deleted");

    expect(usedBytes()).toBe(afterKept);
    expect(service.findById(gone.id)).toBeNull();
    expect(service.findPublicById(gone.id)).toBeNull();
    expect(service.listPublic({}).items.map((item) => item.id)).toEqual([kept.id]);
    expect(service.listPublic({ q: "needle" }).items.map((item) => item.id)).toEqual([kept.id]);
    expect(service.listPublic({ tag: "only-gone" }).total).toBe(0);
    expect(linkCount(gone.id)).toBe(0);
    expect(ftsCount(gone.id)).toBe(0);
    expect(tagSlugs()).toEqual(["shared"]);
    expect(await readdir(archiveRoot)).toEqual([kept.id]);
  });

  it("is safe to repeat", async () => {
    const { service, usedBytes } = await fixture();
    const gone = (await service.create("https://example.com/gone")).archive;
    await service.deleteArchive(gone.id);
    const after = usedBytes();

    await expect(service.deleteArchive(gone.id)).resolves.toBe("not_found");
    await expect(service.deleteArchive("00000000-0000-4000-8000-000000000000")).resolves.toBe("not_found");
    expect(usedBytes()).toBe(after);
  });

  it("keeps file cleanup queued when removing files fails and finishes it on retry without double counting", async () => {
    const { archiveRoot, service, store, usedBytes } = await fixture();
    const gone = (await service.create("https://example.com/gone")).archive;
    store.failCleanups = 1;

    await expect(service.deleteArchive(gone.id)).resolves.toBe("files_pending");
    expect(service.findById(gone.id)).toBeNull();
    expect(usedBytes()).toBe(0);
    expect(await readdir(archiveRoot)).toEqual([gone.id]);

    await expect(service.deleteArchive(gone.id)).resolves.toBe("deleted");
    expect(await readdir(archiveRoot)).toEqual([]);
    expect(usedBytes()).toBe(0);
  });

  it("retries queued file cleanups in the background sweep", async () => {
    const { archiveRoot, service, store } = await fixture();
    const gone = (await service.create("https://example.com/gone")).archive;
    store.failCleanups = 2;
    await service.deleteArchive(gone.id);

    await expect(service.retryPendingFileCleanups()).resolves.toBe(1);
    await expect(service.retryPendingFileCleanups()).resolves.toBe(0);
    expect(await readdir(archiveRoot)).toEqual([]);
  });

  it("measures archives saved before stored bytes were recorded", async () => {
    const { service, sql, usedBytes } = await fixture();
    const legacy = (await service.create("https://example.com/legacy")).archive;
    sql.prepare("UPDATE archives SET stored_bytes=NULL WHERE id=?").run(legacy.id);
    expect(usedBytes()).toBe(legacy.storedBytes);

    await service.deleteArchive(legacy.id);
    expect(usedBytes()).toBe(0);
  });
});

describe("archive tag editing", () => {
  it("adds, renames and removes tags with the same parsing as new archives and prunes unused tags", async () => {
    const { service, tagSlugs } = await fixture();
    const archive = (await service.create("https://example.com/a", "Old, Shared")).archive;
    await service.create("https://example.com/b", "Shared");

    const input = "  Foo   Bar , foo bar, Ｎｅｗｓ, Shared";
    const updated = service.updateTags(archive.id, input)!;

    expect(updated.tags).toEqual([...parseTags(input)].sort((a, b) => a.slug.localeCompare(b.slug)));
    expect(tagSlugs()).toEqual(["foo-bar", "news", "shared"]);
    expect(service.listPublic({ tag: "old" }).total).toBe(0);
    expect(service.listPublic({ tag: "news" }).items.map((item) => item.id)).toEqual([archive.id]);

    expect(service.updateTags(archive.id, "")!.tags).toEqual([]);
    expect(tagSlugs()).toEqual(["shared"]);
  });

  it("rejects invalid input without touching existing tags", async () => {
    const { service } = await fixture();
    const archive = (await service.create("https://example.com/a", "Keep")).archive;

    expect(() => service.updateTags(archive.id, Array.from({ length: 11 }, (_, i) => `t${i}`).join(","))).toThrow(TagValidationError);
    expect(() => service.updateTags(archive.id, "bad#tag")).toThrow(TagValidationError);
    expect(() => service.updateTags(archive.id, "x".repeat(33))).toThrow(TagValidationError);
    expect(service.findById(archive.id)!.tags.map((tag) => tag.slug)).toEqual(["keep"]);
    expect(service.updateTags("00000000-0000-4000-8000-000000000000", "a")).toBeNull();
  });
});
