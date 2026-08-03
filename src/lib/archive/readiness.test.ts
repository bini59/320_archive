import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkArchiveReadiness } from "./readiness";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("checkArchiveReadiness", () => {
  it("opens the database and verifies both storage locations are writable", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "archive-ready-"));
    roots.push(root);
    await expect(checkArchiveReadiness({
      databasePath: path.join(root, "db", "archive.db"),
      archiveRoot: path.join(root, "archives"),
    })).resolves.toBeUndefined();
  });
});
