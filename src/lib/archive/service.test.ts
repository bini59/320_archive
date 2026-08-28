import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { SqliteArchiveRepository } from "./database";
import { CaptureError } from "./fetcher";
import { ImmediateSemaphore } from "./limiter";
import { ArchiveService } from "./service";
import { LocalSnapshotStore } from "./storage";
import type { AssetFetcher, CaptureClient, CapturedPage } from "./types";

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
  assetFetcher?: AssetFetcher;
  assetTimeoutMs?: number;
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
    options.assetFetcher,
    { maxCount:20,maxBytes:1_000,timeoutMs:options.assetTimeoutMs??10_000 },
  );
  services.push(service);
  return { archiveRoot, capture, databasePath, service };
}

afterEach(async () => {
  for (const service of services.splice(0)) service.close();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ArchiveService synchronous capture", () => {
  it("bounds the entire asset phase and does not multiply the deadline per candidate",async()=>{const capture=new StubCapture({bytes:Buffer.from('<img src="a.png"><img src="b.png">'),contentType:"text/html",finalUrl:"https://example.com/page"});let calls=0;let aborted=false;const assetFetcher:AssetFetcher={fetch:async(_url,signal)=>{calls++;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,10_000);signal?.addEventListener("abort",()=>{aborted=true;clearTimeout(timer);reject(new Error("aborted"));},{once:true});});return {originalUrl:"x",finalUrl:"x",mimeType:"image/png",bytes:Buffer.from([1])};}};const {service}=await fixture({capture,assetFetcher,assetTimeoutMs:30});const started=Date.now();expect((await service.create("https://example.com/page")).archive.status).toBe("saved");expect(Date.now()-started).toBeLessThan(300);expect(aborted).toBe(true);expect(calls).toBe(1);});

  it("rejects candidate-kind MIME mismatches",async()=>{const capture=new StubCapture({bytes:Buffer.from('<img src="image.pdf"><a href="note.txt">note</a>'),contentType:"text/html",finalUrl:"https://example.com/page"});const assetFetcher:AssetFetcher={fetch:async url=>({originalUrl:url,finalUrl:url,mimeType:url.endsWith("pdf")?"application/pdf":"image/png",bytes:Buffer.from("x")})};const {archiveRoot,service}=await fixture({capture,assetFetcher});const result=await service.create("https://example.com/mismatch");expect(await readFile(path.join(archiveRoot,result.archive.id,"assets.json"),"utf8")).toContain('"assets": []');});
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

  it("persists a rendered snapshot and its CSS resources as part of the archive", async () => {
    const capture = new StubCapture({
      bytes: Buffer.from('<html><body><img alt="captured" src="/image.png">original</body></html>'),
      contentType: "text/html",
      finalUrl: "https://example.com/final",
      rendered: Buffer.from("<html><head><link rel=stylesheet href=local.css></head><body>hydrated</body></html>"),
      renderedAssets: [{
        originalUrl: "https://example.com/local.css",
        finalUrl: "https://example.com/local.css",
        mimeType: "text/css",
        bytes: Buffer.from("body{color:red}"),
      }, {
        originalUrl: "https://example.com/image.png",
        finalUrl: "https://example.com/image.png",
        mimeType: "image/png",
        bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      }],
    });
    const { archiveRoot, service } = await fixture({ capture, maxStoredBytes: 10_000, reserveBytes: 2_000 });

    const result = await service.create("https://example.com/rendered");

    expect(result.archive.status).toBe("saved");
    expect(await readFile(path.join(archiveRoot, result.archive.id, "rendered.html"), "utf8")).toContain("hydrated");
    expect(await readFile(path.join(archiveRoot, result.archive.id, "readable.html"), "utf8")).toMatch(new RegExp(`/archives/${result.archive.id}/assets/[a-f0-9]{64}\\.png`));
    expect(JSON.parse(await readFile(path.join(archiveRoot, result.archive.id, "assets.json"), "utf8")).assets).toHaveLength(2);
  });

  it("authorizes private content by owner while leaving public content readable", async () => {
    const { service } = await fixture();
    const privateArchive = await service.create("https://example.com/private", "", "owner-1", null, "private");
    const publicArchive = await service.create("https://example.com/public", "", "owner-1", null, "public");

    expect(await service.findContent(privateArchive.archive.id, "original")).toBeNull();
    expect(await service.findContent(privateArchive.archive.id, "original", "other-user")).toBeNull();
    expect(await service.findContent(privateArchive.archive.id, "original", "owner-1")).toMatchObject({ archive: { id: privateArchive.archive.id } });
    expect(await service.findContent(publicArchive.archive.id, "original")).toMatchObject({ archive: { id: publicArchive.archive.id } });
    expect(await service.findPublicContent(publicArchive.archive.id, "original")).toMatchObject({ archive: { id: publicArchive.archive.id } });
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

  it("normalizes and merges submission tags and exposes searchable readable text", async () => {
    const { service } = await fixture();
    const first = await service.create("https://example.com/tagged", " News, news, 한국 소식 ");
    await service.create("https://example.com/tagged", "Tech");
    expect(service.findById(first.archive.id)?.tags.map((tag) => tag.slug)).toEqual(["news", "tech", "한국-소식"]);
    expect(service.listPublic({ q: "Example", tag: "news" }).items[0]?.id).toBe(first.archive.id);
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
    const first = await fixture({ maxStoredBytes: 500, reserveBytes: 100, capture: new StubCapture({ bytes: Buffer.from("<html>1</html>"), contentType: "text/html", finalUrl: "https://example.com/one" }) });
    expect((await first.service.create("https://example.com/one")).archive.status).toBe("saved");
    first.service.close();
    services.splice(services.indexOf(first.service), 1);

    const second = await fixture({ databasePath: first.databasePath, maxStoredBytes: 500, reserveBytes: 100, capture: new StubCapture({ bytes: Buffer.from("<html>content exceeding remaining quota</html>"), contentType: "text/html", finalUrl: "https://example.com/two" }) });
    expect(await second.service.create("https://example.com/two")).toMatchObject({
      archive: { status: "failed", failureCode: "quota_exceeded" },
    });
  });
});
