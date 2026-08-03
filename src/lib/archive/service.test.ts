import { mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createArchiveService, type ArchiveService } from "./service";

const temporaryDirectories: string[] = [];
const openServices: ArchiveService[] = [];

async function testService() {
  const root = await mkdtemp(path.join(os.tmpdir(), "320-archive-test-"));
  temporaryDirectories.push(root);
  const config = {
    databasePath: path.join(root, "archive.db"),
    archiveRoot: path.join(root, "archives"),
  };
  const service = createArchiveService(config);
  openServices.push(service);
  return { service, config };
}

afterEach(async () => {
  for (const service of openServices.splice(0)) service.close();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("ArchiveService", () => {
  it("creates a pending archive and its metadata in isolated storage", async () => {
    const { service, config } = await testService();

    const result = await service.create("HTTPS://Example.com:443/articles/1?q=yes#section");

    expect(result.created).toBe(true);
    expect(result.archive).toMatchObject({
      originalUrl: "HTTPS://Example.com:443/articles/1?q=yes#section",
      normalizedUrl: "https://example.com/articles/1?q=yes#section",
      status: "pending",
    });
    expect(result.archive.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Date(result.archive.createdAt).toISOString()).toBe(result.archive.createdAt);

    const metadata = JSON.parse(
      await readFile(path.join(config.archiveRoot, result.archive.id, "metadata.json"), "utf8"),
    );
    expect(metadata).toEqual(result.archive);
  });

  it("reuses one archive for equivalent normalized URLs", async () => {
    const { service } = await testService();
    const first = await service.create("https://EXAMPLE.com:443/story");

    const duplicate = await service.create("https://example.com/story");

    expect(duplicate).toEqual({ archive: first.archive, created: false });
  });

  it("finds a persisted archive after the database is reopened", async () => {
    const { service, config } = await testService();
    const created = await service.create("https://example.com/persisted");
    service.close();
    openServices.splice(openServices.indexOf(service), 1);

    const reopened = createArchiveService(config);
    openServices.push(reopened);

    expect(reopened.findById(created.archive.id)).toEqual(created.archive);
  });

  it("repairs missing metadata when an archive is submitted again", async () => {
    const { service, config } = await testService();
    const first = await service.create("https://example.com/repair");
    const metadataPath = path.join(config.archiveRoot, first.archive.id, "metadata.json");
    await unlink(metadataPath);

    const duplicate = await service.create("https://EXAMPLE.com:443/repair");

    expect(duplicate.created).toBe(false);
    expect(JSON.parse(await readFile(metadataPath, "utf8"))).toEqual(first.archive);
  });

  it("converges concurrent duplicate submissions on the same archive", async () => {
    const { service } = await testService();

    const results = await Promise.all(
      Array.from({ length: 8 }, () => service.create("https://example.com/concurrent")),
    );

    expect(new Set(results.map(({ archive }) => archive.id))).toHaveLength(1);
    expect(results.filter(({ created }) => created)).toHaveLength(1);
  });
});
