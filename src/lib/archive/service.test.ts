import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { SqliteArchiveRepository } from "./database";
import { CaptureError } from "./fetcher";
import { ImmediateSemaphore } from "./limiter";
import { ArchiveService } from "./service";
import { LocalSnapshotStore } from "./storage";
import type { CaptureClient, CapturedPage } from "./types";

const roots: string[] = [];
const services: ArchiveService[] = [];

class StubCapture implements CaptureClient {
  calls = 0;

  constructor(private readonly outcome: CapturedPage | Error) {}

  async capture(): Promise<CapturedPage> {
    this.calls += 1;
    if (this.outcome instanceof Error) throw this.outcome;
    return this.outcome;
  }
}

async function fixture(options: {
  capture?: CaptureClient;
  databasePath?: string;
  maxConcurrent?: number;
  maxSubmissions?: number;
  maxStoredBytes?: number;
  reserveBytes?: number;
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "320-archive-capture-test-"));
  roots.push(root);
  const databasePath = options.databasePath ?? path.join(root, "archive.db");
  const archiveRoot = path.join(root, "archives");
  const capture = options.capture ?? new StubCapture({
    bytes: Buffer.from('<html><head><title>  Example &amp; title </title><meta name="description" content="A saved page"></head><body>exact original</body></html>'),
    contentType: "text/html",
    finalUrl: "https://example.com/final",
  });
  const service = new ArchiveService(
    new SqliteArchiveRepository(databasePath),
    new LocalSnapshotStore(archiveRoot),
    capture,
    new ImmediateSemaphore(options.maxConcurrent ?? 2),
    {
      windowMs: 60_000,
      maxSubmissions: options.maxSubmissions ?? 10,
      maxStoredBytes: options.maxStoredBytes ?? 10_000,
      reserveBytes: options.reserveBytes ?? 1_000,
      timeoutMs: 1_000,
    },
  );
  services.push(service);
  return { archiveRoot, capture, databasePath, service };
}

afterEach(async () => {
  for (const service of services.splice(0)) service.close();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ArchiveService synchronous capture", () => {
  it("persists exact HTML and snapshot metadata before returning saved", async () => {
    const bytes = Buffer.from('<html><head><title>  Example &amp; title </title><meta name="description" content="A saved page"></head><body>exact original</body></html>');
    const capture = new StubCapture({ bytes, contentType: "text/html", finalUrl: "https://example.com/final" });
    const { archiveRoot, service } = await fixture({ capture });

    const result = await service.create("https://example.com/start");

    expect(result.archive).toMatchObject({
      status: "saved",
      snapshot: {
        title: "Example & title",
        description: "A saved page",
        finalUrl: "https://example.com/final",
        byteLength: bytes.byteLength,
      },
    });
    expect(new Date(result.archive.snapshot!.capturedAt).toISOString()).toBe(result.archive.snapshot!.capturedAt);
    expect(await readFile(path.join(archiveRoot, result.archive.id, "original.html"))).toEqual(bytes);
    const readable = await readFile(path.join(archiveRoot, result.archive.id, "readable.html"), "utf8");
    expect(readable).toContain("exact original");
    expect(await service.findContent(result.archive.id, "readable")).toMatchObject({ archive: { status: "saved" }, content: { kind: "readable" } });
    expect(JSON.parse(await readFile(path.join(archiveRoot, result.archive.id, "snapshot.json"), "utf8"))).toEqual(result.archive.snapshot);
  });

  it("does not expose content for pending or failed archives", async () => {
    const { service } = await fixture({ capture: new StubCapture(new CaptureError("timeout")) });
    const failed = await service.create("https://example.com/fail");
    expect(await service.findContent(failed.archive.id, "original")).toBeNull();
  });

  it("stores only the allow-listed reason and cleans files when capture fails", async () => {
    const { archiveRoot, service } = await fixture({ capture: new StubCapture(new CaptureError("timeout")) });

    const result = await service.create("https://example.com/slow");

    expect(result.archive).toMatchObject({
      status: "failed",
      failureCode: "timeout",
      failureMessage: "페이지 응답 시간이 초과되었습니다.",
      snapshot: null,
    });
    await expect(readdir(path.join(archiveRoot, result.archive.id))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not capture an equivalent URL twice", async () => {
    const capture = new StubCapture({ bytes: Buffer.from("<html></html>"), contentType: "text/html", finalUrl: "https://example.com/story" });
    const { service } = await fixture({ capture });

    const first = await service.create("https://EXAMPLE.com:443/story");
    const duplicate = await service.create("https://example.com/story");

    expect(duplicate).toEqual({ archive: first.archive, created: false });
    expect(capture.calls).toBe(1);
  });

  it("rejects excess concurrent work immediately instead of queueing it", async () => {
    let unblock!: () => void;
    const blocked = new Promise<void>((resolve) => { unblock = resolve; });
    const capture: CaptureClient = {
      async capture(url) {
        await blocked;
        return { bytes: Buffer.from("<html></html>"), contentType: "text/html", finalUrl: url };
      },
    };
    const { service } = await fixture({ capture, maxConcurrent: 1 });

    const active = service.create("https://example.com/active");
    await new Promise((resolve) => setImmediate(resolve));
    const excess = await service.create("https://example.com/excess");

    expect(excess.archive).toMatchObject({ status: "failed", failureCode: "overloaded" });
    unblock();
    expect((await active).archive.status).toBe("saved");
  });

  it("enforces the SQLite rolling submission limit across service instances", async () => {
    const first = await fixture({ maxSubmissions: 1 });
    const second = await fixture({ databasePath: first.databasePath, maxSubmissions: 1 });

    expect((await first.service.create("https://example.com/one")).archive.status).toBe("saved");
    expect(await second.service.create("https://example.com/two")).toMatchObject({
      archive: { status: "failed", failureCode: "rate_limited" },
    });
  });

  it("persists the total byte quota across a process-style reopen", async () => {
    const first = await fixture({ maxStoredBytes: 30, reserveBytes: 15, capture: new StubCapture({ bytes: Buffer.from("<html>1</html>"), contentType: "text/html", finalUrl: "https://example.com/one" }) });
    expect((await first.service.create("https://example.com/one")).archive.status).toBe("saved");
    first.service.close();
    services.splice(services.indexOf(first.service), 1);

    const second = await fixture({ databasePath: first.databasePath, maxStoredBytes: 30, reserveBytes: 15, capture: new StubCapture({ bytes: Buffer.from("<html>content exceeding remaining quota</html>"), contentType: "text/html", finalUrl: "https://example.com/two" }) });
    expect(await second.service.create("https://example.com/two")).toMatchObject({
      archive: { status: "failed", failureCode: "quota_exceeded" },
    });
  });
});
